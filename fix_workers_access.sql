-- Enable voice commands to access workers, tasks, and assignments
-- Run this in Supabase SQL Editor

-- Enable RLS on tables if not already enabled
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can read org workers" ON workers;
DROP POLICY IF EXISTS "Users can manage org workers" ON workers;
DROP POLICY IF EXISTS "Users can read org tasks" ON tasks;
DROP POLICY IF EXISTS "Users can manage org tasks" ON tasks;
DROP POLICY IF EXISTS "Users can manage org assignments" ON assignments;

-- Workers policies
CREATE POLICY "Users can read org workers"
  ON workers
  FOR SELECT
  TO authenticated
  USING (org_id = public.get_user_org_id());

CREATE POLICY "Users can manage org workers"
  ON workers
  FOR ALL
  TO authenticated
  USING (org_id = public.get_user_org_id())
  WITH CHECK (org_id = public.get_user_org_id());

-- Tasks policies
CREATE POLICY "Users can read org tasks"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (org_id = public.get_user_org_id());

CREATE POLICY "Users can manage org tasks"
  ON tasks
  FOR ALL
  TO authenticated
  USING (org_id = public.get_user_org_id())
  WITH CHECK (org_id = public.get_user_org_id());

-- Assignments policies
CREATE POLICY "Users can manage org assignments"
  ON assignments
  FOR ALL
  TO authenticated
  USING (org_id = public.get_user_org_id())
  WITH CHECK (org_id = public.get_user_org_id());

-- Verify all users have org_id set
SELECT id, email, org_id, role 
FROM users 
WHERE org_id IS NULL;

-- If the above returns rows, those users need org_id assigned!
