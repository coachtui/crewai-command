-- Add holiday work field to tasks table
-- This allows tasks to optionally work on Hawaii GCA holidays

ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS include_holidays BOOLEAN DEFAULT false;

-- Add comment
COMMENT ON COLUMN tasks.include_holidays IS 'Whether this task includes work on holidays (with premium pay rates)';

-- Set existing tasks to false by default
UPDATE tasks 
SET include_holidays = false 
WHERE include_holidays IS NULL;
