-- ============================================================================
-- CrewAI Command: Existing Data Migration
-- Version: 1.0.0
-- Date: 2026-01-13
-- Description: Migrates existing data to new multi-tenant structure
-- ============================================================================

-- IMPORTANT: Run this AFTER 001_multi_tenant_schema.sql
-- This script is idempotent and safe to run multiple times

BEGIN;

-- ============================================================================
-- STEP 1: ENSURE DEFAULT ORGANIZATION EXISTS
-- ============================================================================

-- Insert default organization if it doesn't exist
INSERT INTO organizations (id, name, slug)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'AIGA LLC', 'aiga-llc')
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  slug = COALESCE(organizations.slug, EXCLUDED.slug);

-- ============================================================================
-- STEP 2: CREATE DEFAULT JOB SITE
-- ============================================================================

-- Insert default job site for existing data
INSERT INTO job_sites (id, organization_id, name, status, description)
VALUES (
  '550e8400-e29b-41d4-a716-446655440001', 
  '550e8400-e29b-41d4-a716-446655440000', 
  'Default Site',
  'active',
  'Default job site for legacy data migration'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 3: UPDATE USER PROFILES
-- ============================================================================

-- Ensure all user profiles have an org_id
UPDATE user_profiles 
SET org_id = '550e8400-e29b-41d4-a716-446655440000'
WHERE org_id IS NULL;

-- Ensure all user profiles have a base_role
UPDATE user_profiles 
SET base_role = COALESCE(base_role, role, 'worker')
WHERE base_role IS NULL;

-- ============================================================================
-- STEP 4: CREATE JOB SITE ASSIGNMENTS FOR EXISTING USERS
-- ============================================================================

-- Create job site assignments for all non-admin users who don't have one
INSERT INTO job_site_assignments (user_id, job_site_id, role, start_date, is_active)
SELECT 
  up.id,
  '550e8400-e29b-41d4-a716-446655440001', -- Default job site
  CASE 
    WHEN up.base_role = 'superintendent' THEN 'superintendent'
    WHEN up.base_role = 'engineer' THEN 'engineer'
    WHEN up.base_role = 'foreman' THEN 'foreman'
    ELSE 'worker'
  END,
  CURRENT_DATE,
  true
FROM user_profiles up
WHERE up.base_role != 'admin'
  AND up.org_id = '550e8400-e29b-41d4-a716-446655440000'
  AND NOT EXISTS (
    SELECT 1 FROM job_site_assignments jsa 
    WHERE jsa.user_id = up.id AND jsa.is_active = true
  );

-- ============================================================================
-- STEP 5: UPDATE WORKERS WITH ORGANIZATION AND JOB SITE
-- ============================================================================

-- Set organization_id for workers that don't have it
UPDATE workers 
SET organization_id = '550e8400-e29b-41d4-a716-446655440000'
WHERE organization_id IS NULL;

-- Set job_site_id for workers that don't have it
UPDATE workers 
SET job_site_id = '550e8400-e29b-41d4-a716-446655440001'
WHERE job_site_id IS NULL
  AND organization_id = '550e8400-e29b-41d4-a716-446655440000';

-- ============================================================================
-- STEP 6: UPDATE TASKS WITH ORGANIZATION AND JOB SITE
-- ============================================================================

-- Set organization_id for tasks that don't have it
UPDATE tasks 
SET organization_id = '550e8400-e29b-41d4-a716-446655440000'
WHERE organization_id IS NULL;

-- Set job_site_id for tasks that don't have it
UPDATE tasks 
SET job_site_id = '550e8400-e29b-41d4-a716-446655440001'
WHERE job_site_id IS NULL
  AND organization_id = '550e8400-e29b-41d4-a716-446655440000';

-- ============================================================================
-- STEP 7: UPDATE ASSIGNMENTS WITH ORGANIZATION AND JOB SITE
-- ============================================================================

-- Set organization_id for assignments
UPDATE assignments 
SET organization_id = '550e8400-e29b-41d4-a716-446655440000'
WHERE organization_id IS NULL;

-- Set job_site_id based on the task's job_site_id
UPDATE assignments a
SET job_site_id = t.job_site_id
FROM tasks t
WHERE a.task_id = t.id
  AND a.job_site_id IS NULL
  AND t.job_site_id IS NOT NULL;

-- Fallback to default job site
UPDATE assignments 
SET job_site_id = '550e8400-e29b-41d4-a716-446655440001'
WHERE job_site_id IS NULL
  AND organization_id = '550e8400-e29b-41d4-a716-446655440000';

-- ============================================================================
-- STEP 8: UPDATE ASSIGNMENT REQUESTS WITH ORGANIZATION AND JOB SITE
-- ============================================================================

UPDATE assignment_requests 
SET organization_id = '550e8400-e29b-41d4-a716-446655440000'
WHERE organization_id IS NULL;

-- Set job_site_id based on the to_task's job_site_id
UPDATE assignment_requests ar
SET job_site_id = t.job_site_id
FROM tasks t
WHERE ar.to_task_id = t.id
  AND ar.job_site_id IS NULL
  AND t.job_site_id IS NOT NULL;

-- Fallback to default job site
UPDATE assignment_requests 
SET job_site_id = '550e8400-e29b-41d4-a716-446655440001'
WHERE job_site_id IS NULL
  AND organization_id = '550e8400-e29b-41d4-a716-446655440000';

-- ============================================================================
-- STEP 9: UPDATE DAILY HOURS (if table exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'daily_hours') THEN
    UPDATE daily_hours 
    SET organization_id = '550e8400-e29b-41d4-a716-446655440000'
    WHERE organization_id IS NULL;
    
    -- Set job_site_id based on task
    UPDATE daily_hours dh
    SET job_site_id = t.job_site_id
    FROM tasks t
    WHERE dh.task_id = t.id
      AND dh.job_site_id IS NULL
      AND t.job_site_id IS NOT NULL;
    
    -- Fallback to default job site
    UPDATE daily_hours 
    SET job_site_id = '550e8400-e29b-41d4-a716-446655440001'
    WHERE job_site_id IS NULL
      AND organization_id = '550e8400-e29b-41d4-a716-446655440000';
  END IF;
END $$;

-- ============================================================================
-- STEP 10: UPDATE TASK HISTORY (if table exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'task_history') THEN
    UPDATE task_history 
    SET organization_id = '550e8400-e29b-41d4-a716-446655440000'
    WHERE organization_id IS NULL;
    
    -- Set job_site_id based on task
    UPDATE task_history th
    SET job_site_id = t.job_site_id
    FROM tasks t
    WHERE th.task_id = t.id
      AND th.job_site_id IS NULL
      AND t.job_site_id IS NOT NULL;
    
    -- Fallback to default job site  
    UPDATE task_history 
    SET job_site_id = '550e8400-e29b-41d4-a716-446655440001'
    WHERE job_site_id IS NULL
      AND organization_id = '550e8400-e29b-41d4-a716-446655440000';
  END IF;
END $$;

-- ============================================================================
-- STEP 11: CREATE SAMPLE JOB SITES (Optional - for demo)
-- ============================================================================

-- Uncomment these if you want to create additional demo job sites

-- INSERT INTO job_sites (organization_id, name, address, status, description)
-- VALUES 
--   ('550e8400-e29b-41d4-a716-446655440000', 'HCC Excavation', '123 Main St, Honolulu, HI', 'active', 'Heavy civil construction excavation project'),
--   ('550e8400-e29b-41d4-a716-446655440000', 'Airport Site 5', 'Daniel K. Inouye Intl Airport', 'active', 'Runway extension project'),
--   ('550e8400-e29b-41d4-a716-446655440000', 'Downtown Concrete', '456 Bishop St, Honolulu, HI', 'active', 'Commercial building foundation')
-- ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERIES (run manually after migration)
-- ============================================================================

-- Check organizations
-- SELECT * FROM organizations;

-- Check job sites
-- SELECT * FROM job_sites;

-- Check user profiles with assignments
-- SELECT 
--   up.name, up.email, up.base_role, 
--   jsa.role as site_role, 
--   js.name as job_site 
-- FROM user_profiles up
-- LEFT JOIN job_site_assignments jsa ON jsa.user_id = up.id AND jsa.is_active = true
-- LEFT JOIN job_sites js ON js.id = jsa.job_site_id;

-- Check workers by job site
-- SELECT w.name, w.role, js.name as job_site 
-- FROM workers w
-- LEFT JOIN job_sites js ON js.id = w.job_site_id;

-- Check tasks by job site
-- SELECT t.name, t.status, js.name as job_site 
-- FROM tasks t
-- LEFT JOIN job_sites js ON js.id = t.job_site_id;

COMMIT;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'All existing data has been assigned to the default organization and job site.';
  RAISE NOTICE 'Run the verification queries above to confirm the migration.';
END $$;
