-- ============================================================================
-- CrewAI Command: Multi-Tenant Architecture Migration
-- Version: 1.0.0
-- Date: 2026-01-13
-- Description: Adds job site management, multi-tenant isolation, and role-based permissions
-- ============================================================================

-- IMPORTANT: Run this migration in a transaction
BEGIN;

-- ============================================================================
-- PART 1: EXTEND ORGANIZATIONS TABLE
-- ============================================================================

-- Add new columns to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS slug TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create unique index on slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- Update existing organization with a slug
UPDATE organizations 
SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

-- Make slug NOT NULL after populating
ALTER TABLE organizations ALTER COLUMN slug SET NOT NULL;

-- ============================================================================
-- PART 2: CREATE JOB SITES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  description TEXT,
  status TEXT CHECK (status IN ('active', 'on_hold', 'completed')) DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for job_sites
CREATE INDEX IF NOT EXISTS idx_job_sites_org ON job_sites(organization_id);
CREATE INDEX IF NOT EXISTS idx_job_sites_status ON job_sites(status);
CREATE INDEX IF NOT EXISTS idx_job_sites_created_by ON job_sites(created_by);

-- ============================================================================
-- PART 3: CREATE/UPDATE USER_PROFILES TABLE
-- ============================================================================

-- Create user_profiles table if it doesn't exist (keep users table intact)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT,
  base_role TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Copy data from users to user_profiles if users table exists (don't drop users table)
-- Only copy users that exist in auth.users to avoid foreign key constraint violations
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'users' AND schemaname = 'public') THEN
    -- Copy data from users to user_profiles, only for users that exist in auth.users
    INSERT INTO user_profiles (id, org_id, email, name, role, created_at)
    SELECT u.id, u.org_id, u.email, u.name, u.role, u.created_at 
    FROM users u
    WHERE EXISTS (SELECT 1 FROM auth.users au WHERE au.id = u.id)
    ON CONFLICT (id) DO UPDATE SET
      org_id = EXCLUDED.org_id,
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      role = EXCLUDED.role;
  END IF;
END $$;

-- Add new columns if they don't exist
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS base_role TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Migrate existing role to base_role
UPDATE user_profiles 
SET base_role = role 
WHERE base_role IS NULL;

-- Update role values to new naming convention
UPDATE user_profiles 
SET base_role = CASE 
  WHEN base_role = 'foreman' THEN 'foreman'
  WHEN base_role = 'viewer' THEN 'worker'
  WHEN base_role = 'admin' THEN 'admin'
  ELSE base_role
END
WHERE base_role NOT IN ('admin', 'superintendent', 'engineer', 'foreman', 'worker');

-- Add constraint for base_role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_base_role_check'
  ) THEN
    ALTER TABLE user_profiles 
    ADD CONSTRAINT user_profiles_base_role_check 
    CHECK (base_role IN ('admin', 'superintendent', 'engineer', 'foreman', 'worker'));
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_org ON user_profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_base_role ON user_profiles(base_role);

