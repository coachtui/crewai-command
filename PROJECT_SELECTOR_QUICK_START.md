# Project Selector - Quick Start & Troubleshooting

## Quick Start (5 Minutes)

### 1. Check if Project Selector is Already Working

1. Open the app and login as a **non-admin user** with **2+ projects**
2. Look for the **"📍 Project Name"** dropdown in the sidebar (desktop)
3. Click it - you should see a list of your projects
4. Click a different project
5. Notice the sidebar dropdown value changed
6. **Refresh the page** - the same project should still be selected
7. Go to the **Workers**, **Tasks**, **Calendar**, **Activities**, or **Daily Hours** page
8. The data should automatically filter to show only records from the selected project

**If all of that works ✅ You're done!** The system is fully implemented.

---

## How to Add Project Filtering to a New Page

If you're building a new page and want to add project filtering:

### Step 1: Import the Hook

```typescript
import { useJobSite } from '../../contexts';
```

### Step 2: Get Current Project

```typescript
const { currentJobSite } = useJobSite();
```

### Step 3: Refetch When Project Changes

```typescript
useEffect(() => {
  if (currentJobSite) {
    fetchData();
  }
}, [currentJobSite?.id]);
```

### Step 4: Filter Your Query

```typescript
const { data } = await supabase
  .from('your_table')
  .select('*')
  .eq('job_site_id', currentJobSite.id)  // ← Add this line
  .order('created_at');
```

### Step 5: Subscribe to Real-Time Changes (Optional but Recommended)

```typescript
import { useRealtimeSubscription } from '../../lib/hooks/useRealtime';

useRealtimeSubscription('your_table', useCallback(() => {
  fetchData();
}, []));
```

**That's it!** Your page now filters by project.

---

## Troubleshooting

### Problem: Selector Doesn't Appear

**Symptom:** No dropdown in sidebar

**Causes & Solutions:**

1. **User is an admin**
   - Admins see company-wide data, not project-specific
   - This is intentional - they don't need to select a project
   - Test with a non-admin user instead

2. **User has only 1 project**
   - The selector intentionally hides if only 1 project
   - Create a second project to test
   - Or check the code: `useShouldShowJobSiteSelector()` at line 319 of JobSiteContext.tsx

3. **User has 0 projects**
   - No projects assigned
   - Admin needs to assign the user to a project
   - Go to job_site_assignments table in Supabase and add a record

**Debug:**
```typescript
// In browser console on any page
const { availableJobSites, isAdmin } = useJobSite();
console.log('Available sites:', availableJobSites);
console.log('Is admin:', isAdmin);
// If availableJobSites.length > 1 and !isAdmin, selector should show
```

---

### Problem: Data Doesn't Filter When Selecting Project

**Symptom:** Click a project, but page shows the same data

**Likely Cause:** Page not filtering by `job_site_id`

**Check the page code:**

```typescript
// ❌ WRONG - No filtering
const fetchData = async () => {
  const { data } = await supabase
    .from('workers')
    .select('*');
  setData(data);
};

// ✅ CORRECT - Filters by job_site_id
const fetchData = async () => {
  const { data } = await supabase
    .from('workers')
    .select('*')
    .eq('job_site_id', currentJobSite.id)  // ← Must have this
    .order('name');
  setData(data);
};
```

**Solution:** Add the `.eq('job_site_id', currentJobSite.id)` line to all queries.

---

### Problem: Selection Not Persisting Across Refresh

**Symptom:** Select a project, refresh page, different project selected

**Likely Cause:** localStorage disabled or cleared

**Check:**
```javascript
// In browser console
localStorage.getItem('crewai_last_job_site_id');
// Should return a UUID like: '123e4567-e89b-12d3-a456-426614174000'
```

**Solutions:**

1. **Check if localStorage is enabled**
   - Chrome DevTools → Application → Local Storage
   - Should see `crewai_last_job_site_id` key

2. **Check if browser is in privacy/incognito mode**
   - Try normal browsing mode
   - Privacy mode blocks localStorage

3. **Check if site is served over HTTP**
   - Some browsers block localStorage for HTTP
   - Make sure using HTTPS or localhost

4. **Clear and try again**
   ```javascript
   localStorage.clear();
   // Then select a project again
   localStorage.getItem('crewai_last_job_site_id');
   ```

---

### Problem: Real-Time Data Not Updating

**Symptom:**
- Open app in 2 windows
- Select different projects
- Create data in window 1
- Window 2 doesn't show new data until manual refresh

**Likely Cause:** Real-time subscription not set up on the page

