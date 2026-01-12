-- ============================================
-- Supabase Storage Setup for File Uploads
-- ============================================
-- Run this entire script in SQL Editor after creating the bucket
-- This will set up the necessary policies for file uploads

-- Create upload policy for authenticated users
CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-files');

-- Create download policy for public access
CREATE POLICY "Allow public downloads"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'task-files');

-- Create delete policy for authenticated users (optional but recommended)
CREATE POLICY "Allow authenticated deletes"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'task-files');

-- Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'objects'
AND policyname LIKE '%task-files%';
