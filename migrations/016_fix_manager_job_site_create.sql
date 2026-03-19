-- ============================================================================
-- Migration 016: Fix Manager Role — Job Site CREATE Permission
--
-- Problem: Managers (base_role = 'manager') cannot create job sites.
--   - The job_sites RLS policy may still check is_user_admin() instead of
--     is_user_manager(), blocking managers from INSERT.
--   - This migration idempotently re-applies the correct policies.
--
-- Role hierarchy (authoritative):
--   manager  → company-wide authority (create/manage all job sites in org)
--   admin    → job-site-scoped authority (manage within assigned sites only)
-- ============================================================================

-- ============================================================================
-- PART 1: ENSURE is_user_manager() EXISTS
-- ============================================================================

CREATE OR REPLACE FUNCTION is_user_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT base_role = 'manager' FROM user_profiles WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- PART 2: FIX job_sites RLS POLICY
--
-- Drop and recreate "job_sites_admin_policy" so it allows managers to perform
-- ALL operations (SELECT, INSERT, UPDATE, DELETE) on their org's sites.
-- Admins fall through to "job_sites_assigned_view_policy" (SELECT only on
-- their assigned sites).
-- ============================================================================

DROP POLICY IF EXISTS "job_sites_admin_policy" ON job_sites;

CREATE POLICY "job_sites_admin_policy" ON job_sites
  FOR ALL USING (
    organization_id = get_user_org_id() AND is_user_manager()
  )
  WITH CHECK (
    organization_id = get_user_org_id() AND is_user_manager()
  );

-- ============================================================================
-- VERIFICATION QUERIES
-- Run these in Supabase SQL editor after applying:
--
-- 1. Confirm is_user_manager() exists:
--    SELECT proname FROM pg_proc WHERE proname = 'is_user_manager';
--
-- 2. Confirm job_sites policies:
--    SELECT policyname, cmd, qual, with_check
--    FROM pg_policies WHERE tablename = 'job_sites' ORDER BY policyname;
--    Expected:
--      job_sites_admin_policy     — ALL  — manager check (USING + WITH CHECK)
--      job_sites_assigned_view_policy — SELECT — assigned sites
-- ============================================================================