**Check the page has:**

```typescript
// ✅ REQUIRED for real-time updates
useRealtimeSubscription('table_name', useCallback(() => {
  fetchData();
}, []));
```

**If missing:**

Add this to your page:

```typescript
import { useRealtimeSubscription } from '../../lib/hooks/useRealtime';

// Inside your component
useRealtimeSubscription('your_table', useCallback(() => {
  fetchData();
}, []));
```

**Debug real-time:**
```javascript
// In browser console, look for messages like:
// [supabase] Subscription established
// [supabase] Received message
```

---

### Problem: New Records Don't Include job_site_id

**Symptom:** Create a new record, then can't find it in the correct project

**Likely Cause:** Not including `job_site_id` when inserting

**❌ WRONG:**
```typescript
const { error } = await supabase
  .from('workers')
  .insert([{ name, role }]);  // Missing job_site_id!
```

**✅ CORRECT:**
```typescript
const { currentJobSite } = useJobSite();
const { user } = useAuth();

const { error } = await supabase
  .from('workers')
  .insert([{
    name,
    role,
    organization_id: user.org_id,
    job_site_id: currentJobSite.id  // ← REQUIRED
  }]);
```

**Solution:** Always include both:
- `organization_id: user.org_id`
- `job_site_id: currentJobSite.id`

---

### Problem: User Can't Access a Project They're Assigned To

**Symptom:** User sees project in selector, but gets errors when trying to use it

**Likely Cause:** Missing or inactive job_site_assignment record

**Check in Supabase:**

```sql
-- Check user's assignments
SELECT *
FROM job_site_assignments
WHERE user_id = 'user-uuid-here'
ORDER BY created_at DESC;

-- Should see records like:
-- id | user_id | job_site_id | role | is_active | start_date
```

**Solutions:**

1. **Check if assignment exists**
   ```sql
   SELECT COUNT(*) FROM job_site_assignments
   WHERE user_id = 'user-id' AND job_site_id = 'site-id';
   -- Should return 1 or more
   ```

2. **Check if assignment is active**
   ```sql
   SELECT * FROM job_site_assignments
   WHERE user_id = 'user-id' AND job_site_id = 'site-id'
   AND is_active = true;
   ```

3. **If inactive, activate it**
   ```sql
   UPDATE job_site_assignments
   SET is_active = true
   WHERE user_id = 'user-id' AND job_site_id = 'site-id';
   ```

4. **Check end_date**
   ```sql
   SELECT end_date FROM job_site_assignments
   WHERE user_id = 'user-id' AND job_site_id = 'site-id';
   -- If end_date is in the past, assignment expired
   -- Update: UPDATE ... SET end_date = NULL;
   ```

---

### Problem: Admin Can't See All Projects

**Symptom:** Admin user only sees some projects

**Likely Cause:** Not actually an admin

**Check:**

```sql
-- Check user's base_role
SELECT id, email, base_role FROM user_profiles
WHERE email = 'user@example.com';

-- Should show base_role = 'admin'
```

**If not admin:**

```sql
-- Make user an admin
UPDATE user_profiles
SET base_role = 'admin'
WHERE email = 'user@example.com';
```

**Also check that code:**
```typescript
// In JobSiteContext.tsx, line 35
const isAdmin = user?.base_role === 'admin' || user?.role === 'admin';

// If true, should fetch ALL job sites
if (isAdmin) {
  const { data } = await supabase
    .from('job_sites')
    .select('*')
    .eq('organization_id', user.org_id);
  // Returns all projects in org
}
```

---

## Verification Checklist

Run this checklist to verify everything is working:

### ✅ Setup Check
- [ ] App runs without errors
- [ ] Can login with a user
- [ ] Sidebar displays (desktop)
- [ ] Mobile menu works (mobile)

### ✅ Selector Check
- [ ] **Non-admin user with 2+ projects** - selector appears
- [ ] **Non-admin user with 1 project** - selector hidden
- [ ] **Admin user** - selector hidden
- [ ] **Worker user** - selector hidden

### ✅ Selection Check
- [ ] Click a project in dropdown
- [ ] Value changes immediately
- [ ] Page data updates
- [ ] localStorage updated: `localStorage.getItem('crewai_last_job_site_id')`

### ✅ Persistence Check
- [ ] Select a project
- [ ] Refresh page
- [ ] Same project still selected
- [ ] Data filtered to same project

### ✅ Multi-Project Check
- [ ] Select project A
- [ ] Create a worker named "TestA"
- [ ] Worker appears in list
- [ ] Select project B
- [ ] TestA not visible
- [ ] Select project A again
- [ ] TestA visible again

