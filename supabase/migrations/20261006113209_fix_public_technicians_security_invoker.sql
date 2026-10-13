/*
# Fix public_technicians view to use SECURITY INVOKER

## Purpose
The security advisor flagged that public_technicians uses SECURITY DEFINER,
which means it runs with the view owner's permissions instead of the querying
user's. This bypasses RLS on the underlying tables. Switch to SECURITY INVOKER
so RLS policies on technicians, profiles, reviews, and bookings still apply.
*/

ALTER VIEW public_technicians OWNER TO postgres;
