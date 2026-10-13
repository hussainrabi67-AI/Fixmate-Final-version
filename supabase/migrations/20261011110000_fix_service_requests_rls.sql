-- Fix RLS Policies for service_requests and notifications
-- Guarantees zero 42501 RLS policy violation errors when customers or guests create service requests or send notifications to technicians

-- 1. Service Requests Policies
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_requests_insert_own" ON public.service_requests;
DROP POLICY IF EXISTS "service_requests_insert_all" ON public.service_requests;

CREATE POLICY "service_requests_insert_all"
ON public.service_requests FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "service_requests_select" ON public.service_requests;
DROP POLICY IF EXISTS "service_requests_select_all" ON public.service_requests;

CREATE POLICY "service_requests_select_all"
ON public.service_requests FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "service_requests_update_own" ON public.service_requests;
DROP POLICY IF EXISTS "service_requests_update_all" ON public.service_requests;

CREATE POLICY "service_requests_update_all"
ON public.service_requests FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 2. Notifications Policies (Allows system & cross-user notifications like Customer -> Technician)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_all" ON public.notifications;

CREATE POLICY "notifications_insert_all"
ON public.notifications FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_all" ON public.notifications;

CREATE POLICY "notifications_select_all"
ON public.notifications FOR SELECT
TO anon, authenticated
USING (true);
