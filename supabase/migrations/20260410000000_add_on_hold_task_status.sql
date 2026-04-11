-- ============================================================================
-- Migration 027: Add 'on_hold' to tasks.status and backfill prefix-named tasks
-- ============================================================================

BEGIN;

-- Step 1: Drop the existing status CHECK constraint if present.
-- The standard Supabase-generated name is tasks_status_check; IF EXISTS makes
-- this safe to run even if the constraint was never created or has a custom name.
ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_status_check;

-- Step 2: Re-add the constraint with 'on_hold' included.
ALTER TABLE tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('draft', 'planned', 'active', 'completed', 'on_hold'));

-- Step 3: Backfill any tasks that used the legacy "ON HOLD" name prefix.
-- Strip the prefix from the task name and set status = 'on_hold'.
-- Pattern matches: **ON HOLD**, *ON HOLD*, ON HOLD, ON HOLD -, etc.
UPDATE tasks
SET
  status = 'on_hold',
  name   = TRIM(REGEXP_REPLACE(
             name,
             '^\*{0,2}\s*ON\s+HOLD\s*\*{0,2}\s*[-–]?\s*',
             '',
             'i'
           ))
WHERE name ~* '^\*{0,2}\s*ON\s+HOLD';

COMMIT;
