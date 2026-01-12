-- Migration: Add carpenter and mason to worker roles
-- This updates the CHECK constraint on the workers table to include the new roles

-- Drop the existing constraint
ALTER TABLE workers DROP CONSTRAINT IF EXISTS workers_role_check;

-- Add the new constraint with all four roles
ALTER TABLE workers ADD CONSTRAINT workers_role_check 
  CHECK (role IN ('operator', 'laborer', 'carpenter', 'mason'));

-- Verify the change
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'workers'::regclass AND conname = 'workers_role_check';
