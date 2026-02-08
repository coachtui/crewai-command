# Job Site Switcher Implementation - Complete ✅

## Overview
The Job Site Switcher feature has been **fully implemented** in the CrewAI Command application. This enables multi-tenant job site management with proper data isolation and filtering.

## What Was Already Implemented ✅

1. **JobSiteContext** ([src/contexts/JobSiteContext.tsx](src/contexts/JobSiteContext.tsx))
   - State management for current job site
   - Role-based access control
   - localStorage persistence
   - Real-time updates via Supabase subscriptions

2. **JobSiteSelector Component** ([src/components/navigation/JobSiteSelector.tsx](src/components/navigation/JobSiteSelector.tsx))
   - Desktop dropdown with site list
   - Mobile full-screen modal
   - Site status badges
   - Click outside to close

3. **Sidebar Integration** ([src/components/layout/Sidebar.tsx](src/components/layout/Sidebar.tsx))
   - Embedded job site selector
   - Desktop and mobile variants
   - Touch-optimized interactions

## What Was Just Implemented ✅

### 1. Data Filtering by Job Site

Updated all pages to filter data by the currently selected job site:

#### **Workers Page** ([src/pages/admin/Workers.tsx](src/pages/admin/Workers.tsx:43))
- ✅ Fetches only workers assigned to `currentJobSite.id`
- ✅ Creates new workers with `job_site_id` set to current site
- ✅ Re-fetches data when job site changes
- ✅ Uses `organization_id` instead of deprecated `org_id`

**Changes:**
```typescript
// Before: fetched ALL workers
.from('workers').select('*').order('name')

// After: filters by current job site
.from('workers').select('*')
  .eq('job_site_id', currentJobSite.id)
  .order('name')
```

#### **Tasks Page** ([src/pages/admin/Tasks.tsx](src/pages/admin/Tasks.tsx:52))
- ✅ Fetches only tasks for `currentJobSite.id`
- ✅ Filters assignments via task join
- ✅ Filters task drafts by job site
- ✅ Creates new tasks/drafts with `job_site_id` set

**Changes:**
```typescript
// Tasks filtered by job site
.from('tasks').select('*')
  .eq('job_site_id', currentJobSite.id)
  .order('start_date')

// Assignments filtered by task's job site
.from('assignments')
  .select('*, worker:workers(*), task:tasks!inner(job_site_id)')
  .eq('task.job_site_id', currentJobSite.id)
```

#### **Calendar Page** ([src/pages/admin/Calendar.tsx](src/pages/admin/Calendar.tsx:55))
- ✅ Shows only tasks for current job site
- ✅ Filters assignments by job site
- ✅ Updates both calendar and Gantt chart views

**Changes:**
```typescript
// Calendar data filtered by job site
supabase.from('tasks').select('*')
  .eq('job_site_id', currentJobSite.id)
  .order('start_date')
```

#### **Activities Page** ([src/pages/admin/Activities.tsx](src/pages/admin/Activities.tsx:57))
- ✅ Shows only assignment activities for current job site
- ✅ Filters via task relationship
- ✅ Last 7 days of activity scoped to site

**Changes:**
```typescript
// Activities filtered by task's job site
.from('assignments')
  .select('*, task:tasks!inner(name, job_site_id), worker:workers(name)')
  .eq('task.job_site_id', currentJobSite.id)
```

#### **Daily Hours Page** ([src/pages/admin/DailyHours.tsx](src/pages/admin/DailyHours.tsx:112))
- ✅ Shows only workers from current job site
- ✅ Filters tasks dropdown by job site
- ✅ Filters daily hours by workers in current site
- ✅ Weekly summary respects job site filter

**Changes:**
```typescript
// Workers filtered by job site
.from('workers').select('*')
  .eq('organization_id', userData.org_id)
  .eq('job_site_id', currentJobSite.id)

// Tasks filtered by job site
.from('tasks').select('*')
  .eq('organization_id', userData.org_id)
  .eq('job_site_id', currentJobSite.id)
```

#### **AssignmentModal** ([src/components/assignments/AssignmentModal.tsx](src/components/assignments/AssignmentModal.tsx:39))
- ✅ Shows only workers from current job site
- ✅ Prevents assigning workers from other sites
- ✅ Properly scoped worker picker

