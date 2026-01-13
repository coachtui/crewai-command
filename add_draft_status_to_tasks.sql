-- Add 'draft' status to tasks table status enum
-- Run this in Supabase SQL Editor

-- First, check if the constraint exists and what it's called
-- Then alter the constraint to include 'draft'

-- For PostgreSQL, we need to drop and recreate the constraint
ALTER TABLE tasks 
DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE tasks 
ADD CONSTRAINT tasks_status_check 
CHECK (status IN ('draft', 'planned', 'active', 'completed'));

-- Verification
SELECT 'Draft status added to tasks table' as status;
