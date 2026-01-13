-- Diagnostic Script for Viewer Access Issues
-- Run this in Supabase SQL Editor to diagnose the problem

-- =============================================================================
-- STEP 1: Check if the viewer user exists and is properly configured
-- =============================================================================
SELECT 
    'Viewer User Check' as check_name,
    id, 
    email, 
    role, 
    org_id,
    name
FROM users 
WHERE role = 'viewer';

-- Expected: Should show demo@example.com with role='viewer' and a valid org_id

-- =============================================================================
-- STEP 2: Check all users in the same org as the viewer
-- =============================================================================
SELECT 
    'Users in Same Org' as check_name,
    u.email,
    u.role,
    u.org_id,
    o.name as org_name
FROM users u
LEFT JOIN organizations o ON o.id = u.org_id
WHERE u.org_id = (SELECT org_id FROM users WHERE role = 'viewer' LIMIT 1);

-- Expected: Should show all users including the viewer in the same organization

-- =============================================================================
-- STEP 3: Check workers in the viewer's org
-- =============================================================================
SELECT 
    'Workers in Viewer Org' as check_name,
    COUNT(*) as worker_count,
    org_id
FROM workers
WHERE org_id = (SELECT org_id FROM users WHERE role = 'viewer' LIMIT 1)
GROUP BY org_id;

-- Expected: Should show count > 0 if workers exist

-- =============================================================================
-- STEP 4: Check daily_hours records in the viewer's org
-- =============================================================================
SELECT 
    'Daily Hours in Viewer Org' as check_name,
    COUNT(*) as hours_count,
    org_id
FROM daily_hours
WHERE org_id = (SELECT org_id FROM users WHERE role = 'viewer' LIMIT 1)
GROUP BY org_id;

-- Expected: Should show count > 0 if hours have been logged

-- =============================================================================
-- STEP 5: Check RLS policies on workers table
-- =============================================================================
SELECT 
    'Workers Table Policies' as check_name,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'workers';

-- Expected: Should show a SELECT policy that includes 'viewer' role check

-- =============================================================================
-- STEP 6: Check RLS policies on daily_hours table
-- =============================================================================
SELECT 
    'Daily Hours Table Policies' as check_name,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'daily_hours';

-- Expected: Should show a SELECT policy that includes 'viewer' role check

-- =============================================================================
-- STEP 7: Check RLS policies on tasks table
-- =============================================================================
SELECT 
    'Tasks Table Policies' as check_name,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'tasks';

-- Expected: Should show a SELECT policy that includes 'viewer' role check

-- =============================================================================
-- STEP 8: Test if RLS is enabled on tables
-- =============================================================================
SELECT 
    'RLS Status' as check_name,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('workers', 'daily_hours', 'tasks', 'users', 'assignments')
ORDER BY tablename;

-- Expected: rls_enabled should be true (t) for all tables

-- =============================================================================
-- STEP 9: Check the users table role constraint
-- =============================================================================
SELECT 
    'Users Role Constraint' as check_name,
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'users'::regclass
AND conname LIKE '%role%';

-- Expected: Should show constraint allowing 'viewer' role

-- =============================================================================
-- STEP 10: Simulate viewer access (run as superuser to see what viewer would see)
-- =============================================================================
-- This simulates what the viewer user would see
-- Note: This only works if run as superuser/postgres role

-- Check if viewer can theoretically see workers
SELECT 
    'Simulated Viewer Worker Access' as check_name,
    w.*
FROM workers w
WHERE EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT id FROM users WHERE role = 'viewer' LIMIT 1)
    AND users.org_id = w.org_id
    AND users.role IN ('admin', 'foreman', 'viewer')
)
LIMIT 5;

-- Expected: Should return some workers if policies are correct

-- =============================================================================
-- TROUBLESHOOTING NOTES
-- =============================================================================
-- 
-- If Step 1 shows no viewer user:
--   - Run add_viewer_role_and_demo_user.sql first
--
-- If Step 1 shows viewer but org_id is NULL:
--   - Update the viewer user's org_id to match an existing organization
--   - UPDATE users SET org_id = 'YOUR_ORG_ID' WHERE role = 'viewer';
--
-- If Step 5-7 show no policies or policies without 'viewer':
--   - Run enable_viewer_access_to_hours.sql
--
-- If Step 8 shows rls_enabled = false:
--   - RLS needs to be enabled: ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
--
-- If Step 10 returns no data but workers exist:
--   - The policy logic might have an issue
--   - Check that the viewer user has the correct org_id
--   - Ensure the policy includes: users.role IN ('admin', 'foreman', 'viewer')
