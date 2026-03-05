-- ============================================================================
-- Shared Files Table
-- Stores references to files uploaded to the shared-files area
-- ============================================================================

CREATE TABLE IF NOT EXISTS shared_files (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id text NOT NULL,
  job_site_id     uuid REFERENCES job_sites(id) ON DELETE CASCADE,
  name            text NOT NULL,           -- display name, user can rename
  storage_path    text NOT NULL,           -- path in task-files storage bucket
  url             text NOT NULL,           -- public URL
  file_size       bigint,
  file_type       text,                    -- MIME type
  uploaded_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS shared_files_org_idx ON shared_files(organization_id);
CREATE INDEX IF NOT EXISTS shared_files_job_site_idx ON shared_files(job_site_id);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE shared_files ENABLE ROW LEVEL SECURITY;

-- All authenticated users in the org can view shared files
CREATE POLICY "shared_files_select"
  ON shared_files FOR SELECT
  TO authenticated
  USING (
    organization_id = (
      SELECT org_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Admins, engineers, superintendents, and foremen can insert
CREATE POLICY "shared_files_insert"
  ON shared_files FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (
      SELECT org_id FROM user_profiles WHERE id = auth.uid()
    )
    AND (
      SELECT base_role FROM user_profiles WHERE id = auth.uid()
    ) IN ('admin', 'superintendent', 'engineer', 'foreman')
    OR (
      SELECT role FROM user_profiles WHERE id = auth.uid()
    ) IN ('admin', 'foreman')
  );

-- Same roles can update (rename)
CREATE POLICY "shared_files_update"
  ON shared_files FOR UPDATE
  TO authenticated
  USING (
    organization_id = (
      SELECT org_id FROM user_profiles WHERE id = auth.uid()
    )
    AND (
      (SELECT base_role FROM user_profiles WHERE id = auth.uid())
        IN ('admin', 'superintendent', 'engineer', 'foreman')
      OR
      (SELECT role FROM user_profiles WHERE id = auth.uid())
        IN ('admin', 'foreman')
    )
  );

-- Same roles can delete
CREATE POLICY "shared_files_delete"
  ON shared_files FOR DELETE
  TO authenticated
  USING (
    organization_id = (
      SELECT org_id FROM user_profiles WHERE id = auth.uid()
    )
    AND (
      (SELECT base_role FROM user_profiles WHERE id = auth.uid())
        IN ('admin', 'superintendent', 'engineer', 'foreman')
      OR
      (SELECT role FROM user_profiles WHERE id = auth.uid())
        IN ('admin', 'foreman')
    )
  );
