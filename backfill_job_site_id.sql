-- ============================================================================
-- CrewAI Command: Backfill job_site_id for Multi-Tenant Architecture
-- ============================================================================
-- This script assigns the specified job site to all existing workers, tasks,
-- and related data to enable job site filtering.
--
-- IMPORTANT: Review and test in a development environment first!
-- ============================================================================

-- Set the job site ID to assign to all existing data
\set JOB_SITE_ID '82c30df1-d4c2-45cf-9761-e51a04564640'

-- ============================================================================
-- STEP 1: Verify the job site exists
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM job_sites WHERE id = :'JOB_SITE_ID') THEN
        RAISE EXCEPTION 'Job site % does not exist. Please create it first or update the JOB_SITE_ID variable.', :'JOB_SITE_ID';
    END IF;
    RAISE NOTICE 'Job site % exists. Proceeding with backfill...', :'JOB_SITE_ID';
END $$;

-- ============================================================================
-- STEP 2: Update workers table
-- ============================================================================
-- Assign all workers without a job_site_id to the specified job site
UPDATE workers
SET job_site_id = :'JOB_SITE_ID'
WHERE job_site_id IS NULL;

-- Report results
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % workers with job_site_id', updated_count;
END $$;

-- ============================================================================
-- STEP 3: Update tasks table
-- ============================================================================
-- Assign all tasks without a job_site_id to the specified job site
UPDATE tasks
SET job_site_id = :'JOB_SITE_ID'
WHERE job_site_id IS NULL;

-- Report results
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % tasks with job_site_id', updated_count;
END $$;

-- ============================================================================
-- STEP 4: Update task_drafts table (if it exists and has job_site_id column)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'task_drafts' AND column_name = 'job_site_id'
    ) THEN
        EXECUTE 'UPDATE task_drafts SET job_site_id = $1 WHERE job_site_id IS NULL'
        USING :'JOB_SITE_ID';
        RAISE NOTICE 'Updated task_drafts with job_site_id';
    ELSE
        RAISE NOTICE 'Skipping task_drafts - job_site_id column does not exist';
    END IF;
END $$;

-- ============================================================================
-- STEP 5: Verify assignments are linked to tasks
-- ============================================================================
-- Assignments don't have a direct job_site_id, but are filtered via task join
-- This query verifies all assignments are linked to valid tasks
DO $$
DECLARE
    orphaned_assignments INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphaned_assignments
    FROM assignments a
    LEFT JOIN tasks t ON a.task_id = t.id
    WHERE t.id IS NULL;

    IF orphaned_assignments > 0 THEN
        RAISE WARNING 'Found % assignments without valid tasks - these may need cleanup', orphaned_assignments;
    ELSE
        RAISE NOTICE 'All assignments are properly linked to tasks';
    END IF;
END $$;

-- ============================================================================
-- STEP 6: Summary report
-- ============================================================================
SELECT
    'Workers' AS table_name,
    COUNT(*) AS total_records,
    COUNT(CASE WHEN job_site_id = :'JOB_SITE_ID' THEN 1 END) AS assigned_to_job_site,
    COUNT(CASE WHEN job_site_id IS NULL THEN 1 END) AS missing_job_site_id
FROM workers
UNION ALL
SELECT
    'Tasks' AS table_name,
    COUNT(*) AS total_records,
    COUNT(CASE WHEN job_site_id = :'JOB_SITE_ID' THEN 1 END) AS assigned_to_job_site,
    COUNT(CASE WHEN job_site_id IS NULL THEN 1 END) AS missing_job_site_id
FROM tasks
UNION ALL
SELECT
    'Assignments' AS table_name,
    COUNT(*) AS total_records,
    COUNT(CASE WHEN t.job_site_id = :'JOB_SITE_ID' THEN 1 END) AS assigned_to_job_site,
    COUNT(CASE WHEN t.job_site_id IS NULL THEN 1 END) AS missing_job_site_id
FROM assignments a
LEFT JOIN tasks t ON a.task_id = t.id;

-- ============================================================================
-- OPTIONAL: Verify data integrity
-- ============================================================================
-- Check for workers without organization_id
SELECT COUNT(*) AS workers_without_org_id
FROM workers
WHERE organization_id IS NULL;

-- Check for tasks without organization_id
SELECT COUNT(*) AS tasks_without_org_id
FROM tasks
WHERE organization_id IS NULL;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ============================================================================
-- If you need to undo this operation, run:
--
-- UPDATE workers SET job_site_id = NULL WHERE job_site_id = '82c30df1-d4c2-45cf-9761-e51a04564640';
-- UPDATE tasks SET job_site_id = NULL WHERE job_site_id = '82c30df1-d4c2-45cf-9761-e51a04564640';
--
-- ============================================================================

RAISE NOTICE 'Backfill complete! Review the summary report above.';
