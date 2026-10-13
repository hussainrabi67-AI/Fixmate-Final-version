-- Create storage bucket for technician profile pictures
INSERT INTO storage.buckets (id, name, public)
VALUES ('technician-pictures', 'technician-pictures', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access for technician pictures
DROP POLICY IF EXISTS "technician_pictures_public_read" ON storage.objects;
CREATE POLICY "technician_pictures_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'technician-pictures');

-- Authenticated users / technicians can insert their photo
DROP POLICY IF EXISTS "technician_pictures_insert_own" ON storage.objects;
CREATE POLICY "technician_pictures_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'technician-pictures'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Technicians can update their own pictures
DROP POLICY IF EXISTS "technician_pictures_update_own" ON storage.objects;
CREATE POLICY "technician_pictures_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'technician-pictures'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'technician-pictures'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Technicians can delete their own pictures
DROP POLICY IF EXISTS "technician_pictures_delete_own" ON storage.objects;
CREATE POLICY "technician_pictures_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'technician-pictures'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
