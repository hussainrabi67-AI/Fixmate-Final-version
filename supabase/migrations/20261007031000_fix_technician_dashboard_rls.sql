-- ============================================================
-- Fix RLS Policies for FixMate Technician Dashboard & Storage
-- ============================================================

-- 1. Ensure technician-pictures bucket exists and is public for reading
INSERT INTO storage.buckets (id, name, public)
VALUES ('technician-pictures', 'technician-pictures', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage: SELECT (read) public for technician-pictures
DROP POLICY IF EXISTS "technician_pictures_public_read" ON storage.objects;
CREATE POLICY "technician_pictures_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'technician-pictures');

-- Storage: INSERT (upload) own picture
DROP POLICY IF EXISTS "technician_pictures_insert_own" ON storage.objects;
CREATE POLICY "technician_pictures_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'technician-pictures'
  AND (
    public.get_user_role() = 'admin'
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR (storage.foldername(name))[1] IN (SELECT id::text FROM public.profiles WHERE user_id = auth.uid())
  )
);

-- Storage: UPDATE own picture
DROP POLICY IF EXISTS "technician_pictures_update_own" ON storage.objects;
CREATE POLICY "technician_pictures_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'technician-pictures'
  AND (
    public.get_user_role() = 'admin'
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR (storage.foldername(name))[1] IN (SELECT id::text FROM public.profiles WHERE user_id = auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'technician-pictures'
  AND (
    public.get_user_role() = 'admin'
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR (storage.foldername(name))[1] IN (SELECT id::text FROM public.profiles WHERE user_id = auth.uid())
  )
);

-- Storage: DELETE own picture
DROP POLICY IF EXISTS "technician_pictures_delete_own" ON storage.objects;
CREATE POLICY "technician_pictures_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'technician-pictures'
  AND (
    public.get_user_role() = 'admin'
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR (storage.foldername(name))[1] IN (SELECT id::text FROM public.profiles WHERE user_id = auth.uid())
  )
);

-- ============================================================
-- 2. PROFILES TABLE RLS POLICIES
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
ON public.profiles FOR SELECT
TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR user_id = auth.uid()
  OR role = 'technician'
  OR id IN (SELECT profile_id FROM public.technicians WHERE verification_status IN ('approved', 'verified'))
);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (
  public.get_user_role() = 'admin'
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR user_id = auth.uid()
)
WITH CHECK (
  public.get_user_role() = 'admin'
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own"
ON public.profiles FOR DELETE
TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR user_id = auth.uid()
);

-- ============================================================
-- 3. TECHNICIANS TABLE RLS POLICIES
-- ============================================================

ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "technicians_select_own_or_verified" ON public.technicians;
DROP POLICY IF EXISTS "technicians_select_own_or_approved" ON public.technicians;
CREATE POLICY "technicians_select_own_or_approved"
ON public.technicians FOR SELECT
TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR verification_status IN ('approved', 'verified')
);

DROP POLICY IF EXISTS "technicians_insert_own" ON public.technicians;
CREATE POLICY "technicians_insert_own"
ON public.technicians FOR INSERT
TO authenticated
WITH CHECK (
  public.get_user_role() = 'admin'
  OR profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "technicians_update_own" ON public.technicians;
CREATE POLICY "technicians_update_own"
ON public.technicians FOR UPDATE
TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  public.get_user_role() = 'admin'
  OR profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "technicians_delete_own" ON public.technicians;
CREATE POLICY "technicians_delete_own"
ON public.technicians FOR DELETE
TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- ============================================================
-- 4. TECHNICIAN_SERVICES TABLE RLS POLICIES
-- ============================================================

ALTER TABLE public.technician_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "technician_services_select" ON public.technician_services;
CREATE POLICY "technician_services_select"
ON public.technician_services FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "technician_services_insert_own" ON public.technician_services;
CREATE POLICY "technician_services_insert_own"
ON public.technician_services FOR INSERT
TO authenticated
WITH CHECK (
  public.get_user_role() = 'admin'
  OR technician_id IN (
    SELECT t.id FROM public.technicians t
    JOIN public.profiles p ON t.profile_id = p.id
    WHERE p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "technician_services_update_own" ON public.technician_services;
CREATE POLICY "technician_services_update_own"
ON public.technician_services FOR UPDATE
TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR technician_id IN (
    SELECT t.id FROM public.technicians t
    JOIN public.profiles p ON t.profile_id = p.id
    WHERE p.user_id = auth.uid()
  )
)
WITH CHECK (
  public.get_user_role() = 'admin'
  OR technician_id IN (
    SELECT t.id FROM public.technicians t
    JOIN public.profiles p ON t.profile_id = p.id
    WHERE p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "technician_services_delete_own" ON public.technician_services;
CREATE POLICY "technician_services_delete_own"
ON public.technician_services FOR DELETE
TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR technician_id IN (
    SELECT t.id FROM public.technicians t
    JOIN public.profiles p ON t.profile_id = p.id
    WHERE p.user_id = auth.uid()
  )
);
