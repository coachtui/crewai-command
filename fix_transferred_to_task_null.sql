-- Allow NULL values for transferred_to_task_id in daily_hours table
-- This enables transfers without a specific task assignment

-- Make transferred_to_task_id nullable if it isn't already
ALTER TABLE daily_hours 
ALTER COLUMN transferred_to_task_id DROP NOT NULL;

-- Verify the change
SELECT column_name, is_nullable, data_type 
FROM information_schema.columns 
WHERE table_name = 'daily_hours' 
AND column_name = 'transferred_to_task_id';