-- ============================================================================
-- PART 4: CREATE JOB SITE ASSIGNMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_site_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  job_site_id UUID NOT NULL REFERENCES job_sites(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('superintendent', 'engineer', 'engineer_as_superintendent', 'foreman', 'worker')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  assigned_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for job_site_assignments
CREATE INDEX IF NOT EXISTS idx_job_site_assignments_user ON job_site_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_job_site_assignments_site ON job_site_assignments(job_site_id);
CREATE INDEX IF NOT EXISTS idx_job_site_assignments_active ON job_site_assignments(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_job_site_assignments_user_active ON job_site_assignments(user_id, is_active) WHERE is_active = true;

-- Unique constraint for active assignments (user can only have one active assignment per site)
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_site_assignments_unique_active 
ON job_site_assignments(user_id, job_site_id) 
WHERE is_active = true;

-- ============================================================================
-- PART 5: UPDATE WORKERS TABLE
-- ============================================================================

-- Add job_site_id to workers (for current assignment tracking)
ALTER TABLE workers
ADD COLUMN IF NOT EXISTS job_site_id UUID REFERENCES job_sites(id),
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES user_profiles(id);

-- Rename org_id to organization_id if needed (for consistency)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workers' AND column_name = 'org_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workers' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE workers RENAME COLUMN org_id TO organization_id;
  END IF;
END $$;

-- Add alias column if org_id exists for backward compatibility
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workers' AND column_name = 'organization_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workers' AND column_name = 'org_id'
  ) THEN
    -- Create a generated column for backward compatibility
    -- Note: This requires the column to not exist
    NULL; -- Skip if already migrated
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workers_org ON workers(organization_id);
CREATE INDEX IF NOT EXISTS idx_workers_job_site ON workers(job_site_id);
CREATE INDEX IF NOT EXISTS idx_workers_user_id ON workers(user_id);

-- ============================================================================
-- PART 6: UPDATE TASKS TABLE
-- ============================================================================

-- Add job_site_id to tasks
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS job_site_id UUID REFERENCES job_sites(id);

-- Rename org_id to organization_id if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'org_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE tasks RENAME COLUMN org_id TO organization_id;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_job_site ON tasks(job_site_id);

-- ============================================================================
-- PART 7: UPDATE ASSIGNMENTS TABLE
-- ============================================================================

ALTER TABLE assignments
ADD COLUMN IF NOT EXISTS job_site_id UUID REFERENCES job_sites(id);

-- Rename org_id if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assignments' AND column_name = 'org_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assignments' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE assignments RENAME COLUMN org_id TO organization_id;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_assignments_org ON assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_assignments_job_site ON assignments(job_site_id);

-- ============================================================================
-- PART 8: UPDATE ASSIGNMENT_REQUESTS TABLE
-- ============================================================================

ALTER TABLE assignment_requests
ADD COLUMN IF NOT EXISTS job_site_id UUID REFERENCES job_sites(id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assignment_requests' AND column_name = 'org_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assignment_requests' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE assignment_requests RENAME COLUMN org_id TO organization_id;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_assignment_requests_org ON assignment_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_assignment_requests_job_site ON assignment_requests(job_site_id);

-- ============================================================================
-- PART 9: UPDATE DAILY_HOURS TABLE (if exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'daily_hours') THEN
    ALTER TABLE daily_hours
    ADD COLUMN IF NOT EXISTS job_site_id UUID REFERENCES job_sites(id);
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'daily_hours' AND column_name = 'org_id'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'daily_hours' AND column_name = 'organization_id'
    ) THEN
      ALTER TABLE daily_hours RENAME COLUMN org_id TO organization_id;
    END IF;
    
    CREATE INDEX IF NOT EXISTS idx_daily_hours_org ON daily_hours(organization_id);
    CREATE INDEX IF NOT EXISTS idx_daily_hours_job_site ON daily_hours(job_site_id);
  END IF;
END $$;

-- ============================================================================
-- PART 10: UPDATE TASK_HISTORY TABLE (if exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'task_history') THEN
    ALTER TABLE task_history
    ADD COLUMN IF NOT EXISTS job_site_id UUID REFERENCES job_sites(id);
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'task_history' AND column_name = 'org_id'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'task_history' AND column_name = 'organization_id'
    ) THEN
      ALTER TABLE task_history RENAME COLUMN org_id TO organization_id;
    END IF;
    
    CREATE INDEX IF NOT EXISTS idx_task_history_org ON task_history(organization_id);
    CREATE INDEX IF NOT EXISTS idx_task_history_job_site ON task_history(job_site_id);
  END IF;
END $$;

