# CrewAI Command: Multi-Tenant Architecture

## Overview

This document describes the multi-tenant architecture implementation for CrewAI Command, enabling complete organizational isolation with job site management capabilities.

## Architecture Summary

```
Organization (Company)
├── Company Admin (Full Access)
├── Job Sites (Projects/Locations)
│   ├── Superintendents (Site Managers)
│   ├── Engineers (Technical Staff)
│   ├── Foremen (Crew Leaders)
│   └── Workers (Field Personnel)
└── Complete Data Isolation Between Companies
```

## Files Created/Modified

### Database Migrations

| File | Description |
|------|-------------|
| `migrations/001_multi_tenant_schema.sql` | Main schema migration - creates job_sites, job_site_assignments tables, updates existing tables, adds RLS policies |
| `migrations/002_migrate_existing_data.sql` | Migrates existing data to the new multi-tenant structure |

### Frontend Components

| File | Description |
|------|-------------|
| `src/types/index.ts` | Updated with JobSite, JobSiteAssignment, and permission types |
| `src/contexts/AuthContext.tsx` | Authentication context with user profile management |
| `src/contexts/JobSiteContext.tsx` | Job site switching and permission management |
| `src/contexts/index.ts` | Central export for all contexts |
| `src/components/navigation/JobSiteSelector.tsx` | Desktop & mobile job site selector dropdown |
| `src/components/layout/Sidebar.tsx` | Updated with job site selector integration |
| `src/lib/roleHelpers.ts` | Extended permission checking utilities |
| `src/App.tsx` | Updated with context providers |

### API Routes

| File | Description |
|------|-------------|
| `api/job-sites/create.ts` | Create new job sites (admin only) |
| `api/job-sites/assign.ts` | Assign users to job sites |
| `api/workers/move.ts` | Move workers between job sites (admin only) |

---

## Installation Steps

### Step 1: Run Database Migrations

```bash
# In Supabase SQL Editor, run in order:

# 1. First run the schema migration
# Open: migrations/001_multi_tenant_schema.sql
# Click RUN

# 2. Then run the data migration
# Open: migrations/002_migrate_existing_data.sql
# Click RUN
```

### Step 2: Add Environment Variable

Add the service role key to your Vercel environment:

```bash
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

Find this in Supabase Dashboard → Settings → API → service_role key

### Step 3: Deploy to Vercel

```bash
# Deploy the updated code
git add .
git commit -m "Add multi-tenant architecture with job site management"
git push origin main
```

---

## Role Definitions

### Company Admin
- **Who:** Company owner, operations manager
- **Permissions:**
  - ✅ View ALL job sites in company
  - ✅ Create/edit/delete job sites
  - ✅ Assign personnel to job sites
  - ✅ Move workers between sites
  - ✅ Manage user roles
  - ✅ Company-wide reports

### Superintendent
- **Who:** Project superintendent
- **Permissions:**
  - ✅ View assigned job site(s)
  - ✅ Create/edit/delete tasks
  - ✅ Assign workers to tasks
  - ✅ Approve reassignment requests
  - ✅ Clock workers in/out
  - ❌ Cannot create job sites
  - ❌ Cannot move workers between sites

### Engineer
- **Who:** Project engineer, safety engineer
- **Standard Permissions:**
  - ✅ View assigned job site(s)
  - ✅ View workers/tasks
  - ✅ Create safety notes
  - ❌ Cannot assign workers

- **As Superintendent (promoted):**
  - ✅ All superintendent permissions

### Foreman
- **Who:** Field crew leader
- **Permissions:**
  - ✅ View assigned job site(s)
  - ✅ Request worker reassignments
  - ✅ Update task status
  - ✅ Clock own crew in/out
  - ❌ Cannot create tasks
  - ❌ Cannot reassign workers directly

### Worker
- **Who:** Field personnel
- **Permissions:**
  - ✅ View own assignments
  - ✅ View own schedule
  - ✅ Clock in/out (self)
  - ❌ No job site switching
  - ❌ Cannot see other workers' data

---

## Database Schema

### New Tables

#### job_sites
```sql
CREATE TABLE job_sites (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  address TEXT,
  description TEXT,
  status TEXT CHECK (status IN ('active', 'on_hold', 'completed')),
  start_date DATE,
  end_date DATE,
  created_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### job_site_assignments
```sql
CREATE TABLE job_site_assignments (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  job_site_id UUID NOT NULL REFERENCES job_sites(id),
  role TEXT CHECK (role IN ('superintendent', 'engineer', 'engineer_as_superintendent', 'foreman', 'worker')),
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN,
  assigned_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Modified Tables

All existing tables now have:
- `organization_id` - Links to the organization
- `job_site_id` - Links to the job site

Tables affected:
- `workers`
- `tasks`
- `assignments`
- `assignment_requests`
- `daily_hours` (if exists)
- `task_history` (if exists)

---

## Frontend Usage

### Using Auth Context

```tsx
import { useAuth, useIsAdmin } from './contexts';

function MyComponent() {
  const { user, isAuthenticated, signOut } = useAuth();
  const isAdmin = useIsAdmin();
  
  if (!isAuthenticated) return <Login />;
  
  return (
    <div>
      <p>Welcome, {user.name}!</p>
      {isAdmin && <AdminPanel />}
    </div>
  );
}
```

### Using Job Site Context

```tsx
import { useJobSite } from './contexts';

function TaskList() {
  const { 
    currentJobSite, 
    availableJobSites, 
    switchJobSite,
    canManageSite,
    isAdmin 
  } = useJobSite();
  
  // Filter data by current job site
  const fetchTasks = async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('job_site_id', currentJobSite?.id);
    return data;
  };
  
  return (
    <div>
      <h2>Tasks at {currentJobSite?.name}</h2>
      {canManageSite && <button>Add Task</button>}
    </div>
  );
}
```

### Checking Permissions

```tsx
import { getPermissions } from './lib/roleHelpers';
import { useAuth, useJobSite } from './contexts';