**Changes:**
```typescript
// Worker list filtered by current job site
supabase.from('workers').select('*')
  .eq('job_site_id', currentJobSite.id)
  .eq('status', 'active')
  .order('name')
```

### 2. SQL Backfill Scripts

Created two SQL scripts to assign existing data to the specified job site:

#### **Advanced Script** ([backfill_job_site_id.sql](backfill_job_site_id.sql))
- Uses PostgreSQL variables for flexibility
- Includes data validation and integrity checks
- Provides detailed logging and summary reports
- Has rollback instructions

#### **Simple Script** ([backfill_job_site_simple.sql](backfill_job_site_simple.sql))
- Ready to run in Supabase SQL Editor
- Step-by-step sections with preview queries
- Hardcoded job site ID: `82c30df1-d4c2-45cf-9761-e51a04564640`
- Verification queries included

## How to Complete the Setup

### Step 1: Run the SQL Backfill Script

Choose **ONE** of the following options:

#### Option A: Simple Script (Recommended)
1. Open Supabase SQL Editor
2. Copy contents from `backfill_job_site_simple.sql`
3. Review each section carefully
4. Run sections sequentially (not all at once)
5. Verify the summary reports

#### Option B: Advanced Script
1. Connect to your database via `psql`
2. Run: `psql -d your_database -f backfill_job_site_id.sql`
3. Review the output logs

### Step 2: Verify Data Assignment

After running the SQL script, verify in Supabase:

```sql
-- Check workers
SELECT COUNT(*), job_site_id
FROM workers
GROUP BY job_site_id;

-- Check tasks
SELECT COUNT(*), job_site_id
FROM tasks
GROUP BY job_site_id;

-- Should show all data assigned to: 82c30df1-d4c2-45cf-9761-e51a04564640
```

### Step 3: Test Job Site Switching

1. **Login** to the application
2. **Verify** you see the Job Site Selector in the sidebar
3. **Switch** between job sites (if you have multiple assigned)
4. **Observe** that data updates automatically:
   - Workers page shows only workers for the selected site
   - Tasks page shows only tasks for the selected site
   - Calendar shows only events for the selected site
   - Activities show only activities for the selected site
   - Daily Hours shows only workers and tasks for the selected site

### Step 4: Test Creating New Records

1. **Switch** to your target job site
2. **Create** a new worker → Should automatically assign to current job site
3. **Create** a new task → Should automatically assign to current job site
4. **Switch** to a different job site → New records should NOT appear
5. **Switch back** → New records SHOULD appear

## Key Implementation Details

### useJobSite Hook
All pages now import and use the `useJobSite` hook:

```typescript
import { useJobSite } from '../../contexts';

export function Workers() {
  const { currentJobSite } = useJobSite();

  useEffect(() => {
    if (currentJobSite) {
      fetchWorkers();
    }
  }, [currentJobSite?.id]); // Re-fetch when site changes
}
```

### Query Pattern
Consistent pattern across all data fetches:

```typescript
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('job_site_id', currentJobSite.id)  // Filter by site
  .order('name');
```

### Insert Pattern
New records automatically include job_site_id:

```typescript
const { error } = await supabase
  .from('workers')
  .insert([{
    ...workerData,
    organization_id: user.org_id,
    job_site_id: currentJobSite.id  // Current site
  }]);
```

### Related Data Filtering
Assignments and daily_hours filtered via joins:

```typescript
// Assignments filtered by task's job site
.select('*, task:tasks!inner(job_site_id)')
.eq('task.job_site_id', currentJobSite.id)

// Daily hours filtered by worker IDs from current site
.in('worker_id', workerIdsFromCurrentSite)
```

## Database Schema Notes

### Column Name Changes
The implementation uses the correct column names:
- ✅ `organization_id` (NOT `org_id`)
- ✅ `job_site_id` (new column)

### Key Tables with job_site_id
- `workers` - Direct job_site_id column
- `tasks` - Direct job_site_id column
- `task_drafts` - Direct job_site_id column
- `assignments` - Filtered via tasks relationship
- `daily_hours` - Filtered via workers relationship

## Access Control

### Who Sees the Job Site Selector?
- ✅ **Superintendents** with multiple sites
- ✅ **Engineers** with multiple sites
- ✅ **Foremen** with multiple sites
- ❌ **Company Admins** (see all sites, no selector needed)
- ❌ **Workers** with single site (no switching needed)

