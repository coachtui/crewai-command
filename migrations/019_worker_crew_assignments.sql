-- Per-site crew membership, supporting workers on multiple job sites
-- A worker can be in a different crew at each site they're assigned to

CREATE TABLE IF NOT EXISTS worker_crew_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  job_site_id uuid NOT NULL REFERENCES job_sites(id) ON DELETE CASCADE,
  crew_id uuid NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(worker_id, job_site_id)
);

-- Migrate existing crew assignments from workers.crew_id
INSERT INTO worker_crew_assignments (worker_id, job_site_id, crew_id)
SELECT w.id, w.job_site_id, w.crew_id
FROM workers w
WHERE w.crew_id IS NOT NULL
  AND w.job_site_id IS NOT NULL
ON CONFLICT (worker_id, job_site_id) DO NOTHING;

ALTER TABLE worker_crew_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view worker crew assignments"
  ON worker_crew_assignments FOR SELECT
  USING (
    worker_id IN (
      SELECT id FROM workers WHERE organization_id = get_user_org_id()
    )
  );

CREATE POLICY "Managers can manage worker crew assignments"
  ON worker_crew_assignments FOR ALL
  USING (
    worker_id IN (
      SELECT id FROM workers WHERE organization_id = get_user_org_id()
    )
  )
  WITH CHECK (
    worker_id IN (
      SELECT id FROM workers WHERE organization_id = get_user_org_id()
    )
  );
