/*
# Set public_technicians view to security_invoker

## Purpose
PostgreSQL views by default run with the view owner's privileges, which bypasses
RLS on the underlying tables. Setting security_invoker = true makes the view
run with the querying user's permissions, so RLS policies on technicians,
profiles, reviews, and bookings still apply.
*/

ALTER VIEW public_technicians SET (security_invoker = true);
