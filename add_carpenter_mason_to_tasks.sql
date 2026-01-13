-- Add required_carpenters and required_masons columns to tasks table

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS required_carpenters INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS required_masons INTEGER DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN tasks.required_carpenters IS 'Number of carpenters required for this task';
COMMENT ON COLUMN tasks.required_masons IS 'Number of masons required for this task';
