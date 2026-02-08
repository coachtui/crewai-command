# Multi-Tenant Security Architecture

**Last Updated**: January 14, 2026
**Status**: Active
**Maintained By**: Development Team

---

## Overview

CrewAI Command implements a robust multi-tenant architecture using **Row-Level Security (RLS)** in Supabase PostgreSQL to ensure complete data isolation between organizations. This document describes the security architecture, RLS policies, and best practices for maintaining data security.

---

## Architecture Layers

### 1. Organization Hierarchy

```
organizations (Root Tenant)
    ├── user_profiles (Users belong to one organization)
    ├── job_sites (Sites belong to one organization)
    │   └── job_site_assignments (Users assigned to sites with roles)
    ├── workers (Workers belong to one organization and one site)
    ├── tasks (Tasks belong to one organization and one site)
    ├── assignments (Task assignments belong to one organization)
    └── daily_hours, activities, etc. (All tenant-scoped data)
```

**Key Principles**:
- Every organization is completely isolated
- Users belong to exactly ONE organization
- All data is scoped by `organization_id` or `org_id`
- Job sites belong to organizations
- Workers can be assigned to multiple job sites within their organization

---

### 2. Data Isolation Pattern

All tenant-specific tables include:
- `organization_id` or `org_id` column (UUID, NOT NULL)
- Foreign key constraint to `organizations(id)`
- RLS policies enforcing organization-level access
- Indexes on organization columns for performance

**Example Table Structure**:
```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  job_site_id UUID REFERENCES job_sites(id),
  name TEXT NOT NULL,
  -- ... other columns
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id)
);

-- Always add index for org filtering
CREATE INDEX idx_tasks_org ON tasks(organization_id);
CREATE INDEX idx_tasks_job_site ON tasks(job_site_id);
```

---

### 3. RLS Helper Functions

**Location**: `migrations/001_multi_tenant_schema.sql` (lines 324-405)

These functions are used by RLS policies to determine access rights:

#### `get_user_org_id()` → `UUID`
Returns the current user's organization ID from their user profile.

```sql
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT org_id FROM user_profiles WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Usage**: `WHERE organization_id = get_user_org_id()`

---

#### `is_user_admin()` → `BOOLEAN`
Checks if the current user has admin role.

```sql
CREATE OR REPLACE FUNCTION is_user_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT base_role = 'admin' FROM user_profiles WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Usage**: `WHERE is_user_admin() OR <other conditions>`

---

#### `get_user_job_site_ids()` → `UUID[]`
Returns array of job site IDs the user has access to.

```sql
CREATE OR REPLACE FUNCTION get_user_job_site_ids()
RETURNS UUID[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT job_site_id
    FROM job_site_assignments
    WHERE user_id = auth.uid() AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Usage**: `WHERE job_site_id = ANY(get_user_job_site_ids())`

---

#### `user_has_job_site_access(site_id UUID)` → `BOOLEAN`
Checks if user can access a specific job site (admin or assigned).

```sql
CREATE OR REPLACE FUNCTION user_has_job_site_access(site_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    is_user_admin()
    OR site_id = ANY(get_user_job_site_ids())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Usage**: `WHERE user_has_job_site_access(job_site_id)`

---

#### `get_user_site_role(site_id UUID)` → `TEXT`
Returns the user's role on a specific job site.

```sql
CREATE OR REPLACE FUNCTION get_user_site_role(site_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role
    FROM job_site_assignments
    WHERE user_id = auth.uid()
      AND job_site_id = site_id
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### 4. Security Modes

All helper functions use `SECURITY DEFINER` which means they run with the privileges of the function owner (typically a superuser), bypassing RLS. This is necessary to query the database for access control decisions within RLS policies themselves.

**Why SECURITY DEFINER is Safe Here**:
- Functions only read data, never modify
- Always filter by `auth.uid()` (current authenticated user)
- Results are used to enforce, not bypass, security policies
- Functions are simple and auditable

---

## RLS Policy Patterns

### Pattern 1: Organization-Level Access

For tables where users should see **all data in their organization**:

```sql
-- Example: organizations table
CREATE POLICY "org_access_policy" ON organizations
  FOR ALL
  USING (id = get_user_org_id());
```

**Used By**: `organizations`, `user_profiles` (with additional checks)

---

### Pattern 2: Org + Admin Override

For tables where:
- **Admins** see all data in their org
- **Non-admins** see only data for their assigned job sites

```sql
-- Example: tasks table
CREATE POLICY "tasks_select_policy" ON tasks
  FOR SELECT
  USING (
    organization_id = get_user_org_id()
    AND (
      is_user_admin()
      OR job_site_id IS NULL
      OR job_site_id = ANY(get_user_job_site_ids())
    )
  );
```

**Used By**: `tasks`, `workers`, `assignments`, `assignment_requests`

---

### Pattern 3: User-Owned Data

For tables where users should only see **their own data**:

```sql
-- Example: daily_hours table
CREATE POLICY "daily_hours_own_policy" ON daily_hours
  FOR ALL
  USING (
    user_id = auth.uid()
    OR is_user_admin()
  );
```

**Used By**: `daily_hours`, `activities` (user's own data)

---

### Pattern 4: Job Site Assignments (Special Case)

Users can see their own assignments OR assignments for job sites they manage:

```sql
CREATE POLICY "job_site_assignments_view_policy" ON job_site_assignments
  FOR SELECT
  USING (
    user_id = auth.uid()  -- Own assignments
    OR is_user_admin()    -- Admin sees all in org
    OR (
      -- Superintendents/engineers see assignments for their sites
      job_site_id = ANY(get_user_job_site_ids())
      AND get_user_site_role(job_site_id) IN ('superintendent', 'engineer_as_superintendent')
    )
  );
```

---

## Complete Policy Template for New Tables

When adding a new tenant-scoped table, follow this template:

```sql
-- ============================================================================
-- TABLE: my_new_table
-- ============================================================================

-- 1. Create table with organization_id
CREATE TABLE IF NOT EXISTS my_new_table (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_site_id UUID REFERENCES job_sites(id) ON DELETE CASCADE,

  -- Your columns here
  name TEXT NOT NULL,
  description TEXT,

  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id),
  modified_at TIMESTAMPTZ,
  modified_by UUID REFERENCES user_profiles(id)
);

