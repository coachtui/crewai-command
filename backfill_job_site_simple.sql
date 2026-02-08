-- ============================================================================
-- CrewAI Command: Simple Backfill Script for job_site_id
-- ============================================================================
-- This is a simplified version that can be run directly in Supabase SQL Editor
-- or any PostgreSQL client without variable substitution.
--
-- INSTRUCTIONS:
-- 1. Replace '82c30df1-d4c2-45cf-9761-e51a04564640' with your actual job site ID
-- 2. Review the queries below
-- 3. Run each section sequentially
-- ============================================================================

-- ============================================================================
-- SECTION 1: Verify the job site exists
-- ============================================================================
SELECT id, name, status
FROM job_sites
WHERE id = '82c30df1-d4c2-45cf-9761-e51a04564640';
-- If this returns no rows, you need to create the job site first!

-- ============================================================================
-- SECTION 2: Update workers
-- ============================================================================
-- Preview: See which workers will be updated
SELECT id, name, role, job_site_id, organization_id
FROM workers
WHERE job_site_id IS NULL;

-- Execute: Update all workers to the specified job site
UPDATE workers
SET job_site_id = '82c30df1-d4c2-45cf-9761-e51a04564640'
WHERE job_site_id IS NULL;
-- Check how many rows were updated in the result

-- ============================================================================
-- SECTION 3: Update tasks
-- ============================================================================
-- Preview: See which tasks will be updated
SELECT id, name, status, job_site_id, organization_id
FROM tasks
WHERE job_site_id IS NULL;

-- Execute: Update all tasks to the specified job site
UPDATE tasks
SET job_site_id = '82c30df1-d4c2-45cf-9761-e51a04564640'
WHERE job_site_id IS NULL;
-- Check how many rows were updated in the result

-- ============================================================================
-- SECTION 4: Update task_drafts (if the table exists)
-- ============================================================================
-- Preview: See which task drafts will be updated
SELECT id, name, job_site_id, organization_id
FROM task_drafts
WHERE job_site_id IS NULL;

-- Execute: Update all task drafts to the specified job site
UPDATE task_drafts
SET job_site_id = '82c30df1-d4c2-45cf-9761-e51a04564640'
WHERE job_site_id IS NULL;
-- Check how many rows were updated in the result

-- ============================================================================
-- SECTION 5: Verification - Summary Report
-- ============================================================================
-- Check the distribution of data across job sites
SELECT
    'Workers' AS table_name,
    COUNT(*) AS total_records,
    COUNT(CASE WHEN job_site_id = '82c30df1-d4c2-45cf-9761-e51a04564640' THEN 1 END) AS assigned_to_target_site,
    COUNT(CASE WHEN job_site_id IS NOT NULL AND job_site_id != '82c30df1-d4c2-45cf-9761-e51a04564640' THEN 1 END) AS assigned_to_other_sites,
    COUNT(CASE WHEN job_site_id IS NULL THEN 1 END) AS missing_job_site_id
FROM workers

UNION ALL

SELECT
    'Tasks' AS table_name,
    COUNT(*) AS total_records,
    COUNT(CASE WHEN job_site_id = '82c30df1-d4c2-45cf-9761-e51a04564640' THEN 1 END) AS assigned_to_target_site,
    COUNT(CASE WHEN job_site_id IS NOT NULL AND job_site_id != '82c30df1-d4c2-45cf-9761-e51a04564640' THEN 1 END) AS assigned_to_other_sites,
    COUNT(CASE WHEN job_site_id IS NULL THEN 1 END) AS missing_job_site_id
FROM tasks;

-- ============================================================================
-- SECTION 6: Verify Assignments (via Task Join)
-- ============================================================================
-- Check that all assignments are linked to tasks with job_site_id
SELECT
    COUNT(*) AS total_assignments,
    COUNT(CASE WHEN t.job_site_id = '82c30df1-d4c2-45cf-9761-e51a04564640' THEN 1 END) AS for_target_site,
    COUNT(CASE WHEN t.job_site_id IS NULL THEN 1 END) AS tasks_missing_site,
    COUNT(CASE WHEN t.id IS NULL THEN 1 END) AS orphaned_assignments
FROM assignments a
LEFT JOIN tasks t ON a.task_id = t.id;

-- ============================================================================
-- SECTION 7: Verify Daily Hours (via Worker Join)
-- ============================================================================
-- Check that all daily hours are linked to workers with job_site_id
SELECT
    COUNT(*) AS total_daily_hours,
    COUNT(CASE WHEN w.job_site_id = '82c30df1-d4c2-45cf-9761-e51a04564640' THEN 1 END) AS for_target_site,
    COUNT(CASE WHEN w.job_site_id IS NULL THEN 1 END) AS workers_missing_site,
    COUNT(CASE WHEN w.id IS NULL THEN 1 END) AS orphaned_hours
FROM daily_hours dh
LEFT JOIN workers w ON dh.worker_id = w.id;

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================
-- Uncomment and run these queries if you need to undo the changes:

-- UPDATE workers
-- SET job_site_id = NULL
-- WHERE job_site_id = '82c30df1-d4c2-45cf-9761-e51a04564640';

-- UPDATE tasks
-- SET job_site_id = NULL
-- WHERE job_site_id = '82c30df1-d4c2-45cf-9761-e51a04564640';

-- UPDATE task_drafts
-- SET job_site_id = NULL
-- WHERE job_site_id = '82c30df1-d4c2-45cf-9761-e51a04564640';

-- ============================================================================
-- COMPLETE! ✓
-- ============================================================================
