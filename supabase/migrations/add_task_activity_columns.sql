-- Add activity_id, activity_name, and duration columns to tasks table
-- Run this in your Supabase SQL Editor

-- Make start_date and end_date nullable (so CSV imports work without dates)
ALTER TABLE tasks ALTER COLUMN start_date DROP NOT NULL;
ALTER TABLE tasks ALTER COLUMN end_date DROP NOT NULL;

-- Add columns to tasks table
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS activity_id TEXT,
ADD COLUMN IF NOT EXISTS activity_name TEXT,
ADD COLUMN IF NOT EXISTS duration INTEGER; -- Duration in days

-- Add columns to task_drafts table as well
ALTER TABLE task_drafts
ADD COLUMN IF NOT EXISTS activity_id TEXT,
ADD COLUMN IF NOT EXISTS activity_name TEXT,
ADD COLUMN IF NOT EXISTS duration INTEGER;

-- Create index on activity_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_tasks_activity_id ON tasks(activity_id);

-- Optional: Add comment to clarify duration column
COMMENT ON COLUMN tasks.duration IS 'Duration in days';
COMMENT ON COLUMN tasks.activity_id IS 'Activity ID from project schedule (e.g., A1000)';
COMMENT ON COLUMN tasks.activity_name IS 'Activity name from project schedule';
