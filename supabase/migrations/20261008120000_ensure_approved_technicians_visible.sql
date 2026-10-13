-- ============================================================
-- Ensure approved technicians are visible to all users (anon & authenticated)
-- ============================================================

-- 1. Technicians table SELECT policy for public and admins
DROP POLICY IF EXISTS "technicians_select_own_or_approved" ON public.technicians;
DROP POLICY IF EXISTS "technicians_select_own_or_verified" ON public.technicians;
CREATE POLICY "technicians_select_own_or_approved"
ON public.technicians FOR SELECT
TO anon, authenticated
USING (
  public.get_user_role() = 'admin'
  OR profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR verification_status IN ('approved', 'verified')
);

-- 2. Profiles table SELECT policy to allow viewing technician profiles
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_public_and_own" ON public.profiles;
CREATE POLICY "profiles_select_public_and_own"
ON public.profiles FOR SELECT
TO anon, authenticated
USING (
  public.get_user_role() = 'admin'
  OR user_id = auth.uid()
  OR role = 'technician'
  OR id IN (SELECT profile_id FROM public.technicians WHERE verification_status IN ('approved', 'verified'))
);

-- 3. Technician services SELECT policy
DROP POLICY IF EXISTS "technician_services_select" ON public.technician_services;
CREATE POLICY "technician_services_select"
ON public.technician_services FOR SELECT
TO anon, authenticated
USING (true);

-- 4. Service categories SELECT policy
DROP POLICY IF EXISTS "service_categories_select" ON public.service_categories;
CREATE POLICY "service_categories_select"
ON public.service_categories FOR SELECT
TO anon, authenticated
USING (true);

-- 5. Reviews SELECT policy
DROP POLICY IF EXISTS "reviews_select" ON public.reviews;
CREATE POLICY "reviews_select"
ON public.reviews FOR SELECT
TO anon, authenticated
USING (true);

-- 6. Update public_technicians view to support both 'approved' and 'verified'
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
WHERE t.verification_status IN ('approved', 'verified');
