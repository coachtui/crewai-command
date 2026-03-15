-- Migration: equipment and daily_notes
-- Adds equipment management (similar to workers) and daily notes for job sites

-- ============================================================================
-- DAILY NOTES
-- ============================================================================

CREATE TABLE IF NOT EXISTS daily_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_site_id UUID REFERENCES job_sites(id) ON DELETE CASCADE,
  note_date DATE NOT NULL,
  general_notes TEXT,
  equipment_notes TEXT,
  tools_notes TEXT,
  safety_notes TEXT,
  weather_notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, job_site_id, note_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_notes_org_site_date ON daily_notes(organization_id, job_site_id, note_date);

CREATE TRIGGER update_daily_notes_updated_at
  BEFORE UPDATE ON daily_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE daily_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can view daily notes"
  ON daily_notes FOR SELECT
  USING (organization_id = get_user_org_id());

CREATE POLICY "managers can manage daily notes"
  ON daily_notes FOR ALL
  USING (
    organization_id = get_user_org_id()
    AND get_user_base_role() IN ('manager', 'admin', 'superintendent', 'engineer', 'foreman')
  );

-- ============================================================================
-- EQUIPMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_site_id UUID REFERENCES job_sites(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL DEFAULT 'other',
  -- type values: heavy_equipment, small_equipment, tools, vehicles, other
  model VARCHAR(255),
  serial_number VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'available',
  -- status values: available, in_use, maintenance, retired
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipment_org ON equipment(organization_id);
CREATE INDEX IF NOT EXISTS idx_equipment_site ON equipment(job_site_id);
CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status, organization_id);

CREATE TRIGGER update_equipment_updated_at
  BEFORE UPDATE ON equipment
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can view equipment"
  ON equipment FOR SELECT
  USING (organization_id = get_user_org_id());

CREATE POLICY "managers can manage equipment"
  ON equipment FOR ALL
  USING (
    organization_id = get_user_org_id()
    AND get_user_base_role() IN ('manager', 'admin', 'superintendent', 'engineer', 'foreman')
  );

-- ============================================================================
-- EQUIPMENT SITE ASSIGNMENTS (temporary/additional site assignments)
-- ============================================================================

CREATE TABLE IF NOT EXISTS equipment_site_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  job_site_id UUID NOT NULL REFERENCES job_sites(id) ON DELETE CASCADE,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_by UUID REFERENCES user_profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_esa_equipment_id ON equipment_site_assignments(equipment_id);
CREATE INDEX IF NOT EXISTS idx_esa_job_site_id ON equipment_site_assignments(job_site_id);
CREATE INDEX IF NOT EXISTS idx_esa_active ON equipment_site_assignments(is_active, job_site_id);

CREATE TRIGGER update_equipment_site_assignments_updated_at
  BEFORE UPDATE ON equipment_site_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE equipment_site_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can view equipment site assignments"
  ON equipment_site_assignments FOR SELECT
  USING (
    equipment_id IN (
      SELECT id FROM equipment
      WHERE organization_id = get_user_org_id()
    )
  );

CREATE POLICY "managers can manage equipment site assignments"
  ON equipment_site_assignments FOR ALL
  USING (
    get_user_base_role() IN ('manager', 'admin', 'superintendent', 'engineer', 'foreman')
    AND equipment_id IN (
      SELECT id FROM equipment
      WHERE organization_id = get_user_org_id()
    )
  );
