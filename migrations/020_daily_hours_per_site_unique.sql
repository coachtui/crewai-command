-- Migration 020: Scope daily_hours unique constraint to include job_site_id
--
-- Previously: UNIQUE(worker_id, log_date, organization_id)
-- This meant a worker could only have one hours record per day across ALL sites.
-- Entering hours at Site B for the same worker/date would overwrite Site A's record.
--
-- New: UNIQUE(worker_id, log_date, organization_id, job_site_id)
-- Each site tracks its own hours independently.

-- Drop the old constraint (Postgres names it after the original column name before rename)
ALTER TABLE daily_hours DROP CONSTRAINT IF EXISTS daily_hours_worker_id_log_date_org_id_key;
ALTER TABLE daily_hours DROP CONSTRAINT IF EXISTS daily_hours_worker_id_log_date_organization_id_key;

-- Add new constraint scoped to job_site_id
ALTER TABLE daily_hours
  ADD CONSTRAINT daily_hours_worker_site_date_unique
  UNIQUE (worker_id, log_date, organization_id, job_site_id);