function PermissionExample() {
  const { user } = useAuth();
  const { userSiteRole, isAdmin } = useJobSite();
  
  const permissions = getPermissions(user, userSiteRole);
  
  return (
    <div>
      {permissions.canCreateTasks && <CreateTaskButton />}
      {permissions.canAssignWorkers && <AssignWorkerButton />}
      {permissions.canMoveWorkersBetweenSites && <MoveWorkerButton />}
    </div>
  );
}
```

---

## API Usage

### Create Job Site

```typescript
const response = await fetch('/api/job-sites/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'New Construction Site',
    address: '123 Main St',
    description: 'Commercial building project',
    status: 'active',
    organization_id: user.org_id,
    created_by: user.id,
  }),
});
```

### Assign User to Job Site

```typescript
const response = await fetch('/api/job-sites/assign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: 'user-uuid',
    job_site_id: 'site-uuid',
    role: 'foreman',
    assigned_by: currentUser.id,
  }),
});
```

### Move Worker Between Sites

```typescript
const response = await fetch('/api/workers/move', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    worker_id: 'worker-uuid',
    from_site_id: 'old-site-uuid',
    to_site_id: 'new-site-uuid',
    effective_date: '2026-01-15',
    moved_by: currentUser.id,
  }),
});
```

---

## Job Site Selector Behavior

### Who Sees the Selector

| Role | Selector Visible | Behavior |
|------|-----------------|----------|
| Admin | ❌ No | Sees company-wide dashboard |
| Superintendent | ✅ If multi-site | Dropdown to switch sites |
| Engineer | ✅ If multi-site | Dropdown to switch sites |
| Foreman | ✅ If multi-site | Dropdown to switch sites |
| Worker | ❌ No | Shows only current assignment |

### Persistence

- Last selected job site is stored in `localStorage`
- Automatically restored on page refresh
- Cleared on logout

---

## RLS (Row Level Security) Policies

### Core Principles

1. **Organization Isolation**: Users can only see data from their organization
2. **Job Site Filtering**: Non-admins only see data from assigned job sites
3. **Role-Based Access**: Different operations require different roles

### Key Policies

```sql
-- Admins see all job sites in their org
CREATE POLICY "job_sites_admin_policy" ON job_sites
  FOR ALL USING (
    organization_id = get_user_org_id() AND is_user_admin()
  );

-- Non-admins only see assigned sites
CREATE POLICY "job_sites_assigned_view_policy" ON job_sites
  FOR SELECT USING (
    id = ANY(get_user_job_site_ids())
  );
```

---

## Testing Checklist

### Multi-Tenancy (Company Isolation)
- [ ] User in Company A cannot see Company B's data
- [ ] Job sites in Company A invisible to Company B users
- [ ] Workers in Company A not visible to Company B

### Job Site Isolation
- [ ] Superintendent on Site A cannot see Site B's workers
- [ ] Foreman on Site A cannot request workers from Site B
- [ ] Voice commands only reference current job site data

### Multi-Site Users
- [ ] Superintendent assigned to Sites A and B sees both in dropdown
- [ ] Switching from Site A to Site B updates all data
- [ ] Last selected site persists across sessions

### Admin Capabilities
- [ ] Admin sees all job sites in dashboard
- [ ] Admin can create new job sites
- [ ] Admin can move workers between sites
- [ ] Admin cannot see other companies' data

### Worker Limitations
- [ ] Workers don't see job site selector
- [ ] Workers only see own assignments
- [ ] Workers automatically see new site after admin moves them

---

## Next Steps

### Phase 2 Features (Future)

1. **Company Signup Flow**
   - New company registration
   - First admin user creation
   - Initial job site setup wizard

2. **Team Invitation System**
   - Email invitations with magic links
   - Role selection during invite
   - Automatic job site assignment

3. **Admin Dashboard**
   - Company-wide metrics
   - Cross-site resource view
   - Worker utilization reports

4. **Voice Command Integration**
   - Job site context in voice parsing
   - Cross-site queries for admins
   - Site-specific worker lookups

---

## Troubleshooting

### "Job sites not loading"
1. Check migrations ran successfully
2. Verify user has `org_id` set
3. Check RLS policies are enabled

### "Cannot see job site selector"
1. Verify user role (workers/admins don't see it)
2. Check user has multiple job site assignments
3. Verify assignments are `is_active = true`

### "Permission denied" errors
1. Check user's `base_role` in user_profiles
2. Verify job site assignment exists
3. Check assignment role matches required permission

### "Data not filtering by job site"
1. Ensure `job_site_id` column exists on table
2. Check RLS policies are enabled
3. Verify frontend is passing job site ID in queries

---

## Support

For issues with this implementation:
1. Check this documentation
2. Review the migration files
3. Test RLS policies in Supabase SQL Editor
4. Verify environment variables are set

---

**Version:** 1.0.0  
**Last Updated:** January 13, 2026  
**Author:** AIGA LLC
