-- Migration 025: Backfill equipment_inventory from existing equipment records
--
-- Background: The equipment table (migration 015) was created before
-- equipment_inventory (migration 022). Any equipment added before the
-- auto-sync logic in the app (added 2026-04-08) has no corresponding
-- inventory entry.
--
-- This backfill inserts one inventory row per unique (org, name) pair
-- that doesn't already exist in equipment_inventory. When multiple
-- equipment records share a name within the same org, the most recently
-- created one wins (ORDER BY created_at DESC in the DISTINCT ON).
--
-- Quantity logic:
--   quantity_total     = 1 (one physical unit per equipment record)
--   quantity_available = 1 if status = 'available', else 0

INSERT INTO equipment_inventory (
  organization_id,
  name,
  model,
  serial_number,
  category,
  quantity_total,
  quantity_available,
  current_job_site_id,
  notes
)
SELECT DISTINCT ON (e.organization_id, lower(e.name))
  e.organization_id,
  e.name,
  e.model,
  e.serial_number,
  CASE e.type
    WHEN 'heavy_equipment' THEN 'Heavy Equipment'
    WHEN 'small_equipment' THEN 'Small Equipment'
    WHEN 'tools'           THEN 'Tools'
    WHEN 'vehicles'        THEN 'Vehicles'
    ELSE                        'Other'
  END AS category,
  1 AS quantity_total,
  CASE WHEN e.status = 'available' THEN 1 ELSE 0 END AS quantity_available,
  e.job_site_id AS current_job_site_id,
  e.notes
FROM equipment e
WHERE NOT EXISTS (
  SELECT 1
  FROM equipment_inventory ei
  WHERE ei.organization_id = e.organization_id
    AND lower(ei.name) = lower(e.name)
)
ORDER BY e.organization_id, lower(e.name), e.created_at DESC;

-- Verification:
-- SELECT count(*) FROM equipment_inventory;
-- SELECT count(*) FROM equipment;