-- ============================================================================
-- PART 11: CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to get user's organization_id
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT org_id FROM user_profiles WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to get user's base_role
CREATE OR REPLACE FUNCTION get_user_base_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT base_role FROM user_profiles WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_user_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT base_role = 'admin' FROM user_profiles WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to get user's assigned job site IDs
CREATE OR REPLACE FUNCTION get_user_job_site_ids()
RETURNS UUID[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT job_site_id 
    FROM job_site_assignments 
    WHERE user_id = auth.uid() 
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user has access to a job site
CREATE OR REPLACE FUNCTION user_has_job_site_access(site_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Admins have access to all sites in their org
  IF is_user_admin() THEN
    RETURN EXISTS (
      SELECT 1 FROM job_sites 
      WHERE id = site_id 
      AND organization_id = get_user_org_id()
    );
  END IF;
  
  -- Non-admins need explicit assignment
  RETURN EXISTS (
    SELECT 1 FROM job_site_assignments 
    WHERE user_id = auth.uid() 
    AND job_site_id = site_id 
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to get user's role on a specific job site
CREATE OR REPLACE FUNCTION get_user_site_role(site_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role FROM job_site_assignments 
    WHERE user_id = auth.uid() 
    AND job_site_id = site_id 
    AND is_active = true
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- PART 12: DROP OLD RLS POLICIES
-- ============================================================================

-- Drop all existing policies to recreate them
DROP POLICY IF EXISTS "Allow all for authenticated users" ON organizations;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON users;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON user_profiles;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON workers;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON tasks;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON assignments;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON assignment_requests;

-- Drop any existing multi-tenant policies
DROP POLICY IF EXISTS "Users can only access their organization" ON organizations;
DROP POLICY IF EXISTS "Users can view profiles in their org" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage all job sites" ON job_sites;
DROP POLICY IF EXISTS "Users can view assigned job sites" ON job_sites;
DROP POLICY IF EXISTS "Users can view own assignments" ON job_site_assignments;
DROP POLICY IF EXISTS "Admins and superintendents can manage assignments" ON job_site_assignments;

-- ============================================================================
-- PART 13: ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_site_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_requests ENABLE ROW LEVEL SECURITY;

-- Enable RLS on optional tables if they exist
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'daily_hours') THEN
    ALTER TABLE daily_hours ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'task_history') THEN
    ALTER TABLE task_history ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ============================================================================
-- PART 14: CREATE NEW RLS POLICIES
-- ============================================================================

-- Organizations: Users can only see their own organization
CREATE POLICY "org_access_policy" ON organizations
  FOR ALL USING (id = get_user_org_id());

-- User Profiles: Multiple policies for different operations
CREATE POLICY "profiles_view_org_policy" ON user_profiles
  FOR SELECT USING (org_id = get_user_org_id());

CREATE POLICY "profiles_update_own_policy" ON user_profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "profiles_admin_manage_policy" ON user_profiles
  FOR ALL USING (
    org_id = get_user_org_id() AND is_user_admin()
  );

-- Job Sites: Admins see all, others see assigned only
CREATE POLICY "job_sites_admin_policy" ON job_sites
  FOR ALL USING (
    organization_id = get_user_org_id() AND is_user_admin()
  );

CREATE POLICY "job_sites_assigned_view_policy" ON job_sites
  FOR SELECT USING (
    id = ANY(get_user_job_site_ids())
  );

-- Job Site Assignments: View own, admins/supers manage
CREATE POLICY "assignments_view_own_policy" ON job_site_assignments
  FOR SELECT USING (
    user_id = auth.uid() 
    OR is_user_admin()
    OR (
      -- Superintendents can see assignments on their sites
      job_site_id = ANY(get_user_job_site_ids())
      AND get_user_site_role(job_site_id) IN ('superintendent', 'engineer_as_superintendent')
    )
  );

CREATE POLICY "assignments_manage_policy" ON job_site_assignments
  FOR ALL USING (
    is_user_admin()
    OR (
      -- Superintendents can manage assignments on their sites
      job_site_id = ANY(get_user_job_site_ids())
      AND get_user_site_role(job_site_id) IN ('superintendent', 'engineer_as_superintendent')
    )
  );

-- Workers: Org-level access with job site filtering
-- Note: Using org_id as that's the actual column name in the table
CREATE POLICY "workers_org_access_policy" ON workers
  FOR SELECT USING (
    COALESCE(organization_id, org_id) = get_user_org_id()
    AND (
      is_user_admin() 
      OR job_site_id IS NULL 
      OR job_site_id = ANY(get_user_job_site_ids())
    )
  );

CREATE POLICY "workers_admin_manage_policy" ON workers
  FOR ALL USING (
    COALESCE(organization_id, org_id) = get_user_org_id() 
    AND (
      is_user_admin()
      OR (
        job_site_id = ANY(get_user_job_site_ids())
        AND get_user_site_role(job_site_id) IN ('superintendent', 'engineer_as_superintendent')
      )
    )
  );

-- Tasks: Similar pattern - org + job site filtering
CREATE POLICY "tasks_view_policy" ON tasks
  FOR SELECT USING (
    COALESCE(organization_id, org_id) = get_user_org_id()
    AND (
      is_user_admin() 
      OR job_site_id IS NULL 
      OR job_site_id = ANY(get_user_job_site_ids())
    )
  );

CREATE POLICY "tasks_manage_policy" ON tasks
  FOR ALL USING (
    COALESCE(organization_id, org_id) = get_user_org_id()
    AND (
      is_user_admin()
      OR (
        job_site_id = ANY(get_user_job_site_ids())
        AND get_user_site_role(job_site_id) IN ('superintendent', 'engineer_as_superintendent')
      )
    )
  );

-- Assignments (task assignments): Similar pattern
CREATE POLICY "task_assignments_view_policy" ON assignments
  FOR SELECT USING (
    COALESCE(organization_id, org_id) = get_user_org_id()
    AND (
      is_user_admin() 
      OR job_site_id IS NULL 
      OR job_site_id = ANY(get_user_job_site_ids())
    )
  );

CREATE POLICY "task_assignments_manage_policy" ON assignments
  FOR ALL USING (
    COALESCE(organization_id, org_id) = get_user_org_id()
    AND (
      is_user_admin()
      OR (
        job_site_id = ANY(get_user_job_site_ids())
        AND get_user_site_role(job_site_id) IN ('superintendent', 'engineer_as_superintendent', 'foreman')
      )
    )
  );

-- Assignment Requests: Similar pattern
CREATE POLICY "assignment_requests_view_policy" ON assignment_requests
  FOR SELECT USING (
    COALESCE(organization_id, org_id) = get_user_org_id()
    AND (
      is_user_admin() 
      OR job_site_id IS NULL 
      OR job_site_id = ANY(get_user_job_site_ids())
    )
  );

CREATE POLICY "assignment_requests_manage_policy" ON assignment_requests
  FOR ALL USING (
    COALESCE(organization_id, org_id) = get_user_org_id()
    AND (
      is_user_admin()
      OR (
        job_site_id = ANY(get_user_job_site_ids())
        AND get_user_site_role(job_site_id) IN ('superintendent', 'engineer_as_superintendent', 'foreman')
      )
    )
  );

-- ============================================================================
-- PART 15: UPDATE TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for all tables with updated_at
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY['organizations', 'user_profiles', 'job_sites', 'job_site_assignments', 'workers'];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS update_%I_updated_at ON %I;
      CREATE TRIGGER update_%I_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    ', tbl, tbl, tbl, tbl);
  END LOOP;
END $$;

-- ============================================================================
-- COMMIT TRANSACTION
-- ============================================================================

COMMIT;

-- ============================================================================
-- POST-MIGRATION: Verification queries (run manually to verify)
-- ============================================================================

-- Verify tables exist:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Verify columns on job_sites:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'job_sites';

-- Verify RLS policies:
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';

-- Verify helper functions:
-- SELECT proname FROM pg_proc WHERE proname LIKE '%user%' OR proname LIKE '%job_site%';
