/*
# Create storage bucket for problem images

## Purpose
Creates a public storage bucket 'problem-images' where authenticated users
can upload photos of their repair problems.

## Storage Policies
- SELECT (read): public — anyone can view uploaded problem images
- INSERT: authenticated users can upload to their own folder path
- UPDATE: users can update their own uploads
- DELETE: users can delete their own uploads

## Important Notes
1. The bucket is named 'problem-images' and is public for reads.
2. Upload paths are scoped by user ID: {user_id}/{filename}
3. Authenticated users can only manage files in their own folder.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('problem-images', 'problem-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access
DROP POLICY IF EXISTS "problem_images_public_read" ON storage.objects;
CREATE POLICY "problem_images_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'problem-images');

-- Authenticated users can insert into their own folder
DROP POLICY IF EXISTS "problem_images_insert_own" ON storage.objects;
CREATE POLICY "problem_images_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'problem-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can update their own files
DROP POLICY IF EXISTS "problem_images_update_own" ON storage.objects;
CREATE POLICY "problem_images_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'problem-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'problem-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own files
DROP POLICY IF EXISTS "problem_images_delete_own" ON storage.objects;
CREATE POLICY "problem_images_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'problem-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