-- 2. Enable RLS
ALTER TABLE my_new_table ENABLE ROW LEVEL SECURITY;

-- 3. Create SELECT policy
CREATE POLICY "my_new_table_select_policy" ON my_new_table
  FOR SELECT
  USING (
    organization_id = get_user_org_id()
    AND (
      is_user_admin()
      OR job_site_id IS NULL
      OR job_site_id = ANY(get_user_job_site_ids())
    )
  );

-- 4. Create INSERT policy
CREATE POLICY "my_new_table_insert_policy" ON my_new_table
  FOR INSERT
  WITH CHECK (
    organization_id = get_user_org_id()
    AND (
      is_user_admin()
      OR job_site_id IS NULL
      OR user_has_job_site_access(job_site_id)
    )
  );

-- 5. Create UPDATE policy
CREATE POLICY "my_new_table_update_policy" ON my_new_table
  FOR UPDATE
  USING (
    organization_id = get_user_org_id()
    AND (
      is_user_admin()
      OR user_has_job_site_access(job_site_id)
    )
  );

-- 6. Create DELETE policy
CREATE POLICY "my_new_table_delete_policy" ON my_new_table
  FOR DELETE
  USING (
    organization_id = get_user_org_id()
    AND is_user_admin()  -- Only admins can delete
  );

-- 7. Add indexes for performance
CREATE INDEX idx_my_new_table_org ON my_new_table(organization_id);
CREATE INDEX idx_my_new_table_job_site ON my_new_table(job_site_id);
CREATE INDEX idx_my_new_table_created_at ON my_new_table(created_at);
```

---

## Application Code Guidelines

### DO ✅

1. **Always use `useAuth()` or `useOrgId()` hooks** for org_id:
   ```typescript
   import { useAuth } from '../../contexts';

   const { user } = useAuth();
   const orgId = user?.org_id;
   ```

2. **Always filter queries by organization_id**:
   ```typescript
   const { data, error } = await supabase
     .from('tasks')
     .select('*')
     .eq('organization_id', user.org_id);
   ```

3. **Always validate org_id before INSERT operations**:
   ```typescript
   if (!user?.org_id) {
     toast.error('Unable to determine organization');
     return;
   }

   await supabase.from('tasks').insert([{
     ...taskData,
     organization_id: user.org_id
   }]);
   ```

4. **Test with multiple organizations**:
   - Create 2 test orgs
   - Create users in each
   - Verify no cross-org data leaks

---

### DON'T ❌

1. **NEVER hardcode org_id values**:
   ```typescript
   // ❌ WRONG
   org_id: '550e8400-e29b-41d4-a716-446655440000'

   // ✅ CORRECT
   org_id: user.org_id
   ```

2. **NEVER skip org filtering in queries**:
   ```typescript
   // ❌ WRONG - returns all orgs (RLS will filter, but inefficient)
   await supabase.from('tasks').select('*');

   // ✅ CORRECT - explicitly filter
   await supabase.from('tasks').select('*').eq('organization_id', user.org_id);
   ```

3. **NEVER disable RLS in production**:
   ```sql
   -- ❌ NEVER DO THIS
   ALTER TABLE my_table DISABLE ROW LEVEL SECURITY;
   ```

4. **NEVER use service_role key in client code**:
   ```typescript
   // ❌ WRONG - bypasses all RLS
   const supabase = createClient(url, serviceRoleKey);

   // ✅ CORRECT - use anon key
   const supabase = createClient(url, anonKey);
   ```

5. **NEVER accept org_id from client input**:
   ```typescript
   // ❌ WRONG - user could inject wrong org_id
   const orgId = req.body.org_id;

   // ✅ CORRECT - always get from auth context
   const orgId = user.org_id;
   ```

---

## Testing Procedures

### Unit Tests

```typescript
import { supabase } from './lib/supabase';
import { createTestOrg, createTestUser } from './test-utils';

