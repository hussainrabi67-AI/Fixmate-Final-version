-- Allow admins to select all technicians (including pending/unverified)
DROP POLICY IF EXISTS "technicians_select_own_or_verified" ON technicians;
CREATE POLICY "technicians_select_own_or_verified"
ON technicians FOR SELECT
TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR verification_status = 'verified'
);

-- Allow admins to update technicians (e.g. verification status)
DROP POLICY IF EXISTS "technicians_update_own" ON technicians;
CREATE POLICY "technicians_update_own"
ON technicians FOR UPDATE
TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  public.get_user_role() = 'admin'
  OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);
