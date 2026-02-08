-- ============================================================================
-- FIX TASKS TABLE - Complete migration to match application requirements
-- Run this in Supabase SQL Editor to fix the 400 error when submitting tasks
-- ============================================================================

-- Step 1: Ensure all required columns exist in tasks table
-- Base columns (from SUPABASE_SETUP.md)
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS required_operators INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS required_laborers INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'planned',
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS org_id UUID,
ADD COLUMN IF NOT EXISTS created_by UUID,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Additional columns (from migration files)
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS required_carpenters INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS required_masons INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS include_saturday BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS include_sunday BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS include_holidays BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';

-- Multi-tenant columns
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS job_site_id UUID,
ADD COLUMN IF NOT EXISTS organization_id UUID,
ADD COLUMN IF NOT EXISTS modified_by UUID,
ADD COLUMN IF NOT EXISTS modified_at TIMESTAMPTZ;

-- Step 2: Add foreign key constraints if they don't exist
DO $$
BEGIN
  -- Add org_id foreign key if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_org_id_fkey'
  ) THEN
    ALTER TABLE tasks
    ADD CONSTRAINT tasks_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;

  -- Add created_by foreign key if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_created_by_fkey'
  ) THEN
    ALTER TABLE tasks
    ADD CONSTRAINT tasks_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- Add modified_by foreign key if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_modified_by_fkey'
  ) THEN
    ALTER TABLE tasks
    ADD CONSTRAINT tasks_modified_by_fkey
    FOREIGN KEY (modified_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- Add job_site_id foreign key if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_job_site_id_fkey'
  ) THEN
    ALTER TABLE tasks
    ADD CONSTRAINT tasks_job_site_id_fkey
    FOREIGN KEY (job_site_id) REFERENCES job_sites(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL; -- If job_sites doesn't exist, skip the constraint
END $$;

-- Step 3: Add check constraints
DO $$
BEGIN
  -- Status check constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_status_check'
  ) THEN
    ALTER TABLE tasks
    ADD CONSTRAINT tasks_status_check
    CHECK (status IN ('planned', 'active', 'completed'));
  END IF;

  -- Date validation constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_valid_dates'
  ) THEN
    ALTER TABLE tasks
    ADD CONSTRAINT tasks_valid_dates
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- Constraint already exists
END $$;

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_org_id ON tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_tasks_organization_id ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_job_site_id ON tasks(job_site_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_dates ON tasks(start_date, end_date);

-- Step 5: Sync organization_id with org_id for backward compatibility
UPDATE tasks
SET organization_id = org_id
WHERE organization_id IS NULL AND org_id IS NOT NULL;

UPDATE tasks
SET org_id = organization_id
WHERE org_id IS NULL AND organization_id IS NOT NULL;

-- Step 6: Set default values for existing records
UPDATE tasks
SET required_operators = 0 WHERE required_operators IS NULL;

UPDATE tasks
SET required_laborers = 0 WHERE required_laborers IS NULL;

UPDATE tasks
SET required_carpenters = 0 WHERE required_carpenters IS NULL;

UPDATE tasks
SET required_masons = 0 WHERE required_masons IS NULL;

UPDATE tasks
SET include_saturday = false WHERE include_saturday IS NULL;

UPDATE tasks
SET include_sunday = false WHERE include_sunday IS NULL;

UPDATE tasks
SET include_holidays = false WHERE include_holidays IS NULL;

UPDATE tasks
SET attachments = '[]' WHERE attachments IS NULL;

UPDATE tasks
SET status = 'planned' WHERE status IS NULL;

-- Step 7: Drop and recreate RLS policies for INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Users can manage org tasks" ON tasks;
DROP POLICY IF EXISTS "tasks_view_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_manage_policy" ON tasks;
DROP POLICY IF EXISTS "Users can insert tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete tasks" ON tasks;

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Create comprehensive RLS policies

-- SELECT: Users can view tasks in their organization or assigned job sites
CREATE POLICY "tasks_select_policy" ON tasks
  FOR SELECT
  TO authenticated
  USING (
    -- User's org_id matches (backward compatibility)
    (org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
      UNION
      SELECT org_id FROM user_profiles WHERE id = auth.uid()
    ))
    OR
    -- User's organization_id matches (new schema)
    (organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    ))
    OR
    -- User has access to the job site
    (job_site_id IN (
      SELECT job_site_id FROM job_site_assignments
      WHERE user_id = auth.uid() AND is_active = true
    ))
  );

-- INSERT: Authenticated users can insert tasks in their organization
CREATE POLICY "tasks_insert_policy" ON tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow if org_id matches user's org (backward compatibility)
    (org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
      UNION
      SELECT org_id FROM user_profiles WHERE id = auth.uid()
    ))
    OR
    -- Allow if organization_id matches user's org (new schema)
    (organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    ))
    OR
    -- Allow if creating with org_id set to user's org (for new records)
    (org_id = (SELECT org_id FROM users WHERE id = auth.uid() LIMIT 1))
    OR
    (org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1))
  );

-- UPDATE: Users can update tasks in their organization
CREATE POLICY "tasks_update_policy" ON tasks
  FOR UPDATE
  TO authenticated
  USING (
    (org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
      UNION
      SELECT org_id FROM user_profiles WHERE id = auth.uid()
    ))
    OR
    (organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    ))
  )
  WITH CHECK (
    (org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
      UNION
      SELECT org_id FROM user_profiles WHERE id = auth.uid()
    ))
    OR
    (organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    ))
  );

-- DELETE: Users can delete tasks in their organization
CREATE POLICY "tasks_delete_policy" ON tasks
  FOR DELETE
  TO authenticated
  USING (
    (org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
      UNION
      SELECT org_id FROM user_profiles WHERE id = auth.uid()
    ))
    OR
    (organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    ))
  );

-- Step 8: Add trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.modified_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tasks_modified_at ON tasks;
CREATE TRIGGER update_tasks_modified_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_tasks_updated_at();

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check all columns exist
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'tasks'
ORDER BY ordinal_position;

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'tasks';

-- Check constraints
SELECT conname, contype, pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'tasks'::regclass;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Tasks table migration complete!';
  RAISE NOTICE 'All required columns have been added.';
  RAISE NOTICE 'RLS policies have been updated to allow INSERT/UPDATE/DELETE.';
  RAISE NOTICE 'You can now create tasks from your application.';
END $$;
