/*
# Phase 6: Technician marketplace additions

## Purpose
Adds availability and profile photo columns to the technicians table, creates
a view for the public marketplace showing verified technicians with their
service categories and review stats, and updates RLS to use "approved" status.

## Changes

### technicians table — new columns
- `availability` (text, default 'available') — technician availability status
- `avatar_url` (text, nullable) — profile photo URL

### verification_status values
The existing CHECK constraint allows 'pending', 'verified', 'rejected'.
Phase 6 uses 'approved' for public marketplace visibility. We add 'approved'
to the allowed values and update the public SELECT policy accordingly.

### New view: public_technicians
Shows approved technicians with their profile info, services (as array of
category names), and review stats (average rating + completed jobs count).
This view is accessible to all authenticated users for the marketplace.

### RLS updates
- technicians SELECT: now shows own OR verification_status = 'approved'
- public_technicians view: readable by all authenticated users

## Important Notes
1. No data is lost — columns are added with ALTER TABLE ADD COLUMN.
2. The view uses SECURITY INVOKER so RLS on underlying tables still applies.
3. Review stats are computed from real reviews only — no fake data.
4. completed_jobs counts bookings with status 'completed'.
*/

-- Add availability and avatar_url columns
ALTER TABLE technicians ADD COLUMN IF NOT EXISTS availability text NOT NULL DEFAULT 'available';
ALTER TABLE technicians ADD COLUMN IF NOT EXISTS avatar_url text;

-- Update verification_status CHECK to include 'approved'
ALTER TABLE technicians DROP CONSTRAINT IF EXISTS technicians_verification_status_check;
ALTER TABLE technicians ADD CONSTRAINT technicians_verification_status_check
  CHECK (verification_status IN ('pending', 'verified', 'approved', 'rejected'));

-- Update technicians SELECT policy to use 'approved' for public visibility
DROP POLICY IF EXISTS "technicians_select_own_or_verified" ON technicians;
CREATE POLICY "technicians_select_own_or_approved"
ON technicians FOR SELECT
TO authenticated
USING (
  profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR verification_status = 'approved'
);

-- Create the public_technicians view with services and review stats
CREATE OR REPLACE VIEW public_technicians AS
SELECT
  t.id,
  t.profile_id,
  t.profession,
  t.experience_years,
  t.service_area,
  t.whatsapp_number,
  t.verification_status,
  t.bio,
  t.availability,
  t.avatar_url,
  t.created_at,
  p.name,
  p.email,
  (
    SELECT COALESCE(json_agg(
      json_build_object('id', sc.id, 'name', sc.name, 'icon', sc.icon)
    ), '[]'::json)
    FROM technician_services ts
    JOIN service_categories sc ON sc.id = ts.service_category_id
    WHERE ts.technician_id = t.id
  ) AS services,
  (
    SELECT ROUND(AVG(r.rating), 1)
    FROM reviews r
    WHERE r.technician_id = t.id
  ) AS average_rating,
  (
    SELECT COUNT(*)
    FROM bookings b
    WHERE b.technician_id = t.id AND b.status = 'completed'
  ) AS completed_jobs,
  (
    SELECT COUNT(*)
    FROM reviews r
    WHERE r.technician_id = t.id
  ) AS review_count
FROM technicians t
JOIN profiles p ON p.id = t.profile_id
WHERE t.verification_status = 'approved';

ALTER VIEW public_technicians OWNER TO postgres;
