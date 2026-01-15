# Multi-Tenant Project (Job Site) Selector Implementation Guide

## Status: ✅ FULLY IMPLEMENTED

This document outlines the complete multi-tenant job site selector system that's already built into your CrewAI Dashboard. The implementation allows users to select a project (jobsite) from a dropdown that filters all views across the entire application.

---

## Quick Overview

**What's Working:**
- ✅ Global project selector dropdown in sidebar (desktop + mobile)
- ✅ All 5 dashboard pages (Workers, Tasks, Calendar, Daily Hours, Activities) filter by selected project
- ✅ Selection persists across navigation and page refreshes
- ✅ Real-time sync when projects change
- ✅ Role-based access (users see only assigned projects)
- ✅ Multi-tenant database isolation at RLS level

**Key Files:**
- `src/contexts/JobSiteContext.tsx` - Global state management
- `src/components/navigation/JobSiteSelector.tsx` - UI component
- `src/components/layout/Sidebar.tsx` - Integration point
- All pages automatically consume the context

---

## 1. Architecture Overview

### 1.1 State Management (JobSiteContext)

The `JobSiteContext` is the single source of truth for job site selection. It manages:

```typescript
Interface JobSiteContextType {
  currentJobSite: JobSite | null        // Currently selected project
  availableJobSites: JobSite[]          // List of projects user has access to
  isLoading: boolean                    // Loading state during initialization
  userSiteRole: JobSiteRole | null      // User's role at this specific site
  switchJobSite(siteId: string): void   // Change selected project
  refreshJobSites(): void               // Manually refresh available projects
  canManageSite: boolean                // Can user manage this site?
  canViewSite: boolean                  // Can user view this site?
}
```

**Location:** `src/contexts/JobSiteContext.tsx` (334 lines)

### 1.2 Component Integration

```
App.tsx
└── AuthProvider
    └── <ProtectedRoute>
        └── JobSiteProvider  ← All routes wrapped with job site context
            ├── Sidebar
            │   ├── JobSiteSelector (desktop)
            │   └── JobSiteSelectorMobile (mobile)
            └── Main Content Pages
                ├── Workers    ← Uses useJobSite()
                ├── Tasks      ← Uses useJobSite()
                ├── Calendar   ← Uses useJobSite()
                ├── Activities ← Uses useJobSite()
                └── DailyHours ← Uses useJobSite()
```

---

## 2. User Interface

### 2.1 Desktop Job Site Selector

**Location:** `src/components/navigation/JobSiteSelector.tsx` (Desktop version)

**Placement:** Sidebar, just below logo

**Features:**
- Dropdown with all available projects
- Shows project name, address, and status badge
- Selection indicator (check mark) for current project
- Loading spinner during fetch
- Keyboard support (Escape to close)
- Click outside to close
- Custom display names (truncates long names)
- Status color coding:
  - 🟢 `active` - Green
  - 🟡 `on_hold` - Yellow
  - ⚫ `completed` - Gray

**Example UI:**
```
┌─ Project Selector ──────────┐
│ 📍 Main Construction Site  ▼ │
├─────────────────────────────┤
│ YOUR JOB SITES              │
├─────────────────────────────┤
│ ✓ Main Construction Site    │
│   123 Oak St                │
│                       active │
│                             │
│ 🏢 Downtown Project         │
│   456 Main Ave              │
│                    on_hold  │
│                             │
│ 🏢 Renovation Phase 2       │
│   789 Park Blvd             │
│                  completed  │
└─────────────────────────────┘
```

### 2.2 Mobile Job Site Selector

**Location:** `src/components/navigation/JobSiteSelector.tsx` (Mobile version)

**Features:**
- Compact trigger button in mobile header
- Full-screen modal selector
- Large touch targets
- Radio-button style selection

### 2.3 Visibility Rules

The selector is **hidden** if:
- ❌ User is an admin (company-wide view)
- ❌ User is a worker (limited permissions)
- ❌ User has only 1 project (shows as label instead)

