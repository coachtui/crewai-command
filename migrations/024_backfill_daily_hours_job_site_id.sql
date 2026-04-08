-- Migration 024: Backfill job_site_id on legacy daily_hours records
--
-- Root cause: Migration 001 added job_site_id to daily_hours as a nullable
-- column with no default. All records logged before per-site tracking was
-- introduced have job_site_id = NULL.
--
-- Migration 020 then changed the unique constraint to include job_site_id,
-- and migration 021 cleaned up duplicates — but neither touched NULL records.
--
-- The app now queries daily_hours with .eq('job_site_id', currentJobSite.id),
-- which never matches NULL, making all historical hours invisible.
--
-- Fix: Backfill job_site_id = workers.job_site_id for all NULL records.
-- Step 1 handles the edge case where a site-specific record was later logged
-- for the same worker/date (keeping the newer site-specific record).

-- Step 1: Remove NULL-site records where a site-specific record already
-- exists for the same worker/date/org at their current primary job site.
-- (Prevents unique constraint violation in Step 2; site-specific record wins.)
DELETE FROM daily_hours dh
WHERE dh.job_site_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM daily_hours dh2
    JOIN workers w ON w.id = dh.worker_id
    WHERE dh2.worker_id  = dh.worker_id
      AND dh2.log_date   = dh.log_date
      AND dh2.organization_id = dh.organization_id
      AND dh2.job_site_id = w.job_site_id
  );

-- Step 2: Backfill remaining NULL records to the worker's primary job site.
UPDATE daily_hours dh
SET job_site_id = w.job_site_id
FROM workers w
WHERE dh.worker_id     = w.id
  AND dh.job_site_id   IS NULL
  AND w.job_site_id    IS NOT NULL;

-- Verification: rows still with NULL job_site_id after this migration are
-- records whose worker no longer has a primary job_site (edge case).
-- SELECT count(*) FROM daily_hours WHERE job_site_id IS NULL;
