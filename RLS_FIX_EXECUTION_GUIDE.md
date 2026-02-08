# RLS Security Fix - Execution Guide

## Problem Summary

Your database has **critical security issues**:
1. ❌ RLS is DISABLED on 9 critical tables
2. ❌ Missing `job_site_id` columns (migration not run)
3. ❌ Missing or incomplete RLS policies
4. ❌ Insecure "Allow all" policies on holidays table

## Solution

I've created **3 SQL files** to help you fix this:

---

## File 1: `diagnose_schema_state.sql`

**Purpose**: Check current database state

**Run this FIRST** to see what's missing:

```bash
psql YOUR_DATABASE_URL -f diagnose_schema_state.sql
```

Or in Supabase SQL Editor:
- Copy contents of [diagnose_schema_state.sql](diagnose_schema_state.sql)
- Paste into SQL Editor
- Click "Run"

This will show you:
- Which columns exist/are missing
- Which helper functions exist
- RLS status for all tables

---

## File 2: `fix_schema_and_rls_complete.sql` ⭐ **MAIN FIX**

**Purpose**: Complete fix - adds missing columns + enables RLS + creates policies

**This is the ONE file you need to run** to fix everything:

```bash
psql YOUR_DATABASE_URL -f fix_schema_and_rls_complete.sql
```

Or in Supabase SQL Editor:
- Copy contents of [fix_schema_and_rls_complete.sql](fix_schema_and_rls_complete.sql)
- Paste into SQL Editor
- Click "Run"

**What it does** (in order):
1. Adds missing `job_site_id` columns to all tables
2. Renames `org_id` → `organization_id` for consistency
3. Creates performance indexes
4. Creates/updates all RLS helper functions
5. Enables RLS on all tables
6. Drops old/insecure policies
7. Creates comprehensive RLS policies for:
   - organizations (2 policies)
   - user_profiles (4 policies)
   - job_sites (4 policies)
   - job_site_assignments (4 policies)
   - workers (4 policies)
   - tasks (4 policies)
   - assignments (4 policies)
   - assignment_requests (4 policies)
   - holidays (4 policies)
   - task_history (2 policies, if exists)
   - task_drafts (4 policies, if exists)
   - users (1 policy, if exists)
8. Verifies the fix worked

**Safe to run multiple times** - all operations use `IF NOT EXISTS` or `CREATE OR REPLACE`.

---

## File 3: `verify_rls_security.sql`

**Purpose**: Comprehensive security audit

**Run this AFTER the fix** to verify everything worked:

```bash
psql YOUR_DATABASE_URL -f verify_rls_security.sql
```

Expected results:
- ✅ All tables show RLS ENABLED
- ✅ All tables have at least 2-4 policies
- ✅ All helper functions exist
- ✅ No tables missing policies

---

## Recommended Execution Order

### Via Command Line:
```bash
# Step 1: Check current state (optional but helpful)
psql YOUR_DATABASE_URL -f diagnose_schema_state.sql

# Step 2: Apply the fix (REQUIRED)
psql YOUR_DATABASE_URL -f fix_schema_and_rls_complete.sql

# Step 3: Verify it worked (RECOMMENDED)
psql YOUR_DATABASE_URL -f verify_rls_security.sql
```

### Via Supabase SQL Editor:
1. Open Supabase → SQL Editor
2. Run `diagnose_schema_state.sql` (optional)
3. Run `fix_schema_and_rls_complete.sql` (required)
4. Run `verify_rls_security.sql` (verify)

---

## After Running the Fix

### 1. Add Job Sites

Your `job_sites` table is empty. You need to add at least one job site:

**Option A: Via Supabase UI**
- Go to Supabase → Database → job_sites table
- Click "Insert row"
- Fill in:
  - `organization_id`: Your org UUID (from organizations table)
  - `name`: "Main Site" or similar
  - `status`: "active"

**Option B: Via SQL**
```sql
INSERT INTO job_sites (organization_id, name, status)
VALUES (
  (SELECT id FROM organizations LIMIT 1),
  'Main Construction Site',
  'active'
);
```

**Option C: Via SQL with specific org**
```sql
INSERT INTO job_sites (organization_id, name, address, status)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',  -- Replace with your org_id
  'Downtown Construction Project',
  '123 Main St, City, State',
  'active'
);
```

### 2. Assign Users to Job Sites

