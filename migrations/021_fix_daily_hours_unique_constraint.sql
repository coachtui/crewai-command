-- Migration 021: Robustly fix daily_hours unique constraint for per-site hours
--
-- Problem: Migration 020 tried to drop the old 3-column unique constraint by
-- two known names. But the actual constraint name varies depending on whether
-- the column was originally 'org_id' or 'organization_id' when the table was
-- first created, or if the table was recreated at any point.
--
-- If the old 3-column constraint survives, saving hours for the same worker on
-- the same day at a second job site fails with a duplicate-key error, because
-- ON CONFLICT (worker_id, log_date, organization_id, job_site_id) only handles
-- conflicts on the 4-column constraint — not on the old 3-column one.
--
-- Fix: Use pg_constraint to find and drop ANY unique constraint on daily_hours
-- that covers exactly {worker_id, log_date, organization_id} (or org_id),
-- regardless of name. Then ensure the 4-column constraint exists.

-- Step 1: Drop any 3-column unique constraint on (worker_id, log_date, org/organization_id)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'daily_hours'
      AND c.contype = 'u'
      AND (
        -- 3-column constraint containing worker_id, log_date, and some org column
        (
          SELECT COUNT(*) FROM pg_attribute a
          WHERE a.attrelid = c.conrelid
            AND a.attnum = ANY(c.conkey)
            AND a.attname IN ('worker_id', 'log_date', 'org_id', 'organization_id')
        ) = array_length(c.conkey, 1)
        AND array_length(c.conkey, 1) = 3
      )
  LOOP
    EXECUTE 'ALTER TABLE daily_hours DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    RAISE NOTICE 'Dropped constraint: %', r.conname;
  END LOOP;
END $$;

-- Step 2: Also try the two most common names explicitly (belt-and-suspenders)
ALTER TABLE daily_hours DROP CONSTRAINT IF EXISTS daily_hours_worker_id_log_date_org_id_key;
ALTER TABLE daily_hours DROP CONSTRAINT IF EXISTS daily_hours_worker_id_log_date_organization_id_key;
ALTER TABLE daily_hours DROP CONSTRAINT IF EXISTS daily_hours_worker_site_date_unique;

-- Step 3: Remove any exact duplicate rows before adding the new constraint
-- (keeps the most recently updated record for each worker/date/org/site combo)
DELETE FROM daily_hours
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY worker_id, log_date, organization_id, job_site_id
             ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
           ) AS rn
    FROM daily_hours
  ) sub
  WHERE rn > 1
);

-- Step 4: Add the new 4-column unique constraint
ALTER TABLE daily_hours
  ADD CONSTRAINT daily_hours_worker_site_date_unique
  UNIQUE (worker_id, log_date, organization_id, job_site_id);
