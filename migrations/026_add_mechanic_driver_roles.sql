-- Migration 026: Add mechanic and driver to workers_role_check constraint
--
-- The workers table has a CHECK constraint limiting the role column to
-- ('operator', 'laborer', 'carpenter', 'mason'). Mechanic and driver were
-- added as valid WorkerRole values in the app (2026-04-10) but the DB
-- constraint was never updated, causing INSERT/UPDATE to fail with code 23514.
--
-- This migration drops the existing constraint and recreates it with all
-- six valid role values.

ALTER TABLE workers
  DROP CONSTRAINT IF EXISTS workers_role_check;

ALTER TABLE workers
  ADD CONSTRAINT workers_role_check
  CHECK (role IN ('operator', 'laborer', 'carpenter', 'mason', 'mechanic', 'driver'));