describe('Multi-tenant isolation', () => {
  it('should not return data from other organizations', async () => {
    // Setup
    const org1 = await createTestOrg('Org 1');
    const org2 = await createTestOrg('Org 2');
    const user1 = await createTestUser(org1.id);
    const user2 = await createTestUser(org2.id);

    // User 1 creates a task
    const { data: task } = await supabase
      .from('tasks')
      .insert({ name: 'Task 1', organization_id: org1.id })
      .select()
      .single();

    // User 2 tries to fetch tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*');

    // Verify user 2 cannot see user 1's task
    expect(tasks).not.toContainEqual(expect.objectContaining({ id: task.id }));
  });
});
```

---

### Manual Testing Checklist

**Test 1: Cross-Org Isolation**
- [ ] Create Organization A with User A
- [ ] Create Organization B with User B
- [ ] User A creates workers, tasks, assignments
- [ ] Login as User B → Verify cannot see Org A data
- [ ] Try direct API calls to fetch Org A data → Should return empty

**Test 2: Admin Access**
- [ ] Login as Admin user
- [ ] Verify can see ALL job sites in organization
- [ ] Verify can create/edit/delete across all sites
- [ ] Verify can see all workers, tasks, assignments in org

**Test 3: Non-Admin Access**
- [ ] Login as Superintendent assigned to Site A
- [ ] Verify can see Site A data only
- [ ] Verify CANNOT see Site B data (same org, different site)
- [ ] Verify can assign workers on Site A
- [ ] Try to assign workers to Site B → Should fail

**Test 4: Job Site Switching**
- [ ] Login as user assigned to multiple sites
- [ ] Switch between sites using JobSiteSelector
- [ ] Verify data updates to show current site only
- [ ] Refresh browser → Verify last selection persisted

---

## Verification Queries

Run these SQL queries to audit RLS configuration:

### Check RLS Enabled
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Expected: All tenant tables have `rowsecurity = true`

---

### List All Policies
```sql
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
```

Expected: Each table has 4 policies (SELECT, INSERT, UPDATE, DELETE)

---

### Find Tables Without Policies
```sql
SELECT t.tablename
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
  AND t.tablename NOT IN (
    SELECT DISTINCT tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  );
```

Expected: Empty result (no tables missing policies)

---

### Test Cross-Org Access (As User)
```sql
-- Login as a test user, then run:
SELECT COUNT(*) as should_be_zero
FROM tasks
WHERE organization_id != (SELECT org_id FROM user_profiles WHERE id = auth.uid());
```

Expected: `0` (user cannot see other org's data)

---

## Security Checklist

Before deploying new features:

- [ ] All new tables have `organization_id` column
- [ ] All new tables have RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- [ ] All new tables have 4 policies (SELECT, INSERT, UPDATE, DELETE)
- [ ] Indexes created on `organization_id` and `job_site_id` columns
- [ ] Application code uses `user.org_id` from context (not hardcoded)
- [ ] All Supabase queries explicitly filter by `organization_id`
- [ ] No `service_role` key used in client code
- [ ] Tested with 2+ test organizations
- [ ] Cross-org data access verified as blocked
- [ ] Helper functions working correctly

---

## Common Issues & Solutions

### Issue: "New table not appearing in queries"
**Cause**: RLS enabled but no policies
**Solution**: Add SELECT policy allowing org access

### Issue: "Cannot insert data, permission denied"
**Cause**: INSERT policy missing or too restrictive
**Solution**: Add INSERT policy with `WITH CHECK (organization_id = get_user_org_id())`

### Issue: "Users see data from other orgs"
**Cause**: RLS not enabled or missing policies
**Solution**: Enable RLS and add org-filtered policies

### Issue: "Admin cannot see anything"
**Cause**: RLS policies don't check `is_user_admin()`
**Solution**: Update policies to include admin override

---

## Additional Resources

- **RLS Documentation**: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- **Supabase RLS Guide**: https://supabase.com/docs/guides/auth/row-level-security
- **Migration File**: `migrations/001_multi_tenant_schema.sql`
- **Verification Script**: `verify_rls_security.sql`
- **Audit Report**: `docs/rls-audit-report.md`

---

## Maintenance

This document should be updated when:
- New tenant-scoped tables are added
- RLS policies are modified
- New security patterns are introduced
- Security vulnerabilities are discovered and fixed

**Last Security Audit**: January 14, 2026
**Next Scheduled Audit**: Quarterly
