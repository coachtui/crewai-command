-- Add viewer role to the User type and create demo user
-- This allows read-only access to all data without editing capabilities

-- =============================================================================
-- SETUP INSTRUCTIONS (DO THIS FIRST!)
-- =============================================================================
-- 1. Find your org_id: SELECT id, name FROM organizations;
-- 2. Go to Supabase Dashboard → Authentication → Users → Add User
--    - Email: demo@example.com
--    - Password: DemoViewer123! (or your choice)
--    - Click "Create User"
-- 3. Copy the generated UUID from the new user
-- 4. Replace 'PASTE_AUTH_USER_ID_HERE' below with that UUID
-- 5. Replace 'PASTE_YOUR_ORG_ID_HERE' below with your org_id
-- 6. Run this entire SQL script
-- =============================================================================

-- Step 1: Update the users table constraint to allow 'viewer' role
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('admin', 'foreman', 'viewer'));

-- Step 2: Add the demo viewer user to the users table
INSERT INTO users (id, org_id, email, name, role)
VALUES 
  (
    'PASTE_AUTH_USER_ID_HERE', -- Replace with the UUID from Supabase Auth user you created
    'PASTE_YOUR_ORG_ID_HERE',   -- Replace with your actual org_id
    'demo@example.com',
    'Demo Viewer',
    'viewer'
  )
ON CONFLICT (id) DO NOTHING;

-- Step 3: Update RLS policies to allow viewers read-only access
-- The viewer role can SELECT from all tables but cannot INSERT, UPDATE, or DELETE

-- Workers table - allow viewers to read
CREATE POLICY "Viewers can view workers"
  ON workers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.org_id = workers.org_id
      AND users.role IN ('admin', 'foreman', 'viewer')
    )
  );

-- Tasks table - allow viewers to read
CREATE POLICY "Viewers can view tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.org_id = tasks.org_id
      AND users.role IN ('admin', 'foreman', 'viewer')
    )
  );

-- Assignments table - allow viewers to read
CREATE POLICY "Viewers can view assignments"
  ON assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.org_id = assignments.org_id
      AND users.role IN ('admin', 'foreman', 'viewer')
    )
  );

-- Daily hours table - allow viewers to read
CREATE POLICY "Viewers can view daily_hours"
  ON daily_hours FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.org_id = daily_hours.org_id
      AND users.role IN ('admin', 'foreman', 'viewer')
    )
  );

-- Assignment requests table - allow viewers to read
CREATE POLICY "Viewers can view assignment_requests"
  ON assignment_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.org_id = assignment_requests.org_id
      AND users.role IN ('admin', 'foreman', 'viewer')
    )
  );

-- Task history table - allow viewers to read
CREATE POLICY "Viewers can view task_history"
  ON task_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.org_id = task_history.org_id
      AND users.role IN ('admin', 'foreman', 'viewer')
    )
  );

-- Note: You may need to drop existing SELECT policies first if they conflict
-- Use these commands if needed:
-- DROP POLICY IF EXISTS "existing_policy_name" ON table_name;