Logic in [JobSiteContext.tsx](src/contexts/JobSiteContext.tsx:319):

```typescript
export function useShouldShowJobSiteSelector(): boolean {
  const { user } = useAuth();
  const { availableJobSites, isAdmin } = useJobSite();

  if (isAdmin) return false; // Admins see all data
  if (user?.base_role === 'worker') return false; // Workers don't switch

  return availableJobSites.length > 1; // Show if 2+ sites
}
```

## Testing Checklist

- [ ] Run SQL backfill script
- [ ] Verify all workers assigned to job site
- [ ] Verify all tasks assigned to job site
- [ ] Login to application
- [ ] See job site selector in sidebar
- [ ] Workers page shows filtered data
- [ ] Tasks page shows filtered data
- [ ] Calendar page shows filtered data
- [ ] Activities page shows filtered data
- [ ] Daily Hours page shows filtered data
- [ ] Create new worker → assigned to current site
- [ ] Create new task → assigned to current site
- [ ] Switch job sites → data updates automatically
- [ ] Assignment modal shows workers from current site only

## Troubleshooting

### Issue: No data appears after switching
**Solution:** Run the SQL backfill script to assign job_site_id to existing data.

### Issue: Job site selector doesn't appear
**Causes:**
1. User is an admin (admins see all data, no selector)
2. User has only one job site assigned
3. User is a worker (workers don't switch sites)

**Check:**
```sql
SELECT * FROM job_site_assignments
WHERE user_id = 'YOUR_USER_ID' AND is_active = true;
```

### Issue: SQL script fails
**Common causes:**
1. Job site doesn't exist → Create it first
2. Wrong job site ID → Update the ID in the script
3. Column doesn't exist → Check schema migrations

### Issue: TypeScript errors
**Solution:** The IDE may show cached diagnostics. Try:
1. Restart TypeScript server
2. Run `npm run build` to verify
3. Check terminal for actual errors

## Files Changed

### Context & Hooks
- [src/contexts/JobSiteContext.tsx](src/contexts/JobSiteContext.tsx) - Already implemented

### Components
- [src/components/navigation/JobSiteSelector.tsx](src/components/navigation/JobSiteSelector.tsx) - Already implemented
- [src/components/layout/Sidebar.tsx](src/components/layout/Sidebar.tsx) - Already integrated
- [src/components/assignments/AssignmentModal.tsx](src/components/assignments/AssignmentModal.tsx) - **✅ Updated to filter workers**

### Pages
- [src/pages/admin/Workers.tsx](src/pages/admin/Workers.tsx) - **✅ Added job site filtering**
- [src/pages/admin/Tasks.tsx](src/pages/admin/Tasks.tsx) - **✅ Added job site filtering**
- [src/pages/admin/Calendar.tsx](src/pages/admin/Calendar.tsx) - **✅ Added job site filtering**
- [src/pages/admin/Activities.tsx](src/pages/admin/Activities.tsx) - **✅ Added job site filtering**
- [src/pages/admin/DailyHours.tsx](src/pages/admin/DailyHours.tsx) - **✅ Added job site filtering**

### SQL Scripts
- [backfill_job_site_id.sql](backfill_job_site_id.sql) - **✅ Created advanced backfill script**
- [backfill_job_site_simple.sql](backfill_job_site_simple.sql) - **✅ Created simple backfill script**

## Next Steps

1. **Run the SQL backfill script** to assign job_site_id to existing data
2. **Test the job site switcher** by logging in and switching sites
3. **Verify data filtering** works correctly across all pages
4. **Test creating new records** to ensure they're assigned to the correct site
5. **Monitor for any issues** and check the browser console for errors

## Architecture Benefits

✅ **Data Isolation** - Users only see data for their assigned job sites
✅ **Performance** - Queries filtered at the database level
✅ **Security** - RLS policies enforce job site boundaries
✅ **UX** - Seamless switching with automatic data refresh
✅ **Scalability** - Supports unlimited job sites per organization

---

**Implementation Status:** ✅ **COMPLETE**
**Ready for Testing:** ✅ **YES**
**SQL Scripts Ready:** ✅ **YES**

Questions or issues? Check the troubleshooting section above or review the code changes in the linked files.
