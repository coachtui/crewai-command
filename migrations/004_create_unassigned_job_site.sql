-- Migration: Create special "Unassigned" job site for workers without assignments
-- Description: Creates a system job site to hold unassigned workers instead of using NULL
-- Date: 2026-02-06

-- Step 1: Add is_system_site column to mark special system sites
ALTER TABLE job_sites
ADD COLUMN IF NOT EXISTS is_system_site BOOLEAN DEFAULT false;

-- Step 2: Create an index for system sites
CREATE INDEX IF NOT EXISTS idx_job_sites_system ON job_sites(organization_id, is_system_site);

-- Step 3: For each organization, create an "Unassigned" job site if it doesn't exist
DO $$
DECLARE
  org RECORD;
  unassigned_site_id UUID;
BEGIN
  -- Loop through all organizations
  FOR org IN SELECT id, name FROM organizations LOOP
    -- Check if this org already has an Unassigned site
    SELECT id INTO unassigned_site_id
    FROM job_sites
    WHERE organization_id = org.id
      AND (name = 'Unassigned' OR name ILIKE '%unassigned%')
    LIMIT 1;

    -- If not, create one
    IF unassigned_site_id IS NULL THEN
      INSERT INTO job_sites (
        id,
        organization_id,
        name,
        description,
        status,
        start_date,
        end_date,
        is_system_site,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        org.id,
        'Unassigned',
        'Workers not currently assigned to a specific project',
        'active',
        NULL,
        NULL,
        true,
        NOW(),
        NOW()
      );

      RAISE NOTICE 'Created Unassigned job site for organization: %', org.name;
    ELSE
      -- Mark existing Unassigned site as system site
      UPDATE job_sites
      SET is_system_site = true,
          description = COALESCE(description, 'Workers not currently assigned to a specific project')
      WHERE id = unassigned_site_id;

      RAISE NOTICE 'Marked existing Unassigned job site as system site for organization: %', org.name;
    END IF;
  END LOOP;
END $$;

-- Step 4: Update any workers with NULL job_site_id to use the Unassigned site
DO $$
DECLARE
  org RECORD;
  unassigned_site_id UUID;
  updated_count INTEGER;
BEGIN
  FOR org IN SELECT id, name FROM organizations LOOP
    -- Get the Unassigned site for this org
    SELECT id INTO unassigned_site_id
    FROM job_sites
    WHERE organization_id = org.id
      AND is_system_site = true
      AND name = 'Unassigned'
    LIMIT 1;

    IF unassigned_site_id IS NOT NULL THEN
      -- Move NULL workers to Unassigned site
      UPDATE workers
      SET job_site_id = unassigned_site_id
      WHERE organization_id = org.id
        AND job_site_id IS NULL;

      GET DIAGNOSTICS updated_count = ROW_COUNT;

      IF updated_count > 0 THEN
        RAISE NOTICE 'Moved % unassigned workers to Unassigned job site for organization: %', updated_count, org.name;
      END IF;
    END IF;
  END LOOP;
END $$;

COMMENT ON COLUMN job_sites.is_system_site IS 'Marks system-created job sites like Unassigned that cannot be deleted by users';