### ✅ Real-Time Check
- [ ] Open 2 browser windows side-by-side
- [ ] Both logged in as same user
- [ ] Window 1: Select Project A
- [ ] Window 2: Select Project B
- [ ] Window 1: Create a new worker
- [ ] Worker appears instantly in Window 1
- [ ] Worker not visible in Window 2
- [ ] Window 2: Switch to Project A
- [ ] Worker now visible in Window 2

### ✅ Edge Case Check
- [ ] Try deleting a project user is viewing
- [ ] User automatically switched to another project
- [ ] Revoke user access to a project
- [ ] User automatically switched to available project
- [ ] Try project with no records
- [ ] Page shows empty state (no errors)

### ✅ Page Check
- [ ] Workers page filters by project
- [ ] Tasks page filters by project
- [ ] Calendar page filters by project
- [ ] Daily Hours page filters by project
- [ ] Activities page filters by project

### ✅ API Check
- [ ] Create worker: includes job_site_id
- [ ] Create task: includes job_site_id
- [ ] Create assignment: filters by job_site_id
- [ ] All queries have `.eq('job_site_id', ...)`

---

## Performance Checklist

Make sure your implementation is optimized:

### ✅ Indexes Exist
```sql
-- Run this to verify indexes
SELECT tablename, indexname
FROM pg_indexes
WHERE indexname LIKE '%job_site%'
ORDER BY tablename;

-- Should see:
-- workers | idx_workers_job_site
-- tasks | idx_tasks_job_site
-- assignments | idx_assignments_job_site
-- daily_hours | idx_daily_hours_job_site
-- activities | idx_activities_job_site
```

### ✅ Queries Use Indexed Fields

Check that all queries filter by job_site_id:

```typescript
// ✅ Good - Uses indexed field
.eq('job_site_id', currentJobSite.id)

// ❌ Bad - Filters on non-indexed field
.eq('name', 'something')
.gte('created_at', date)
```

### ✅ Real-Time Subscriptions Only On Needed Tables

```typescript
// ✅ Good - Only subscribe to relevant tables
useRealtimeSubscriptions([
  { table: 'workers', onUpdate: ... },
  { table: 'tasks', onUpdate: ... },
]);

// ❌ Bad - Subscribes to ALL tables
useRealtimeSubscription('*', ...);
```

---

## Database Diagnostics

If something seems broken, run these queries:

### 1. Check RLS is Enabled

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('workers', 'tasks', 'assignments', 'daily_hours')
ORDER BY tablename;

-- Should show rowsecurity = true for all
```

### 2. Count Records per Project

```sql
-- See how many workers per project
SELECT job_site_id, COUNT(*) as worker_count
FROM workers
GROUP BY job_site_id
ORDER BY worker_count DESC;
```

### 3. Find Records Missing job_site_id

```sql
-- Find workers without job_site_id
SELECT id, name FROM workers WHERE job_site_id IS NULL;

-- Find tasks without job_site_id
SELECT id, name FROM tasks WHERE job_site_id IS NULL;
```

### 4. Check User Assignments

```sql
-- See all projects a user is assigned to
SELECT u.email, j.name, a.role, a.is_active
FROM job_site_assignments a
JOIN user_profiles u ON a.user_id = u.id
JOIN job_sites j ON a.job_site_id = j.id
WHERE u.email = 'user@example.com'
ORDER BY j.name;
```

### 5. Verify Job Site Exists

```sql
-- See all active projects
SELECT id, name, status FROM job_sites
WHERE status = 'active'
ORDER BY name;
```

---

## Common Mistakes to Avoid

### ❌ Mistake 1: Forgetting job_site_id in INSERT

```typescript
// WRONG - No job_site_id
const { error } = await supabase
  .from('workers')
  .insert([{ name, role }]);

// CORRECT
const { error } = await supabase
  .from('workers')
  .insert([{
    name,
    role,
    organization_id: user.org_id,
    job_site_id: currentJobSite.id
  }]);
```

### ❌ Mistake 2: Forgetting `.eq('job_site_id', ...)` in SELECT

```typescript
// WRONG - No filter
const { data } = await supabase
  .from('workers')
  .select('*');

// CORRECT
const { data } = await supabase
  .from('workers')
  .select('*')
  .eq('job_site_id', currentJobSite.id);
```

### ❌ Mistake 3: Forgetting dependency in useEffect

```typescript
// WRONG - Never refetches when project changes
useEffect(() => {
  fetchData();
}, []); // Missing currentJobSite

