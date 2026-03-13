-- Migration: worker_site_assignments
-- Allows workers to be temporarily assigned to multiple job sites
-- with optional date ranges (e.g. working at Site B from Mon–Fri)

CREATE TABLE IF NOT EXISTS worker_site_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  job_site_id UUID NOT NULL REFERENCES job_sites(id) ON DELETE CASCADE,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_by UUID REFERENCES user_profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wsa_worker_id ON worker_site_assignments(worker_id);
CREATE INDEX IF NOT EXISTS idx_wsa_job_site_id ON worker_site_assignments(job_site_id);
CREATE INDEX IF NOT EXISTS idx_wsa_active ON worker_site_assignments(is_active, job_site_id);

-- Trigger to keep updated_at current
CREATE TRIGGER update_worker_site_assignments_updated_at
  BEFORE UPDATE ON worker_site_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE worker_site_assignments ENABLE ROW LEVEL SECURITY;

-- Any org member can view assignments for workers in their org
CREATE POLICY "org members can view worker site assignments"
  ON worker_site_assignments FOR SELECT
  USING (
    worker_id IN (
      SELECT id FROM workers
      WHERE organization_id = get_user_org_id()
    )
  );

-- Managers can create/update/delete assignments for workers in their org
CREATE POLICY "managers can manage worker site assignments"
  ON worker_site_assignments FOR ALL
  USING (
    get_user_base_role() IN ('admin', 'superintendent', 'engineer', 'foreman')
    AND worker_id IN (
      SELECT id FROM workers
      WHERE organization_id = get_user_org_id()
    )
  );
