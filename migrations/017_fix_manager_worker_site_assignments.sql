-- ============================================================================
-- Migration 017: Fix Manager Role — worker_site_assignments RLS
--
-- Problem: Migration 013 created the manage policy for worker_site_assignments
-- with roles ('admin', 'superintendent', 'engineer', 'foreman') — missing
-- 'manager'. This blocks managers from adding/removing worker site assignments.
--
-- Fix: Drop and recreate the policy with 'manager' included.
-- ============================================================================

DROP POLICY IF EXISTS "managers can manage worker site assignments" ON worker_site_assignments;

CREATE POLICY "managers can manage worker site assignments"
  ON worker_site_assignments FOR ALL
  USING (
    get_user_base_role() IN ('manager', 'admin', 'superintendent', 'engineer', 'foreman')
    AND worker_id IN (
      SELECT id FROM workers
      WHERE organization_id = get_user_org_id()
    )
  );