The selector is **shown** if:
- ✅ User has 2+ projects
- ✅ User is not admin or worker

---

## 3. How It Works: Step-by-Step

### 3.1 Initialization Flow

When a user logs in or navigates to a protected page:

```
1. AuthProvider checks authentication
   ↓
2. ProtectedRoute wraps content with JobSiteProvider
   ↓
3. JobSiteProvider runs initialization effect
   ├─ If admin: Fetch ALL job sites for organization
   └─ If not admin: Fetch ONLY assigned job sites
   ↓
4. Available job sites loaded
   ├─ Try to restore last selected (from localStorage)
   └─ If not found, use first available
   ↓
5. setCurrentJobSite() called
   ↓
6. Subscribe to real-time job_sites table changes
```

**Code Location:** `src/contexts/JobSiteContext.tsx` lines 180-240

### 3.2 Selection Flow

When user clicks a project in the dropdown:

```
1. User clicks project in JobSiteSelector
   ↓
2. handleSiteSelect() → switchJobSite(siteId)
   ↓
3. Find site in availableJobSites array
   ↓
4. setCurrentJobSite(site)
   ↓
5. Fetch user's role at this site
   ↓
6. Persist to localStorage: localStorage.setItem('crewai_last_job_site_id', siteId)
   ↓
7. Pages detect currentJobSite change via useEffect dependency
   ↓
8. Pages refetch data with new job_site_id filter
   ↓
9. Real-time subscriptions trigger on any changes to this site's data
```

**Code Location:** `src/contexts/JobSiteContext.tsx` lines 136-155

### 3.3 Data Filtering Flow

Every page uses the same pattern:

```typescript
// 1. Get current job site from context
const { currentJobSite } = useJobSite();

// 2. Fetch data filtered by job_site_id
useEffect(() => {
  if (currentJobSite) {
    fetchData();
  }
}, [currentJobSite?.id]);

// 3. Query filters by job_site_id
const fetchData = async () => {
  const { data, error } = await supabase
    .from('table_name')
    .select('*')
    .eq('job_site_id', currentJobSite.id)  // ← KEY FILTER
    .order('field');

  // Update state with filtered data
  setData(data || []);
};

// 4. Subscribe to real-time changes
useRealtimeSubscription('table_name', () => fetchData());
```

---

## 4. Implementation Details by Page

### 4.1 Workers Page

**File:** `src/pages/admin/Workers.tsx`

**Key Implementation:**
```typescript
const { currentJobSite } = useJobSite();  // Line 15

useEffect(() => {
  if (currentJobSite) {
    fetchWorkers();  // Refetch when project changes
  }
}, [currentJobSite?.id]);  // Line 27

const fetchWorkers = async () => {
  const { data, error } = await supabase
    .from('workers')
    .select('*')
    .eq('job_site_id', currentJobSite.id)  // ← FILTER
    .order('name');
};

// When creating workers:
const { error } = await supabase
  .from('workers')
  .insert([{
    ...workerData,
    organization_id: user.org_id,
    job_site_id: currentJobSite.id  // ← REQUIRED
  }]);
```

### 4.2 Tasks Page

**File:** `src/pages/admin/Tasks.tsx`

**Key Implementation:**
```typescript
const { currentJobSite } = useJobSite();  // Line 17

useEffect(() => {
  if (currentJobSite) {
    fetchTasks();
    fetchAssignments();
  }
}, [currentJobSite?.id]);  // Line 33

// Tasks query
const { data: tasks } = await supabase
  .from('tasks')
  .select('*')
  .eq('job_site_id', currentJobSite.id)  // ← FILTER
  .order('start_date');

// Assignments query (with join)
const { data: assignments } = await supabase
  .from('assignments')
  .select('*, worker:workers(*), task:tasks!inner(job_site_id)')
  .eq('task.job_site_id', currentJobSite.id);  // ← FILTER via join
```

### 4.3 Calendar Page

