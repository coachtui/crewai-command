-- Migration: Fix RLS policy to allow managing unassigned workers
-- Description: Updates the workers_admin_manage_policy to include NULL job_site_id
--              This allows non-admin users to create and manage workers before they're assigned to a site
-- Date: 2026-02-06

-- Drop the existing manage policy
DROP POLICY IF EXISTS "workers_admin_manage_policy" ON workers;

-- Recreate with support for unassigned workers
CREATE POLICY "workers_admin_manage_policy" ON workers
  FOR ALL USING (
    organization_id = get_user_org_id()
    AND (
      is_user_admin()
      OR job_site_id IS NULL
      OR (
        job_site_id = ANY(get_user_job_site_ids())
        AND get_user_site_role(job_site_id) IN ('superintendent', 'engineer_as_superintendent')
      )
    )
  );

-- Explanation of the policy:
-- 1. All operations (INSERT, UPDATE, DELETE) are allowed if:
--    a. User belongs to the same organization as the worker (organization_id), AND
--    b. One of the following is true:
--       - User is an admin (can manage all workers)
--       - Worker has no job site assignment (job_site_id IS NULL) - allows managing unassigned workers
--       - Worker is assigned to a job site the user has access to AND user has superintendent/engineer role
--
-- This matches the SELECT policy (workers_org_access_policy) which already includes the NULL check.
