-- RLS Policies for Voice Command Feature
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- Enable RLS on users table if not already enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own user record
CREATE POLICY "Users can read own record"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy: Users can read other users in the same organization
-- (Needed for voice commands that involve other workers/users)
CREATE POLICY "Users can read org members"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

-- Verify workers table has proper RLS (should already exist)
-- Users need to read workers in their organization for voice commands

-- Check if policy exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'workers' 
    AND policyname = 'Users can read org workers'
  ) THEN
    CREATE POLICY "Users can read org workers"
      ON workers
      FOR SELECT
      TO authenticated
      USING (
        org_id IN (
          SELECT org_id FROM users WHERE id = auth.uid()
        )
      );
  END IF;
END$$;

-- Check if policy exists for tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'tasks' 
    AND policyname = 'Users can read org tasks'
  ) THEN
    CREATE POLICY "Users can read org tasks"
      ON tasks
      FOR SELECT
      TO authenticated
      USING (
        org_id IN (
          SELECT org_id FROM users WHERE id = auth.uid()
        )
      );
  END IF;
END$$;

-- Check if policy exists for assignments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'assignments' 
    AND policyname = 'Users can manage org assignments'
  ) THEN
    CREATE POLICY "Users can manage org assignments"
      ON assignments
      FOR ALL
      TO authenticated
      USING (
        org_id IN (
          SELECT org_id FROM users WHERE id = auth.uid()
        )
      )
      WITH CHECK (
        org_id IN (
          SELECT org_id FROM users WHERE id = auth.uid()
        )
      );
  END IF;
END$$;

-- Grant necessary permissions
GRANT SELECT ON users TO authenticated;
GRANT SELECT ON workers TO authenticated;
GRANT SELECT ON tasks TO authenticated;
GRANT ALL ON assignments TO authenticated;

-- Verify policies are created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('users', 'workers', 'tasks', 'assignments')
ORDER BY tablename, policyname;
