-- ============================================================================
-- Migration 008: Site Events Calendar
-- Adds site_events table for scheduled events with no manpower
-- (pours, paving, inspections, tie-ins, etc.)
-- company + job_site scoped, RLS matches existing table patterns
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: CREATE SITE_EVENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS site_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_site_id UUID NOT NULL REFERENCES job_sites(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  start_time TIME,             -- optional, e.g. 06:00
  location TEXT,               -- area on site, e.g. "Grid C4 - Foundation"
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_events_job_site ON site_events(job_site_id);
CREATE INDEX IF NOT EXISTS idx_site_events_org ON site_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_site_events_date ON site_events(event_date);

-- ============================================================================
-- PART 2: ENABLE RLS ON SITE_EVENTS
-- ============================================================================

ALTER TABLE site_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (safe for re-runs)
DROP POLICY IF EXISTS "site_events_view_policy" ON site_events;
DROP POLICY IF EXISTS "site_events_manage_policy" ON site_events;

-- SELECT: all org members with job site access can view events
CREATE POLICY "site_events_view_policy" ON site_events
  FOR SELECT USING (
    organization_id = get_user_org_id()
    AND (
      is_user_admin()
      OR job_site_id = ANY(get_user_job_site_ids())
    )
  );

-- INSERT/UPDATE/DELETE: admins, superintendents, engineers only
CREATE POLICY "site_events_manage_policy" ON site_events
  FOR ALL USING (
    organization_id = get_user_org_id()
    AND (
      is_user_admin()
      OR (
        job_site_id = ANY(get_user_job_site_ids())
        AND get_user_site_role(job_site_id) IN (
          'superintendent',
          'engineer_as_superintendent',
          'engineer'
        )
      )
    )
  );

COMMIT;
