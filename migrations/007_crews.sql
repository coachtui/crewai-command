-- ============================================================================
-- Migration 007: Crew Grouping System
-- Adds crews table and crew_id to workers for named crew management
-- per-job-site, company-scoped, RLS matches existing table patterns
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: CREATE CREWS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS crews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_site_id UUID NOT NULL REFERENCES job_sites(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crews_job_site ON crews(job_site_id);
CREATE INDEX IF NOT EXISTS idx_crews_org ON crews(organization_id);

-- ============================================================================
-- PART 2: ADD crew_id TO WORKERS
-- NULL = Unassigned (no crew). Existing workers are unaffected.
-- ============================================================================

ALTER TABLE workers ADD COLUMN IF NOT EXISTS crew_id UUID REFERENCES crews(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workers_crew ON workers(crew_id);

-- ============================================================================
-- PART 3: ENABLE RLS ON CREWS
-- ============================================================================

ALTER TABLE crews ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (safe for re-runs)
DROP POLICY IF EXISTS "crews_view_policy" ON crews;
DROP POLICY IF EXISTS "crews_manage_policy" ON crews;

-- SELECT: org members with job site access can view crews for their sites
CREATE POLICY "crews_view_policy" ON crews
  FOR SELECT USING (
    organization_id = get_user_org_id()
    AND (
      is_user_admin()
      OR job_site_id = ANY(get_user_job_site_ids())
    )
  );

-- INSERT/UPDATE/DELETE: admins and superintendents only
CREATE POLICY "crews_manage_policy" ON crews
  FOR ALL USING (
    organization_id = get_user_org_id()
    AND (
      is_user_admin()
      OR (
        job_site_id = ANY(get_user_job_site_ids())
        AND get_user_site_role(job_site_id) IN ('superintendent', 'engineer_as_superintendent')
      )
    )
  );

COMMIT;
