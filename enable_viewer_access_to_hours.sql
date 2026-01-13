-- Enable Viewer Access to Daily Hours and Weekly Hours
-- Run this in your Supabase SQL Editor

-- =============================================================================
-- This script adds viewer role access to daily_hours and workers tables
-- =============================================================================

-- Step 1: Drop existing SELECT policies and recreate them with viewer access
-- Workers table
DROP POLICY IF EXISTS "Users can view workers in their org" ON workers;
DROP POLICY IF EXISTS "Viewers can view workers" ON workers;

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

-- Daily hours table
DROP POLICY IF EXISTS "Users can view daily_hours in their org" ON daily_hours;
DROP POLICY IF EXISTS "Viewers can view daily_hours" ON daily_hours;

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

-- Tasks table (needed for daily hours to show task names)
DROP POLICY IF EXISTS "Users can view tasks in their org" ON tasks;
DROP POLICY IF EXISTS "Viewers can view tasks" ON tasks;

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

-- Assignments table (optional, but good for consistency)
DROP POLICY IF EXISTS "Users can view assignments in their org" ON assignments;
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

-- Assignment requests table (optional, but good for consistency)
DROP POLICY IF EXISTS "Users can view assignment_requests in their org" ON assignment_requests;
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

-- Verify the viewer role constraint exists
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('admin', 'foreman', 'viewer'));

-- =============================================================================
-- VERIFICATION QUERIES - Run these to confirm it works
-- =============================================================================

-- 1. Check if viewer user exists
-- SELECT id, email, role, org_id FROM users WHERE role = 'viewer';

-- 2. Check policies on daily_hours table
-- SELECT schemaname, tablename, policyname, roles, cmd 
-- FROM pg_policies 
-- WHERE tablename = 'daily_hours';

-- 3. Check policies on workers table
-- SELECT schemaname, tablename, policyname, roles, cmd 
-- FROM pg_policies 
-- WHERE tablename = 'workers';

-- 4. Check policies on tasks table
-- SELECT schemaname, tablename, policyname, roles, cmd 
-- FROM pg_policies 
-- WHERE tablename = 'tasks';
