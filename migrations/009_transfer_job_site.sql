-- Migration: Add transferred_to_job_site_id to daily_hours
-- This allows tracking which job site a worker was transferred to

ALTER TABLE daily_hours
  ADD COLUMN IF NOT EXISTS transferred_to_job_site_id UUID REFERENCES job_sites(id) ON DELETE SET NULL;

-- Index for joins
CREATE INDEX IF NOT EXISTS idx_daily_hours_transferred_to_job_site_id
  ON daily_hours(transferred_to_job_site_id);