**File:** `src/pages/admin/Calendar.tsx`

**Key Implementation:**
```typescript
const { currentJobSite } = useJobSite();  // Line 24

useEffect(() => {
  if (currentJobSite) {
    fetchData();
  }
}, [currentJobSite?.id]);  // Line 37

// Fetch with filters
const [tasksData, assignmentsData] = await Promise.all([
  supabase.from('tasks')
    .select('*')
    .eq('job_site_id', currentJobSite.id)  // ← FILTER
    .order('start_date'),

  supabase.from('assignments')
    .select('*, worker:workers(*), task:tasks!inner(job_site_id)')
    .eq('task.job_site_id', currentJobSite.id)  // ← FILTER
]);
```

### 4.4 Activities Page

**File:** `src/pages/admin/Activities.tsx`

**Key Implementation:**
```typescript
const { currentJobSite } = useJobSite();  // Line 24

useEffect(() => {
  if (currentJobSite) {
    fetchActivities();
  }
}, [currentJobSite?.id]);  // Line 33

// Fetch assignments for current site (last 7 days)
const { data } = await supabase
  .from('assignments')
  .select('*, task:tasks!inner(name, job_site_id), worker:workers(name)')
  .eq('task.job_site_id', currentJobSite.id)  // ← FILTER
  .gte('created_at', sevenDaysAgo.toISOString())
  .order('created_at', { ascending: false });
```

### 4.5 Daily Hours Page

**File:** `src/pages/admin/DailyHours.tsx`

**Key Implementation:**
```typescript
const { currentJobSite } = useJobSite();  // Line 21

useEffect(() => {
  if (currentJobSite) {
    loadData();
  }
}, [selectedDate, currentJobSite?.id]);  // Line 64

const loadData = async () => {
  // Fetch workers for current site
  const { data: workers } = await supabase
    .from('workers')
    .select('*')
    .eq('job_site_id', currentJobSite.id)  // ← FILTER
    .order('name');

  // Fetch tasks for current site
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('job_site_id', currentJobSite.id)  // ← FILTER
    .order('name');
};
```

---

## 5. Data Model & Database

### 5.1 Schema Structure

All tables include `job_site_id` field to enable filtering:

```sql
-- Workers table
CREATE TABLE workers (
  id UUID PRIMARY KEY,
  organization_id UUID,  -- Company level
  job_site_id UUID,      -- Project level ← KEY FILTER
  name TEXT,
  role TEXT,
  ...
);
CREATE INDEX idx_workers_job_site ON workers(job_site_id);

-- Tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  organization_id UUID,  -- Company level
  job_site_id UUID,      -- Project level ← KEY FILTER
  name TEXT,
  ...
);
CREATE INDEX idx_tasks_job_site ON tasks(job_site_id);

-- Same for assignments, daily_hours, activities, etc.
```

**Migration:** `migrations/001_multi_tenant_schema.sql`

### 5.2 Access Model

```
Organization (company_id)
└── Job Sites (job_site_id)
    ├── Job Site Assignments (user → site + role)
    ├── Workers (org_id + job_site_id)
    ├── Tasks (org_id + job_site_id)
    ├── Assignments (worker → task)
    ├── Daily Hours (worker → date + job_site_id)
    └── Activities (org_id + job_site_id)
```

### 5.3 Permissions & RLS

**Admin users:**
- See ALL job sites in their organization
- Can switch to any site

**Non-admin users:**
- See ONLY sites they're assigned to
- Assignment via `job_site_assignments` table
- Role per site (superintendent, foreman, worker, etc.)

**Code:**
```typescript
if (isAdmin) {
  // Admins see all sites
  const sites = await supabase
    .from('job_sites')
    .select('*')
    .eq('organization_id', user.org_id)
    .order('name');
} else {
  // Non-admins see only assigned sites
  const assignments = await supabase
    .from('job_site_assignments')
    .select('job_site:job_sites(*)')
    .eq('user_id', user.id)
    .eq('is_active', true);
}
```

