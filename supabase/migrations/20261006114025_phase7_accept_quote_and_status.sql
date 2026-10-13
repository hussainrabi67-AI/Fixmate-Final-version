/*
# Phase 7: Accept quote atomic function + booking status validation

## Purpose
Creates a SECURITY DEFINER function `accept_quote` that atomically:
1. Validates the quote belongs to a request owned by the calling user
2. Sets the accepted quote status = 'accepted'
3. Rejects all other pending quotes for the same request
4. Creates a booking record
5. Updates the service_request status to 'booked'

Also creates a helper function `valid_booking_status_transition` that
prevents backward status changes on bookings (e.g. can't go from
'completed' back to 'in_progress').

## New Functions

### accept_quote(p_quote_id uuid)
- SECURITY DEFINER, runs as postgres (bypasses RLS for the multi-table update)
- Validates ownership: quote → request → user_id must = auth.uid()
- Throws error if quote is not 'pending' or already 'accepted'
- Rejects other quotes for same request (status = 'rejected')
- Inserts booking with status = 'accepted', copies location/notes from request
- Updates service_requests.status = 'booked'
- Returns the new booking id

### valid_booking_status_transition(p_current text, p_new text)
- Returns boolean: whether the transition from p_current to p_new is valid
- Enforces forward-only progression through the status pipeline

## Security
- accept_quote is SECURITY DEFINER with search_path = public
- Only callable by authenticated users
- Ownership is checked inside the function via auth.uid()
- Booking status updates use the transition validator (called from RLS or app)

## Important Notes
1. The function uses auth.uid() to verify the caller owns the service request
2. All changes happen atomically — if any step fails, nothing is committed
3. No fake data is created
4. The booking copies the request's location as default
*/

-- ============================================================
-- accept_quote: atomic quote acceptance + booking creation
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_quote(p_quote_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_quote record;
  v_request record;
  v_booking_id uuid;
BEGIN
  -- Load the quote and its associated request
  SELECT q.*, q.id AS quote_id INTO v_quote
  FROM quotes q
  WHERE q.id = p_quote_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found.';
  END IF;

  -- Load the service request
  SELECT * INTO v_request
  FROM service_requests
  WHERE id = v_quote.request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service request not found.';
  END IF;

  -- Verify ownership: only the request owner can accept quotes
  IF v_request.user_id != auth.uid() THEN
    RAISE EXCEPTION 'You are not authorized to accept this quote.';
  END IF;

  -- Verify quote is still pending
  IF v_quote.status != 'pending' THEN
    RAISE EXCEPTION 'This quote is no longer available (status: %).', v_quote.status;
  END IF;

  -- Accept the selected quote
  UPDATE quotes SET status = 'accepted' WHERE id = p_quote_id;

  -- Reject all other pending quotes for this request
  UPDATE quotes SET status = 'rejected'
  WHERE request_id = v_quote.request_id
    AND id != p_quote_id
    AND status = 'pending';

  -- Create the booking
  INSERT INTO bookings (
    request_id, user_id, technician_id,
    scheduled_at, location, notes, status
  )
  VALUES (
    v_quote.request_id,
    v_request.user_id,
    v_quote.technician_id,
    now() + interval '2 hours',
    COALESCE(v_request.location, ''),
    v_quote.message,
    'accepted'
  )
  RETURNING id INTO v_booking_id;

  -- Update the service request status
  UPDATE service_requests SET status = 'booked' WHERE id = v_quote.request_id;

  RETURN v_booking_id;
END;
$$;

-- Revoke from anon, grant to authenticated
REVOKE ALL ON FUNCTION public.accept_quote(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_quote(uuid) TO authenticated;

-- ============================================================
-- valid_booking_status_transition: enforce forward-only status
-- ============================================================
CREATE OR REPLACE FUNCTION public.valid_booking_status_transition(p_current text, p_new text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    -- Same status is always valid (no-op)
    WHEN p_current = p_new THEN true
    -- From 'requested'
    WHEN p_current = 'requested' AND p_new IN ('accepted', 'cancelled') THEN true
    -- From 'accepted'
    WHEN p_current = 'accepted' AND p_new IN ('scheduled', 'cancelled') THEN true
    -- From 'scheduled'
    WHEN p_current = 'scheduled' AND p_new IN ('on_the_way', 'cancelled') THEN true
    -- From 'on_the_way'
    WHEN p_current = 'on_the_way' AND p_new IN ('in_progress', 'cancelled') THEN true
    -- From 'in_progress'
    WHEN p_current = 'in_progress' AND p_new IN ('completed', 'cancelled') THEN true
    -- completed and cancelled are terminal
    ELSE false
  END
$$;
