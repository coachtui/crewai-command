-- Migration: Add attachments support to tasks table
-- Run this in your Supabase SQL Editor

-- Add attachments column to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';

-- Create storage bucket for task files (if not exists)
-- Note: You'll need to run this separately or create the bucket in the Supabase dashboard
-- Storage > Create new bucket > Name: "task-files" > Public bucket: Yes

-- Storage policies for task-files bucket
-- These allow authenticated users to upload/read files
-- Run these after creating the bucket in the dashboard

-- Allow authenticated users to upload files
-- INSERT INTO storage.policies (bucket_id, name, definition)
-- VALUES (
--   'task-files',
--   'Allow authenticated users to upload',
--   'bucket_id = ''task-files'' AND auth.role() = ''authenticated'''
-- );

-- Allow public read access to files
-- INSERT INTO storage.policies (bucket_id, name, definition)
-- VALUES (
--   'task-files',
--   'Allow public read access',
--   'bucket_id = ''task-files'''
-- );

-- Update existing tasks to have empty attachments array
UPDATE tasks 
SET attachments = '[]'
WHERE attachments IS NULL;

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'tasks' AND column_name = 'attachments';