---

## 6. Persistence Mechanism

### 6.1 localStorage Key

```javascript
const LAST_JOB_SITE_KEY = 'crewai_last_job_site_id';
```

**When Saved:**
- After user clicks a project
- Selection persists in localStorage

**When Restored:**
```typescript
const initJobSites = async () => {
  const sites = await fetchJobSites();

  // Try to restore from localStorage
  const lastSiteId = localStorage.getItem(LAST_JOB_SITE_KEY);
  let selectedSite = sites.find(s => s.id === lastSiteId) || sites[0];

  setCurrentJobSite(selectedSite);
  localStorage.setItem(LAST_JOB_SITE_KEY, selectedSite.id);
};
```

### 6.2 URL Query Parameters (Optional Enhancement)

Currently implemented via props but not actively used in queries:

```typescript
// Could add to router:
/tasks?job_site_id=uuid-here
/workers?job_site_id=uuid-here
```

This would allow:
- Shareable links with pre-selected project
- Deep linking to specific project views
- Browser history navigation

---

## 7. Edge Cases & Fallback Logic

### 7.1 Project No Longer Available

If selected project is deleted while user is viewing it:

```typescript
const refreshJobSites = useCallback(async () => {
  const sites = await fetchJobSites();
  setAvailableJobSites(sites);

  // If current site is no longer available
  if (currentJobSite && !sites.find(s => s.id === currentJobSite.id)) {
    if (sites.length > 0) {
      // Switch to first available
      await switchJobSite(sites[0].id);
    } else {
      // No sites available
      setCurrentJobSite(null);
    }
  }
}, [...]);
```

**Location:** `src/contexts/JobSiteContext.tsx` lines 158-177

### 7.2 User Loses Access

If user's assignment to a site is revoked:
- Real-time subscription detects change
- `refreshJobSites()` is called
- Falls back to first available site

### 7.3 Single Project Users

If user has only 1 project:
- Selector doesn't display
- Project auto-selected
- Clean, minimal UI

### 7.4 No Projects

If user has no projects:
- Selector shows "No job sites available"
- Pages show empty states
- Safe fallback behavior

---

## 8. Real-Time Updates

### 8.1 Job Sites Change Subscription

```typescript
useEffect(() => {
  if (!isAuthenticated || !user?.org_id) return;

  const subscription = supabase
    .channel('job_sites_changes')
    .on(
      'postgres_changes',
      {
        event: '*',  // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'job_sites',
        filter: `organization_id=eq.${user.org_id}`,
      },
      () => {
        refreshJobSites();  // Refetch when changes detected
      }
    )
    .subscribe();

  return () => subscription.unsubscribe();
}, [isAuthenticated, user?.org_id]);
```

**Location:** `src/contexts/JobSiteContext.tsx` lines 242-267

### 8.2 Page Data Subscriptions

Each page subscribes to their data tables:

```typescript
// Workers page
useRealtimeSubscription('workers', useCallback(() => fetchWorkers(), []));

// Tasks page
useRealtimeSubscriptions([
  { table: 'tasks', onUpdate: useCallback(() => fetchTasks(), []) },
  { table: 'assignments', onUpdate: useCallback(() => fetchAssignments(), []) },
]);
```

**Behavior:**
- When data changes in Supabase
- Subscription triggers
- Page refetches filtered data
- UI updates automatically

---

## 9. Helper Hooks

### 9.1 Main Hook

```typescript
const {
  currentJobSite,      // Selected project
  availableJobSites,   // List of user's projects
  switchJobSite,       // Change selection
  canManageSite,       // Can user manage this site?
  canViewSite          // Can user view this site?
} = useJobSite();
```

### 9.2 Convenience Hooks

```typescript
// Get just the current site ID
const siteId = useCurrentJobSiteId();  // string | null

// Check if user can manage current site
const canManage = useCanManageSite();  // boolean

// Check if selector should be displayed
const shouldShow = useShouldShowJobSiteSelector();  // boolean
```

