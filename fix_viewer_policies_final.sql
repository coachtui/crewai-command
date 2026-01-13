-- Final Fix for Viewer Access to Daily Hours
-- This script handles multiple policy conflicts and ensures viewer access

-- =============================================================================
-- PART 1: Drop ALL existing SELECT policies that might conflict
-- =============================================================================

-- Drop all SELECT policies on daily_hours table
DROP POLICY IF EXISTS "Users can view daily_hours in their organization" ON daily_hours;
DROP POLICY IF EXISTS "Users can view daily_hours in their org" ON daily_hours;
DROP POLICY IF EXISTS "Viewers can view daily_hours" ON daily_hours;
DROP POLICY IF EXISTS "Users can view daily hours in their organization" ON daily_hours;

-- Drop all SELECT policies on workers table
DROP POLICY IF EXISTS "Users can view workers in their org" ON workers;
DROP POLICY IF EXISTS "Users can view workers in their organization" ON workers;
DROP POLICY IF EXISTS "Viewers can view workers" ON workers;

-- Drop all SELECT policies on tasks table
DROP POLICY IF EXISTS "Users can view tasks in their org" ON tasks;
DROP POLICY IF EXISTS "Users can read org tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view tasks in their organization" ON tasks;
DROP POLICY IF EXISTS "Viewers can view tasks" ON tasks;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON tasks;

-- =============================================================================
-- PART 2: Create new comprehensive SELECT policies with viewer role included
-- =============================================================================

-- daily_hours SELECT policy
CREATE POLICY "Users can view daily_hours in their org"
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

-- workers SELECT policy  
CREATE POLICY "Users can view workers in their org"
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

-- tasks SELECT policy
CREATE POLICY "Users can view tasks in their org"
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

-- assignments SELECT policy (for completeness)
DROP POLICY IF EXISTS "Users can view assignments in their org" ON assignments;
DROP POLICY IF EXISTS "Users can view assignments in their organization" ON assignments;
DROP POLICY IF EXISTS "Viewers can view assignments" ON assignments;

CREATE POLICY "Users can view assignments in their org"
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

-- assignment_requests SELECT policy (for completeness)
DROP POLICY IF EXISTS "Users can view assignment_requests in their org" ON assignment_requests;
DROP POLICY IF EXISTS "Users can view assignment requests in their organization" ON assignment_requests;
DROP POLICY IF EXISTS "Viewers can view assignment_requests" ON assignment_requests;

CREATE POLICY "Users can view assignment_requests in their org"
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

-- =============================================================================
-- PART 3: Verify the viewer role constraint exists
-- =============================================================================

ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('admin', 'foreman', 'viewer'));

-- =============================================================================
-- PART 4: Verification - Run these to confirm it worked
-- =============================================================================

-- Check the new policies
SELECT 
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies 
WHERE tablename IN ('daily_hours', 'workers', 'tasks')
AND cmd = 'SELECT'
ORDER BY tablename, policyname;

-- Expected: Should show one SELECT policy per table with role = {authenticated}

-- Check if viewer user exists and has org_id
SELECT id, email, role, org_id, name
FROM users 
WHERE role = 'viewer';

-- Expected: Should show demo@example.com with a valid org_id (not NULL)

-- If org_id is NULL, you need to set it:
-- UPDATE users SET org_id = 'YOUR_ORG_ID_HERE' WHERE role = 'viewer';
