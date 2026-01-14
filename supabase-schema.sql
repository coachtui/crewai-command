-- ============================================================================
-- CrewAI Command: Complete Database Schema
-- Run this in Supabase SQL Editor to create all required tables
-- ============================================================================

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create user_profiles table (modern schema)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  email TEXT NOT NULL,
  name TEXT,
  base_role TEXT NOT NULL DEFAULT 'worker',
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create users table (legacy schema - for backward compatibility)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id),
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'worker',
  base_role TEXT NOT NULL DEFAULT 'worker',
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create job_sites table
CREATE TABLE IF NOT EXISTS job_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  name TEXT NOT NULL,
  location TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create job_site_assignments table
CREATE TABLE IF NOT EXISTS job_site_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  job_site_id UUID REFERENCES job_sites(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'worker',
  is_active BOOLEAN DEFAULT true,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, job_site_id)
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_site_id UUID REFERENCES job_sites(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create daily_hours table
CREATE TABLE IF NOT EXISTS daily_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  job_site_id UUID REFERENCES job_sites(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hours DECIMAL(5,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, job_site_id, date)
);

-- Create activities table (for tracking worker movements/check-ins)
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  job_site_id UUID REFERENCES job_sites(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now(),
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_site_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Organizations: Users can only see their own organization
CREATE POLICY "Users can view their organization"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
      UNION
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

-- User Profiles: Users can see profiles in their organization
CREATE POLICY "Users can view profiles in their org"
  ON user_profiles FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (id = auth.uid());

-- Users table (legacy): Same policies
CREATE POLICY "Users can view users in their org"
  ON users FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own user record"
  ON users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update their own user record"
  ON users FOR UPDATE
  USING (id = auth.uid());

-- Job Sites: Users can see job sites they're assigned to or in their org
CREATE POLICY "Users can view job sites in their org"
  ON job_sites FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
      UNION
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

-- Job Site Assignments: Users can see their own assignments
CREATE POLICY "Users can view their assignments"
  ON job_site_assignments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all assignments in their org"
  ON job_site_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND base_role = 'admin'
      AND organization_id IN (
        SELECT organization_id FROM job_sites WHERE id = job_site_assignments.job_site_id
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND (base_role = 'admin' OR role = 'admin')
      AND org_id IN (
        SELECT organization_id FROM job_sites WHERE id = job_site_assignments.job_site_id
      )
    )
  );

-- Tasks: Users can see tasks on job sites they're assigned to
CREATE POLICY "Users can view tasks on their job sites"
  ON tasks FOR SELECT
  USING (
    job_site_id IN (
      SELECT job_site_id FROM job_site_assignments
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Daily Hours: Users can see their own hours
CREATE POLICY "Users can view their own hours"
  ON daily_hours FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own hours"
  ON daily_hours FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own hours"
  ON daily_hours FOR UPDATE
  USING (user_id = auth.uid());

-- Activities: Users can see their own activities
CREATE POLICY "Users can view their own activities"
  ON activities FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own activities"
  ON activities FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_profiles_org ON user_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);
CREATE INDEX IF NOT EXISTS idx_job_sites_org ON job_sites(organization_id);
CREATE INDEX IF NOT EXISTS idx_job_site_assignments_user ON job_site_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_job_site_assignments_site ON job_site_assignments(job_site_id);
CREATE INDEX IF NOT EXISTS idx_tasks_job_site ON tasks(job_site_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_daily_hours_user ON daily_hours(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_hours_job_site ON daily_hours(job_site_id);
CREATE INDEX IF NOT EXISTS idx_daily_hours_date ON daily_hours(date);
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_job_site ON activities(job_site_id);
CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp);

-- ============================================================================
-- Triggers for updated_at timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_job_sites_updated_at BEFORE UPDATE ON job_sites
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_daily_hours_updated_at BEFORE UPDATE ON daily_hours
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================================
-- Seed Data (Optional - for testing)
-- ============================================================================

-- Create a test organization
-- INSERT INTO organizations (id, name)
-- VALUES ('00000000-0000-0000-0000-000000000001', 'Test Construction Co.')
-- ON CONFLICT (id) DO NOTHING;

-- Create a test job site
-- INSERT INTO job_sites (id, organization_id, name, location)
-- VALUES (
--   '00000000-0000-0000-0000-000000000002',
--   '00000000-0000-0000-0000-000000000001',
--   'Downtown Office Building',
--   '123 Main St, City, State'
-- )
-- ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- IMPORTANT: After running this schema, manually create user records
-- ============================================================================
-- When a user signs up via Supabase Auth, you need to insert their profile:
--
-- INSERT INTO user_profiles (id, organization_id, email, name, base_role)
-- VALUES (
--   '<auth-user-id>',
--   '<org-id>',
--   'user@example.com',
--   'User Name',
--   'admin'  -- or 'superintendent', 'engineer', 'foreman', 'worker'
-- );
--
-- OR use the legacy users table:
--
-- INSERT INTO users (id, org_id, email, name, role, base_role)
-- VALUES (
--   '<auth-user-id>',
--   '<org-id>',
--   'user@example.com',
--   'User Name',
--   'admin',
--   'admin'
-- );