---

## 10. Security Model

### 10.1 Organization-Level Isolation

Every table has `organization_id` field:
```typescript
// RLS policies ensure users see only their org
.eq('organization_id', user.org_id)
```

### 10.2 Job Site-Level Filtering

Data filtered by `job_site_id`:
```typescript
// Pages filter all queries
.eq('job_site_id', currentJobSite.id)
```

### 10.3 Role-Based Access

User roles per site control permissions:
- `admin` - All permissions
- `superintendent` - Can manage site
- `engineer` / `engineer_as_superintendent` - Can manage
- `foreman` - Limited editing
- `worker` - Read-only

### 10.4 Assignment-Based Access

Non-admins must have active assignment:
```typescript
const assignments = await supabase
  .from('job_site_assignments')
  .select('job_site:job_sites(*)')
  .eq('user_id', user.id)
  .eq('is_active', true);
```

---

## 11. Testing Checklist

### 11.1 Selection Works
- [ ] Click project in dropdown
- [ ] Verify `currentJobSite` updates
- [ ] Verify `localStorage` updated
- [ ] Verify page data refetches

### 11.2 Persistence Works
- [ ] Select a project
- [ ] Refresh page
- [ ] Same project still selected

### 11.3 Filtering Works
- [ ] Select project A
- [ ] Create record in project A
- [ ] Select project B
- [ ] Record not visible
- [ ] Select project A again
- [ ] Record visible

### 11.4 Real-Time Works
- [ ] Open 2 browser windows
- [ ] Select different projects
- [ ] Create record in window 1
- [ ] Immediately visible in window 1
- [ ] Not visible in window 2 (different project)
- [ ] Switch window 2 to same project
- [ ] Record now visible

### 11.5 Edge Cases
- [ ] Delete a project
- [ ] User viewing that project automatically switches
- [ ] Revoke user assignment to project
- [ ] User viewing that project automatically switches
- [ ] Single project user doesn't see selector
- [ ] Admin sees all projects
- [ ] Non-admin sees only assigned projects

---

## 12. Performance Optimization

### 12.1 Indexes

All job_site_id columns are indexed:
```sql
CREATE INDEX idx_workers_job_site ON workers(job_site_id);
CREATE INDEX idx_tasks_job_site ON tasks(job_site_id);
CREATE INDEX idx_assignments_job_site ON assignments(job_site_id);
CREATE INDEX idx_daily_hours_job_site ON daily_hours(job_site_id);
-- etc.
```

### 12.2 Query Patterns

All queries use indexed filters:
```typescript
.eq('job_site_id', siteId)  // Uses index, fast
```

### 12.3 Real-Time Subscriptions

Each page subscribes to relevant tables only:
```typescript
// Workers page - only needs workers table
useRealtimeSubscription('workers', ...);

// Tasks page - only needs tasks and assignments
useRealtimeSubscriptions([
  { table: 'tasks', onUpdate: ... },
  { table: 'assignments', onUpdate: ... },
]);
```

---

## 13. Common Use Cases

### 13.1 Add a New Worker to Current Project

```typescript
const { currentJobSite } = useJobSite();
const { user } = useAuth();

const addWorker = async (name: string, role: string) => {
  const { error } = await supabase
    .from('workers')
    .insert([{
      name,
      role,
      organization_id: user.org_id,
      job_site_id: currentJobSite.id  // ← Automatically scoped
    }]);
};
```

### 13.2 Fetch Tasks for Current Project

```typescript
const { currentJobSite } = useJobSite();

const fetchTasks = async () => {
  const { data } = await supabase
    .from('tasks')
    .select('*')
    .eq('job_site_id', currentJobSite.id);  // ← Automatic filtering

  return data;
};
```

### 13.3 Switch Projects Programmatically

