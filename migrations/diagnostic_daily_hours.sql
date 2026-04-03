-- Run this in Supabase SQL editor to diagnose the daily_hours table state.
-- Do NOT run as a migration — read-only diagnostic only.

-- 1. Actual column names in daily_hours
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'daily_hours'
ORDER BY ordinal_position;

-- 2. All unique constraints on daily_hours (names + columns)
SELECT c.conname AS constraint_name,
       array_agg(a.attname ORDER BY array_position(c.conkey, a.attnum)) AS columns
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE t.relname = 'daily_hours' AND c.contype = 'u'
GROUP BY c.conname;

-- 3. Sample of existing records showing job_site_id distribution
SELECT job_site_id, count(*)
FROM daily_hours
GROUP BY job_site_id
ORDER BY count(*) DESC
LIMIT 20;
