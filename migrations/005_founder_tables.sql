-- ============================================================================
-- CruWork: Founder Console Tables
-- Version: 005
-- Date: 2026-03-03
-- Description: Adds tenant_onboarding, tenant_notes, and founder_audit_log
--              to support the Founder Console (/founder) feature.
--
-- Schema mapping (confirmed from existing schema):
--   company table:     organizations  (PK: id UUID)
--   membership table:  user_profiles  (FK: org_id → organizations.id)
--   projects table:    job_sites      (FK: organization_id → organizations.id)
-- ============================================================================

BEGIN;

-- ============================================================================
-- TABLE: tenant_onboarding
-- Overlay on organizations for onboarding tracking. One row per company.
-- Companies without a row show as "Not tracked" in Founder Console.
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_onboarding (
  company_id      UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'PROSPECT'
                    CHECK (status IN ('PROSPECT', 'ONBOARDING', 'ACTIVE', 'CHURNED')),
  stage           TEXT,
  checklist       JSONB NOT NULL DEFAULT '{}',
  last_touched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_onboarding_status
  ON tenant_onboarding(status);

-- updated_at trigger (reuses existing function from migration 001)
DROP TRIGGER IF EXISTS update_tenant_onboarding_updated_at ON tenant_onboarding;
CREATE TRIGGER update_tenant_onboarding_updated_at
  BEFORE UPDATE ON tenant_onboarding
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: enable but no user policies — only service role (edge functions) can access
ALTER TABLE tenant_onboarding ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TABLE: tenant_notes
-- Founder-written notes on a company. Append-only.
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_notes (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by_user_id  TEXT NOT NULL,
  note                TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_notes_company
  ON tenant_notes(company_id);
CREATE INDEX IF NOT EXISTS idx_tenant_notes_created_at
  ON tenant_notes(created_at DESC);

ALTER TABLE tenant_notes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TABLE: founder_audit_log
-- Immutable audit log written by Founder Console mutations.
-- ============================================================================

CREATE TABLE IF NOT EXISTS founder_audit_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_user_id   TEXT NOT NULL,
  actor_type      TEXT NOT NULL DEFAULT 'FOUNDER',
  company_id      UUID REFERENCES organizations(id) ON DELETE SET NULL,
  entity_type     TEXT NOT NULL,
  entity_id       TEXT NOT NULL,
  action          TEXT NOT NULL,
  before_json     JSONB,
  after_json      JSONB,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_founder_audit_company
  ON founder_audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_founder_audit_created_at
  ON founder_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_founder_audit_actor
  ON founder_audit_log(actor_user_id);

ALTER TABLE founder_audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- NOTE ON RLS
-- All three tables have RLS enabled with NO permissive policies.
-- Regular authenticated users cannot read or write these tables via anon key.
-- The founder-api Edge Function uses SUPABASE_SERVICE_ROLE_KEY, which
-- bypasses RLS entirely. This is the intended access path.
-- ============================================================================

COMMIT;

-- ============================================================================
-- Verification queries (run manually after applying):
-- ============================================================================
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%tenant%' OR tablename LIKE '%founder%';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tenant_onboarding';
-- SELECT policyname FROM pg_policies WHERE tablename IN ('tenant_onboarding','tenant_notes','founder_audit_log');
