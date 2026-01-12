-- Fix INSERT permission for tasks table
-- Run this in Supabase SQL Editor

-- Drop and recreate tasks policy with INSERT permission
DROP POLICY IF EXISTS "Users can manage org tasks" ON tasks;

CREATE POLICY "Users can manage org tasks"
  ON tasks
  FOR ALL
  TO authenticated
  USING (org_id = public.get_user_org_id())
  WITH CHECK (org_id = public.get_user_org_id());

-- Verify the policy
SELECT tablename, policyname, cmd, permissive 
FROM pg_policies 
WHERE tablename = 'tasks';