```typescript
const { availableJobSites, switchJobSite } = useJobSite();

// Find a project by name
const project = availableJobSites.find(s => s.name === 'Main Site');

if (project) {
  await switchJobSite(project.id);
}
```

### 13.4 Check If User Can Manage Current Site

```typescript
const { canManageSite } = useJobSite();

if (canManageSite) {
  // Show edit buttons
}
```

---

## 14. Troubleshooting

### Issue: Selector Doesn't Show

**Possible Causes:**
1. User is admin (selector intentionally hidden)
2. User has < 2 projects (selector hidden)
3. User is worker role (selector hidden)

**Check:**
```typescript
const shouldShow = useShouldShowJobSiteSelector();
console.log('Should show selector:', shouldShow);
```

### Issue: Data Doesn't Filter When Selecting Project

**Possible Causes:**
1. Page not using `useJobSite()`
2. Missing `.eq('job_site_id', currentJobSite.id)` in query
3. Missing `useEffect` dependency on `currentJobSite?.id`

**Check:**
1. Page has `const { currentJobSite } = useJobSite();`
2. Query includes `.eq('job_site_id', currentJobSite.id)`
3. useEffect has `[currentJobSite?.id]` in dependencies

### Issue: Selection Not Persisting

**Possible Causes:**
1. localStorage disabled
2. Browser privacy mode
3. Site served over HTTP (localStorage blocked)

**Check:**
```javascript
// In browser console
localStorage.getItem('crewai_last_job_site_id');
// Should return a UUID
```

### Issue: Real-Time Not Working

**Possible Causes:**
1. Supabase subscription not initialized
2. Network connectivity issue
3. Supabase realtime disabled

**Check:**
- Open browser DevTools
- Check Network tab for `realtime` subscriptions
- Check Supabase dashboard for realtime status

---

## 15. Future Enhancements

### 15.1 URL Query Parameters (Optional)

Add project ID to URL for shareable links:

```typescript
const navigate = useNavigate();

const switchJobSite = async (siteId: string) => {
  // Switch project
  setCurrentJobSite(site);

  // Update URL
  navigate(`?job_site_id=${siteId}`);
};
```

### 15.2 Project Favorites

Allow users to pin frequently used projects:

```typescript
const favorites = availableJobSites.filter(s => s.is_favorite)
  .sort((a, b) => a.favorite_order - b.favorite_order);
```

### 15.3 Project Search

For organizations with 20+ projects:

```typescript
const [searchQuery, setSearchQuery] = useState('');
const filtered = availableJobSites.filter(s =>
  s.name.toLowerCase().includes(searchQuery.toLowerCase())
);
```

### 15.4 Recent Projects

Show most recently visited:

```typescript
const recent = availableJobSites.filter(s =>
  // Fetch from localStorage or database
  recentIds.includes(s.id)
).slice(0, 5);
```

---

## Summary

Your multi-tenant project selector is **fully implemented and production-ready**:

✅ Seamless project switching
✅ Automatic data filtering
✅ Real-time updates
✅ Selection persistence
✅ Security & multi-tenancy
✅ Mobile & desktop support
✅ Edge case handling
✅ Performance optimized

All 5 dashboard pages use the same pattern and automatically support project filtering. Users can select a project once and see filtered data across the entire app.

---

## References

| File | Purpose |
|------|---------|
| `src/contexts/JobSiteContext.tsx` | State management & logic |
| `src/components/navigation/JobSiteSelector.tsx` | UI component |
| `src/components/layout/Sidebar.tsx` | Integration in layout |
| `src/pages/admin/Workers.tsx` | Example: Workers page |
| `src/pages/admin/Tasks.tsx` | Example: Tasks page |
| `src/pages/admin/Calendar.tsx` | Example: Calendar page |
| `src/pages/admin/Activities.tsx` | Example: Activities page |
| `src/pages/admin/DailyHours.tsx` | Example: Daily Hours page |
| `migrations/001_multi_tenant_schema.sql` | Database schema |
| `src/types/index.ts` | TypeScript types |

