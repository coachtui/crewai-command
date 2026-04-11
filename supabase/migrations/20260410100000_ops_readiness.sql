-- ============================================================================
-- Migration: OPS readiness — availability_status on workers, event_type on
-- site_events, and supporting indexes for org-wide OPS queries.
-- Both columns are additive. Existing rows backfill via DEFAULT.
-- ============================================================================

BEGIN;

-- ── Workers: separate availability from employment status ────────────────────

ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS availability_status TEXT
    NOT NULL
    DEFAULT 'available'
    CHECK (availability_status IN ('available', 'assigned', 'out', 'unavailable'));

-- ── Site events: structured event type for OPS filtering ─────────────────────

ALTER TABLE site_events
  ADD COLUMN IF NOT EXISTS event_type TEXT
    NOT NULL
    DEFAULT 'other'
    CHECK (event_type IN ('pour', 'paving', 'delivery', 'inspection', 'other'));

-- ── Indexes for OPS-style queries ────────────────────────────────────────────

-- Workers by org + availability (getAvailableWorkersByRole)
CREATE INDEX IF NOT EXISTS idx_workers_org_avail
  ON workers(organization_id, availability_status);

-- Workers by org + role (getWorkersByRole, getMechanicsAndDrivers)
CREATE INDEX IF NOT EXISTS idx_workers_org_role
  ON workers(organization_id, role);

-- Site events by type (getSiteEventsForOrg with eventType filter)
CREATE INDEX IF NOT EXISTS idx_site_events_type
  ON site_events(event_type);

-- Site events by org + date (getSiteEventsForOrg date range)
CREATE INDEX IF NOT EXISTS idx_site_events_org_date
  ON site_events(organization_id, event_date);

COMMIT;