Users need job site assignments to see data (unless they're admins):

```sql
INSERT INTO job_site_assignments (user_id, job_site_id, role, is_active)
VALUES (
  (SELECT id FROM user_profiles WHERE base_role = 'admin' LIMIT 1),
  (SELECT id FROM job_sites LIMIT 1),
  'superintendent',
  true
);
```

Or assign yourself:
```sql
INSERT INTO job_site_assignments (user_id, job_site_id, role, is_active)
SELECT
  auth.uid(),
  (SELECT id FROM job_sites LIMIT 1),
  'superintendent',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM job_site_assignments
  WHERE user_id = auth.uid()
);
```

### 3. Test the Application

1. **Login as an admin user**
2. **Verify JobSiteSelector** shows the job site
3. **Create a new worker** → should use correct org_id (no more hardcoded UUID!)
4. **Create a new task** → should use correct org_id
5. **Assign worker to task** → should use correct org_id

### 4. Test Cross-Org Isolation

1. Create a second test organization:
   ```sql
   INSERT INTO organizations (name, slug)
   VALUES ('Test Org 2', 'test-org-2');
   ```

2. Create a user in that org (via Supabase Auth UI or SQL)

3. Login as that user

4. **Verify they CANNOT see the first org's data**

---

## What Was Fixed

### Code Fixes (Already Applied ✅)
These were already fixed in your codebase:

- **[Workers.tsx:67](src/pages/admin/Workers.tsx#L67)** - Fixed hardcoded org_id → now uses `user.org_id`
- **[Tasks.tsx:115](src/pages/admin/Tasks.tsx#L115)** - Fixed hardcoded org_id in task creation
- **[Tasks.tsx:142](src/pages/admin/Tasks.tsx#L142)** - Fixed hardcoded org_id in draft saving
- **[AssignmentModal.tsx:86](src/components/assignments/AssignmentModal.tsx#L86)** - Fixed hardcoded org_id in assignments

### Database Fixes (Run SQL to apply)
These need to be applied by running the SQL script:

- ✅ Enable RLS on 9 critical tables
- ✅ Add missing `job_site_id` columns to 4 tables
- ✅ Create 5 RLS helper functions
- ✅ Create 38+ RLS policies across all tables
- ✅ Drop insecure "Allow all" policies
- ✅ Add organization_id to holidays table
- ✅ Rename org_id → organization_id for consistency

---

## Understanding the Policies

### Policy Pattern: Org + Job Site Filtering

Most tables use this pattern:

**SELECT (read)**: Users can see data from their organization AND either:
- They're an admin (sees all), OR
- job_site_id is NULL (org-wide data), OR
- job_site_id matches one of their assigned sites

**INSERT (create)**: Users can create data for their organization if:
- They're an admin, OR
- job_site_id is NULL, OR
- They have access to that job site

**UPDATE (modify)**: Users can update data if:
- They're an admin, OR
- They have access to that job site

**DELETE (remove)**: Usually only admins can delete

### Special Cases

**organizations**: Users can only see/update their own org

**user_profiles**: Users can see all profiles in their org, but only update their own (unless admin)

**job_site_assignments**: Superintendents can manage assignments for their sites

---

## Troubleshooting

### Error: "column job_site_id does not exist"
**Cause**: The migration hasn't been run yet.
**Fix**: Run `fix_schema_and_rls_complete.sql`

### Error: "function get_user_org_id() does not exist"
**Cause**: Helper functions missing.
**Fix**: Run `fix_schema_and_rls_complete.sql`

### Error: "new row violates row-level security policy"
**Cause**: User's org_id doesn't match or they don't have permissions.
**Fix**: Check user's profile:
```sql
SELECT id, email, org_id, base_role FROM user_profiles WHERE id = auth.uid();
```

Make sure:
- `org_id` is not NULL
- `base_role` is set (admin, superintendent, etc.)
- Organization exists in `organizations` table

### Application shows "No job sites available"
**Cause**: Empty job_sites table.
**Fix**: Add at least one job site (see instructions above)

### Workers/Tasks not appearing
**Cause**: User not assigned to any job sites (and not an admin).
**Fix**: Either:
- Make user an admin: `UPDATE user_profiles SET base_role = 'admin' WHERE id = auth.uid();`
- Or assign to a job site (see "Assign Users to Job Sites" above)

---

## Verification Checklist

After running the fix, verify:

- [ ] All tables show "RLS ENABLED" in verification output
- [ ] Each table has 2-4 policies
- [ ] Helper functions exist (5 total)
- [ ] At least one job site exists
- [ ] At least one user assigned to a job site
- [ ] Can create workers with correct org_id (check database)
- [ ] Can create tasks with correct org_id (check database)
- [ ] Can assign workers to tasks
- [ ] Cannot see other organization's data

---

## Quick Start (TL;DR)

```bash
# 1. Run the fix
psql YOUR_DB_URL -f fix_schema_and_rls_complete.sql

# 2. Add a job site
psql YOUR_DB_URL -c "INSERT INTO job_sites (organization_id, name, status) VALUES ((SELECT id FROM organizations LIMIT 1), 'Main Site', 'active');"

# 3. Assign yourself to it
psql YOUR_DB_URL -c "INSERT INTO job_site_assignments (user_id, job_site_id, role, is_active) SELECT auth.uid(), (SELECT id FROM job_sites LIMIT 1), 'superintendent', true;"

# 4. Verify
psql YOUR_DB_URL -f verify_rls_security.sql

# 5. Test the app!
```

---

## Need Help?

If you encounter any errors:

1. **Copy the exact error message**
2. **Show me which step failed**
3. **Share relevant output** from the verification script
4. I'll help you debug!

Ready to proceed? Run:

```bash
psql YOUR_DATABASE_URL -f fix_schema_and_rls_complete.sql
```

Or copy/paste [fix_schema_and_rls_complete.sql](fix_schema_and_rls_complete.sql) into Supabase SQL Editor and click "Run".