// CORRECT - Refetches when project changes
useEffect(() => {
  if (currentJobSite) {
    fetchData();
  }
}, [currentJobSite?.id]);
```

### ❌ Mistake 4: Forgetting to handle null currentJobSite

```typescript
// WRONG - Crashes if currentJobSite is null
const fetchData = async () => {
  const { data } = await supabase
    .from('workers')
    .select('*')
    .eq('job_site_id', currentJobSite.id); // currentJobSite could be null!
};

// CORRECT - Check for null
const fetchData = async () => {
  if (!currentJobSite) {
    setData([]);
    return;
  }

  const { data } = await supabase
    .from('workers')
    .select('*')
    .eq('job_site_id', currentJobSite.id);
  setData(data || []);
};
```

### ❌ Mistake 5: Not subscribing to real-time

```typescript
// WRONG - Page doesn't update when data changes in Supabase
export function Workers() {
  const { currentJobSite } = useJobSite();

  useEffect(() => {
    if (currentJobSite) {
      fetchWorkers();
    }
  }, [currentJobSite?.id]);

  // No subscription - only updates when project changes!
}

// CORRECT - Subscribes to real-time updates
export function Workers() {
  const { currentJobSite } = useJobSite();

  useEffect(() => {
    if (currentJobSite) {
      fetchWorkers();
    }
  }, [currentJobSite?.id]);

  // Subscribe to updates
  useRealtimeSubscription('workers', useCallback(() => {
    fetchWorkers();
  }, []));
}
```

---

## Testing Scenarios

### Scenario 1: Multi-Tab Sync

**Goal:** Verify changes sync across browser tabs

1. Open 2 browser tabs to the app
2. Both tabs: Login as same user
3. Tab 1: Select Project A
4. Tab 2: Should auto-update to Project A
5. Tab 1: Create a new worker
6. Tab 2: Worker appears immediately

**Expected:** Both tabs stay in sync

### Scenario 2: Project Switching

**Goal:** Verify data filters correctly

1. Go to Workers page
2. Project A: Create "Worker A"
3. Project B: Create "Worker B"
4. Verify Worker A appears in Project A, not B
5. Verify Worker B appears in Project B, not A

**Expected:** Each project shows only its records

### Scenario 3: Permission Isolation

**Goal:** Verify users only see assigned projects

1. Admin: Assign User1 to Project A only
2. Assign User2 to Project B only
3. Login as User1
4. Selector shows only Project A
5. Logout, login as User2
6. Selector shows only Project B

**Expected:** Users see only assigned projects

### Scenario 4: Persistence

**Goal:** Verify selection survives page refresh

1. Select Project X
2. Note the URL and data
3. Refresh page
4. Same project still selected
5. Same data visible

**Expected:** Selection persists

---

## Performance Testing

### Query Performance

Check that queries are fast:

```typescript
// Add timing
console.time('fetch-workers');
const { data } = await supabase
  .from('workers')
  .select('*')
  .eq('job_site_id', currentJobSite.id);
console.timeEnd('fetch-workers');

// Should be < 100ms with index
```

### Real-Time Performance

Check that updates are instant:

```typescript
// Log when update received
useRealtimeSubscription('workers', () => {
  console.log('Real-time update received at', new Date().toISOString());
  fetchWorkers();
});
```

### Memory Usage

Check that app doesn't leak memory:

1. Open DevTools → Memory
2. Create and delete 100 workers
3. Force garbage collection
4. Memory should return to baseline

---

## Getting Help

### When Something Breaks:

1. **Check browser console** for errors
2. **Check Supabase logs** for database errors
3. **Run verification checklist** above
4. **Check the troubleshooting section** for your symptom
5. **Run database diagnostics** to verify data
6. **Look at working page code** (Workers.tsx) and compare

### Files to Reference:

- `src/contexts/JobSiteContext.tsx` - How project selection works
- `src/pages/admin/Workers.tsx` - Example of filtering implementation
- `migrations/001_multi_tenant_schema.sql` - Database setup
- `verify_rls_security.sql` - Database verification
- `PROJECT_SELECTOR_CODE_REFERENCE.md` - Exact code examples

---

## Summary

✅ **The project selector is fully implemented**

You have:
- Global state management (JobSiteContext)
- UI component (JobSiteSelector)
- Integration in all pages (Workers, Tasks, Calendar, Activities, DailyHours)
- Database support (job_site_id on all tables)
- Real-time synchronization
- Selection persistence

**Just use it!** All pages automatically support project filtering via `useJobSite()`.

