-- Add weekend work fields to tasks table
-- This allows individual tasks to include Saturday and/or Sunday work

ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS include_saturday BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS include_sunday BOOLEAN DEFAULT false;

-- Add comment
COMMENT ON COLUMN tasks.include_saturday IS 'Whether this task includes Saturday work';
COMMENT ON COLUMN tasks.include_sunday IS 'Whether this task includes Sunday work';

-- Set existing tasks to false by default
UPDATE tasks 
SET include_saturday = false, include_sunday = false 
WHERE include_saturday IS NULL OR include_sunday IS NULL;
