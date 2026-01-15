# Project Selector - Code Implementation Reference

Complete code reference showing exactly how the multi-tenant project selector is implemented.

---

## 1. JobSiteContext (State Management)

**File:** `src/contexts/JobSiteContext.tsx` (334 lines)

**What it does:**
- Manages current project selection
- Fetches available projects based on user role
- Handles switching between projects
- Persists selection to localStorage
- Subscribes to real-time changes

### 1.1 Type Definition

```typescript
// From src/types/index.ts
export interface JobSiteContextType {
  currentJobSite: JobSite | null;           // Selected project
  availableJobSites: JobSite[];             // User's accessible projects
  isLoading: boolean;                       // Loading state
  isAdmin: boolean;                         // Is user admin?
  userSiteRole: JobSiteRole | null;         // User's role at this site
  switchJobSite: (siteId: string) => Promise<void>;  // Change selection
  refreshJobSites: () => Promise<void>;     // Refresh list
  canManageSite: boolean;                   // Can user manage?
  canViewSite: boolean;                     // Can user view?
}
```

### 1.2 Context Creation & Provider

```typescript
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { JobSite, JobSiteRole, JobSiteContextType } from '../types';

const JobSiteContext = createContext<JobSiteContextType | undefined>(undefined);

const LAST_JOB_SITE_KEY = 'crewai_last_job_site_id';

interface JobSiteProviderProps {
  children: ReactNode;
}

export function JobSiteProvider({ children }: JobSiteProviderProps) {
  const { user, isAuthenticated } = useAuth();
  const [currentJobSite, setCurrentJobSite] = useState<JobSite | null>(null);
  const [availableJobSites, setAvailableJobSites] = useState<JobSite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userSiteRole, setUserSiteRole] = useState<JobSiteRole | null>(null);

  // Determine if user is admin
  const isAdmin = user?.base_role === 'admin' || user?.role === 'admin';

  // ... rest of implementation
}
```

### 1.3 Fetch Job Sites (Key Logic)

```typescript
// For ADMINS: Fetch all projects in organization
if (isAdmin) {
  const { data, error } = await supabase
    .from('job_sites')
    .select('*')
    .eq('organization_id', user.org_id)  // ← Company scope
    .order('name');

  if (error) return [];
  return data || [];
}

// For NON-ADMINS: Fetch only assigned projects
if (user.job_site_assignments && user.job_site_assignments.length > 0) {
  const sites = user.job_site_assignments
    .filter(assignment => assignment.is_active && assignment.job_site)
    .map(assignment => assignment.job_site as JobSite);
  return sites;
}

// Fallback: Query job_site_assignments table directly
const { data, error } = await supabase
  .from('job_site_assignments')
  .select('role, job_site:job_sites(*)')
  .eq('user_id', user.id)
  .eq('is_active', true);

if (error) return [];
return data
  .filter(item => item.job_site)
  .map(item => item.job_site as unknown as JobSite);
```

### 1.4 Initialize Projects on Login

```typescript
useEffect(() => {
  const initJobSites = async () => {
    if (!isAuthenticated || !user) {
      setAvailableJobSites([]);
      setCurrentJobSite(null);
      setUserSiteRole(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // 1. Fetch available projects
      const sites = await fetchJobSites();
      setAvailableJobSites(sites);

      if (sites.length > 0) {
        // 2. Try to restore last selected
        const lastSiteId = localStorage.getItem(LAST_JOB_SITE_KEY);
        let selectedSite = sites.find(s => s.id === lastSiteId) || null;

        // 3. Default to first if not found
        if (!selectedSite) {
          selectedSite = sites[0];
        }

        // 4. Set as current
        setCurrentJobSite(selectedSite);

        // 5. Get user's role at this site
        const role = await getUserSiteRole(selectedSite.id);
        setUserSiteRole(role);
        localStorage.setItem(LAST_JOB_SITE_KEY, selectedSite.id);
      } else {
        setCurrentJobSite(null);
        setUserSiteRole(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  initJobSites();
}, [isAuthenticated, user?.id, user?.org_id]);
```

### 1.5 Switch Project

```typescript
const switchJobSite = useCallback(async (siteId: string): Promise<void> => {
  // 1. Find site in available list
  const site = availableJobSites.find(s => s.id === siteId);
  if (!site) {
    console.error('[JobSite] Job site not found:', siteId);
    return;
  }

  // 2. Update current selection
  setCurrentJobSite(site);

  // 3. Fetch user's role on this site
  const role = await getUserSiteRole(siteId);
  setUserSiteRole(role);

  // 4. Persist to localStorage
  localStorage.setItem(LAST_JOB_SITE_KEY, siteId);
}, [availableJobSites, getUserSiteRole]);
```

### 1.6 Real-Time Subscription to Job Sites Changes

```typescript
useEffect(() => {
  if (!isAuthenticated || !user?.org_id) return;

  // Subscribe to job_sites table changes
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
        // Refresh job sites when changes occur
        refreshJobSites();
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, [isAuthenticated, user?.org_id]);
```

### 1.7 Export Hook for Pages

```typescript
export function useJobSite(): JobSiteContextType {
  const context = useContext(JobSiteContext);
  if (context === undefined) {
    throw new Error('useJobSite must be used within a JobSiteProvider');
  }
  return context;
}

// Convenience hooks
export function useCurrentJobSiteId(): string | null {
  const { currentJobSite } = useJobSite();
  return currentJobSite?.id || null;
}

export function useCanManageSite(): boolean {
  const { canManageSite } = useJobSite();
  return canManageSite;
}

export function useShouldShowJobSiteSelector(): boolean {
  const { user } = useAuth();
  const { availableJobSites, isAdmin } = useJobSite();

  if (isAdmin) return false;  // Admins don't need selector
  if (user?.base_role === 'worker' || user?.role === 'viewer') return false;  // Workers don't
  return availableJobSites.length > 1;  // Show only if 2+ sites
}
```

---

## 2. JobSiteSelector Component (UI)

**File:** `src/components/navigation/JobSiteSelector.tsx` (336 lines)

**What it does:**
- Renders the dropdown UI for selecting projects
- Desktop and mobile versions
- Shows project names, addresses, status badges
- Handles click events to switch projects

### 2.1 Desktop Selector Props & State

```typescript
interface JobSiteSelectorProps {
  className?: string;
  compact?: boolean;  // For mobile sizing
}

export function JobSiteSelector({ className = '', compact = false }: JobSiteSelectorProps) {
  const { currentJobSite, availableJobSites, switchJobSite, isLoading } = useJobSite();
  const shouldShow = useShouldShowJobSiteSelector();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Don't render if shouldn't show
  if (!shouldShow) {
    return null;
  }
```

### 2.2 Click Outside Handler

```typescript
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  };

  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);
```

### 2.3 Escape Key Handler

```typescript
useEffect(() => {
  const handleEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  document.addEventListener('keydown', handleEscape);
  return () => document.removeEventListener('keydown', handleEscape);
}, []);
```

### 2.4 Handle Selection

```typescript
const handleSiteSelect = async (site: JobSite) => {
  await switchJobSite(site.id);  // ← Triggers state update and data refetch
  setIsOpen(false);
};
```

### 2.5 Loading State

```typescript
if (isLoading) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 bg-bg-secondary border border-border rounded-lg ${className}`}>
      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <span className="text-sm text-text-secondary">Loading...</span>
    </div>
  );
}
```

### 2.6 Trigger Button

```typescript
<button
  onClick={() => setIsOpen(!isOpen)}
  className={`
    flex items-center gap-2 px-3 py-2
    bg-bg-secondary hover:bg-bg-hover
    border border-border rounded-lg
    transition-colors cursor-pointer
    ${isOpen ? 'ring-2 ring-primary ring-opacity-50' : ''}
  `}
  aria-haspopup="listbox"
  aria-expanded={isOpen}
>
  <MapPin size={16} className="text-primary flex-shrink-0" />
  <span className="text-text-primary font-medium truncate">
    {currentJobSite ? currentJobSite.name : 'Select Site'}
  </span>
  <ChevronDown
    size={16}
    className={`text-text-secondary transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
  />
</button>
```

### 2.7 Dropdown Menu with Sites

```typescript
{isOpen && (
  <div className="absolute z-50 mt-1 bg-bg-secondary border border-border rounded-lg shadow-lg">
    <div className="px-3 py-2 border-b border-border">
      <p className="text-xs text-text-secondary font-medium uppercase">Your Job Sites</p>
    </div>

    <div className="max-h-[300px] overflow-y-auto py-1">
      {availableJobSites.map((site) => (
        <button
          key={site.id}
          onClick={() => handleSiteSelect(site)}
          className={`
            w-full flex items-start gap-3 px-3 py-2
            hover:bg-bg-hover transition-colors
            ${currentJobSite?.id === site.id ? 'bg-primary/10' : ''}
          `}
        >
          {/* Selection indicator */}
          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
            {currentJobSite?.id === site.id ? (
              <Check size={16} className="text-primary" />
            ) : (
              <Building2 size={16} className="text-text-secondary" />
            )}
          </div>

          {/* Site info */}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium truncate ${
              currentJobSite?.id === site.id ? 'text-primary' : 'text-text-primary'
            }`}>
              {site.name}
            </p>
            {site.address && (
              <p className="text-xs text-text-secondary truncate mt-0.5">
                {site.address}
              </p>
            )}
          </div>

          {/* Status badge */}
          <span className={`
            px-1.5 py-0.5 text-xs font-medium rounded flex-shrink-0
            ${getStatusColor(site.status)}
          `}>
            {site.status === 'on_hold' ? 'Hold' : site.status}
          </span>
        </button>
      ))}
    </div>

    {/* Footer */}
    {availableJobSites.length > 0 && (
      <div className="px-3 py-2 border-t border-border">
        <p className="text-xs text-text-secondary text-center">
          {availableJobSites.length} site{availableJobSites.length !== 1 ? 's' : ''} assigned
        </p>
      </div>
    )}
  </div>
)}
```

### 2.8 Mobile Version (Full Screen)

```typescript
export function JobSiteSelectorMobile() {
  const { currentJobSite, availableJobSites, switchJobSite, isLoading } = useJobSite();
  const shouldShow = useShouldShowJobSiteSelector();
  const [isOpen, setIsOpen] = useState(false);

  if (!shouldShow) return null;

  const handleSiteSelect = async (site: JobSite) => {
    await switchJobSite(site.id);
    setIsOpen(false);
  };

  return (
    <>
      {/* Compact trigger */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-2 py-1.5 bg-bg-secondary hover:bg-bg-hover border border-border rounded-lg transition-colors"
      >
        <MapPin size={14} className="text-primary" />
        <span className="text-sm text-text-primary font-medium max-w-[80px] truncate">
          {currentJobSite?.name || 'Site'}
        </span>
        <ChevronDown size={12} className="text-text-secondary" />
      </button>

      {/* Full-screen modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-bg-primary">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-lg font-semibold text-text-primary">Select Job Site</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Site list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {availableJobSites.map((site) => (
              <button
                key={site.id}
                onClick={() => handleSiteSelect(site)}
                className={`
                  w-full flex items-start gap-3 p-4
                  bg-bg-secondary hover:bg-bg-hover
                  border border-border rounded-lg
                  transition-colors text-left
                  ${currentJobSite?.id === site.id ? 'ring-2 ring-primary' : ''}
                `}
              >
                {/* Radio button */}
                <div className={`
                  w-6 h-6 rounded-full border-2 flex items-center justify-center
                  ${currentJobSite?.id === site.id
                    ? 'border-primary bg-primary'
                    : 'border-border'
                  }
                `}>
                  {currentJobSite?.id === site.id && (
                    <Check size={14} className="text-white" />
                  )}
                </div>

                {/* Site info */}
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium text-text-primary">
                    {site.name}
                  </p>
                  {site.address && (
                    <p className="text-sm text-text-secondary mt-1">
                      {site.address}
                    </p>
                  )}
                </div>

                {/* Status badge */}
                <span className={`
                  px-2 py-1 text-xs font-medium rounded
                  ${getStatusColor(site.status)}
                `}>
                  {site.status === 'on_hold' ? 'On Hold' :
                   site.status.charAt(0).toUpperCase() + site.status.slice(1)}
                </span>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-border">
            <p className="text-sm text-text-secondary text-center">
              {availableJobSites.length} job site{availableJobSites.length !== 1 ? 's' : ''} assigned to you
            </p>
          </div>
        </div>
      )}
    </>
  );
}
```

---

## 3. Sidebar Integration

**File:** `src/components/layout/Sidebar.tsx` (237 lines)

**Where the selector is used:**

```typescript
import { JobSiteSelector, JobSiteSelectorMobile } from '../navigation/JobSiteSelector';

export function Sidebar({ pendingCount = 0 }: SidebarProps) {
  // ... sidebar logic ...

  return (
    <>
      {/* Mobile header with selector */}
      {isMobile && !isVisible && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-bg-secondary border-b border-border">
          <button onClick={() => setIsVisible(true)} className="w-10 h-10 bg-primary rounded-lg">
            <Menu size={20} className="text-white" />
          </button>

          {/* Mobile selector */}
          <JobSiteSelectorMobile />
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="w-[220px] h-screen bg-bg-secondary border-r border-border flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <img src="/image/crewai-command-logo.png" alt="CrewAI Command" />
        </div>

        {/* Job Site Selector (Desktop) */}
        <div className="px-4 py-3 border-b border-border">
          <JobSiteSelector compact={false} />
        </div>

        {/* Navigation items */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            // ... nav item rendering ...
          ))}
        </nav>

        {/* Logout button */}
        <div className="p-4 border-t border-border">
          <button onClick={handleLogout} className="w-full ...">
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </>
  );
}
```

---

## 4. Pages Implementation Pattern

All pages follow this same pattern. Here are 3 examples:

### 4.1 Workers Page Pattern

**File:** `src/pages/admin/Workers.tsx`

```typescript
import { useJobSite } from '../../contexts';

export function Workers() {
  const { user } = useAuth();
  const { currentJobSite } = useJobSite();  // ← 1. Get current project
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  // ← 2. Refetch when project changes
  useEffect(() => {
    if (currentJobSite) {
      fetchWorkers();
    }
  }, [currentJobSite?.id]);  // ← Dependency: currentJobSite

  // ← 3. Subscribe to real-time changes
  useRealtimeSubscription('workers', useCallback(() => fetchWorkers(), []));

  // ← 4. Query with job_site_id filter
  const fetchWorkers = async () => {
    if (!currentJobSite) {
      setWorkers([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .eq('job_site_id', currentJobSite.id)  // ← KEY FILTER
        .order('name');

      if (error) throw error;
      setWorkers(data || []);
    } finally {
      setLoading(false);
    }
  };

  // ← 5. Include job_site_id when creating
  const handleSaveWorker = async (workerData: Partial<Worker>) => {
    if (!user?.org_id || !currentJobSite) {
      toast.error('Missing required data');
      return;
    }

    try {
      if (editingWorker) {
        // Update existing
        const { error } = await supabase
          .from('workers')
          .update(workerData)
          .eq('id', editingWorker.id);
        if (error) throw error;
      } else {
        // Create new with job_site_id
        const { error } = await supabase
          .from('workers')
          .insert([{
            ...workerData,
            organization_id: user.org_id,
            job_site_id: currentJobSite.id  // ← REQUIRED
          }]);
        if (error) throw error;
      }

      fetchWorkers();
      setIsModalOpen(false);
    } catch (error) {
      toast.error('Failed to save worker');
    }
  };

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-2">Workers</h1>
      <p className="text-text-secondary">Manage your construction crew</p>

      {/* Filters, Add button, etc */}

      {/* Worker list - renders filtered workers */}
      {filteredWorkers.map(worker => (
        <WorkerCard key={worker.id} worker={worker} />
      ))}
    </div>
  );
}
```

### 4.2 Tasks Page Pattern

**File:** `src/pages/admin/Tasks.tsx`

```typescript
export function Tasks() {
  const { user } = useAuth();
  const { currentJobSite } = useJobSite();  // ← Get current project
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  useEffect(() => {
    if (currentJobSite) {
      fetchTasks();
      fetchAssignments();
    }
  }, [currentJobSite?.id]);  // ← Dependency

  useRealtimeSubscriptions([
    { table: 'tasks', onUpdate: useCallback(() => fetchTasks(), []) },
    { table: 'assignments', onUpdate: useCallback(() => fetchAssignments(), []) },
  ]);

  // ← Filter by job_site_id
  const fetchTasks = async () => {
    if (!currentJobSite) {
      setTasks([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('job_site_id', currentJobSite.id)  // ← FILTER
        .order('start_date');

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      toast.error('Failed to load tasks');
    }
  };

  // ← Filter assignments by task.job_site_id (join)
  const fetchAssignments = async () => {
    if (!currentJobSite) {
      setAssignments([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          *,
          worker:workers(*),
          task:tasks!inner(job_site_id)  // ← Inner join
        `)
        .eq('task.job_site_id', currentJobSite.id);  // ← FILTER

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error('Failed to load assignments:', error);
    }
  };

  // Rest of component...
}
```

### 4.3 Activities Page Pattern

**File:** `src/pages/admin/Activities.tsx`

```typescript
export function Activities() {
  const { currentJobSite } = useJobSite();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentJobSite) {
      fetchActivities();
    }
  }, [currentJobSite?.id]);  // ← Dependency

  useRealtimeSubscription('assignments', () => fetchActivities());

  const fetchActivities = async () => {
    if (!currentJobSite) {
      setActivities([]);
      setLoading(false);
      return;
    }

    try {
      // Get recent assignment changes (last 7 days) for current job site
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('assignments')
        .select(`
          *,
          task:tasks!inner(name, job_site_id),  // ← Inner join
          worker:workers(name)
        `)
        .eq('task.job_site_id', currentJobSite.id)  // ← FILTER
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform to activity logs
      const logs = (data || []).map(assignment => ({
        id: assignment.id,
        type: assignment.status === 'reassigned' ? 'reassignment' :
              assignment.status === 'assigned' ? 'assignment' : 'removal',
        worker_name: assignment.worker?.name || 'Unknown',
        task_name: assignment.task?.name || 'Unknown',
        date: assignment.assigned_date,
        created_at: assignment.created_at,
        acknowledged: assignment.acknowledged || false,
      }));

      setActivities(logs);
    } catch (error) {
      toast.error('Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  // Rest of component...
}
```

---

## 5. App.tsx Integration

**File:** `src/App.tsx` (244 lines)

**How it all connects:**

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, JobSiteProvider, useAuth } from './contexts';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // ← Wrap all routes with JobSiteProvider
  return (
    <JobSiteProvider>
      <div className="flex h-screen bg-bg-primary">
        <Sidebar />
        <main className="flex-1 overflow-auto w-full md:w-auto">
          {children}  {/* Pages automatically get context */}
        </main>
        <VoiceFloatingButton />
      </div>
    </JobSiteProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/workers" replace />} />

          <Route path="/workers" element={
            <ProtectedRoute>
              <Workers />  {/* Automatically has job site context */}
            </ProtectedRoute>
          } />

          <Route path="/tasks" element={
            <ProtectedRoute>
              <Tasks />  {/* Automatically has job site context */}
            </ProtectedRoute>
          } />

          <Route path="/calendar" element={
            <ProtectedRoute>
              <Calendar />  {/* Automatically has job site context */}
            </ProtectedRoute>
          } />

          <Route path="/activities" element={
            <ProtectedRoute>
              <Activities />  {/* Automatically has job site context */}
            </ProtectedRoute>
          } />

          <Route path="/daily-hours" element={
            <ProtectedRoute>
              <DailyHours />  {/* Automatically has job site context */}
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
```

---

## 6. Types Definition

**File:** `src/types/index.ts` (excerpt)

```typescript
// Organization (top-level tenant)
export interface Organization {
  id: string;
  name: string;
  slug: string;
  address?: string;
  phone?: string;
  created_at: string;
}

// Job Site (project - scoped to organization)
export type JobSiteStatus = 'active' | 'on_hold' | 'completed';

export interface JobSite {
  id: string;
  organization_id: string;  // ← Link to organization
  name: string;
  address?: string;
  description?: string;
  status: JobSiteStatus;
  start_date?: string;
  end_date?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

// User roles at job site level
export type JobSiteRole = 'superintendent' | 'engineer' |
  'engineer_as_superintendent' | 'foreman' | 'worker';

// User-to-JobSite assignment
export interface JobSiteAssignment {
  id: string;
  user_id: string;
  job_site_id: string;
  role: JobSiteRole;
  start_date: string;
  end_date?: string;
  is_active: boolean;
  assigned_by?: string;
  created_at: string;
  updated_at?: string;
  // Joined data
  user?: User;
  job_site?: JobSite;
}

// Context type
export interface JobSiteContextType {
  currentJobSite: JobSite | null;
  availableJobSites: JobSite[];
  isLoading: boolean;
  isAdmin: boolean;
  userSiteRole: JobSiteRole | null;
  switchJobSite: (siteId: string) => Promise<void>;
  refreshJobSites: () => Promise<void>;
  canManageSite: boolean;
  canViewSite: boolean;
}
```

---

## 7. Database Schema

**File:** `migrations/001_multi_tenant_schema.sql` (excerpt)

```sql
-- Job Sites Table
CREATE TABLE job_sites (
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

-- Indexes for performance
CREATE INDEX idx_job_sites_org ON job_sites(organization_id);
CREATE INDEX idx_job_sites_status ON job_sites(status);

-- Job Site Assignments (User → Site + Role)
CREATE TABLE job_site_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  job_site_id UUID NOT NULL REFERENCES job_sites(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN (
    'superintendent', 'engineer', 'engineer_as_superintendent',
    'foreman', 'worker'
  )),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  assigned_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_job_site_assignments_user ON job_site_assignments(user_id);
CREATE INDEX idx_job_site_assignments_site ON job_site_assignments(job_site_id);
CREATE INDEX idx_job_site_assignments_active ON job_site_assignments(is_active)
  WHERE is_active = true;

-- Workers Table - Add job_site_id
ALTER TABLE workers ADD COLUMN IF NOT EXISTS job_site_id UUID REFERENCES job_sites(id);
CREATE INDEX idx_workers_job_site ON workers(job_site_id);

-- Tasks Table - Add job_site_id
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS job_site_id UUID REFERENCES job_sites(id);
CREATE INDEX idx_tasks_job_site ON tasks(job_site_id);

-- Same for other tables: assignments, daily_hours, activities, etc.
```

---

## 8. Real-Time Subscription Hook

**File:** `src/lib/hooks/useRealtime.ts` (excerpt)

```typescript
export function useRealtimeSubscription(
  table: string,
  onUpdate: () => void
): void {
  useEffect(() => {
    // Subscribe to table changes
    const subscription = supabase
      .channel(`${table}_changes`)
      .on(
        'postgres_changes',
        {
          event: '*',  // All events
          schema: 'public',
          table: table,
        },
        () => {
          onUpdate();  // Refetch data when changes occur
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [table, onUpdate]);
}

export function useRealtimeSubscriptions(
  subscriptions: Array<{ table: string; onUpdate: () => void }>
): void {
  useEffect(() => {
    const subs = subscriptions.map(({ table, onUpdate }) => {
      return supabase
        .channel(`${table}_changes`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: table,
          },
          () => {
            onUpdate();
          }
        )
        .subscribe();
    });

    return () => {
      subs.forEach(sub => sub.unsubscribe());
    };
  }, [subscriptions]);
}
```

---

## Summary Table

| Component | Purpose | Key Code |
|-----------|---------|----------|
| `JobSiteContext` | State management | `currentJobSite`, `switchJobSite`, real-time subscription |
| `JobSiteSelector` | UI component | Desktop & mobile dropdown |
| `Sidebar` | Integration | Renders selector in layout |
| `Workers.tsx` | Example page | `useJobSite()` + `.eq('job_site_id', ...)` |
| `Tasks.tsx` | Example page | Same pattern as Workers |
| `Calendar.tsx` | Example page | Same pattern as Workers |
| `Activities.tsx` | Example page | Same pattern as Workers |
| `DailyHours.tsx` | Example page | Same pattern as Workers |
| `App.tsx` | App setup | Wraps routes with `JobSiteProvider` |
| Database schema | Data layer | `job_site_id` on all tables + indexes |
| Types | TypeScript | `JobSiteContextType`, `JobSite`, `JobSiteAssignment` |

---

## Common Patterns to Remember

### Pattern 1: Using the Context in a Page

```typescript
const { currentJobSite } = useJobSite();

useEffect(() => {
  if (currentJobSite) {
    fetchData();
  }
}, [currentJobSite?.id]);
```

### Pattern 2: Filtering Query

```typescript
const { data } = await supabase
  .from('table_name')
  .select('*')
  .eq('job_site_id', currentJobSite.id)
  .order('field');
```

### Pattern 3: Creating with Job Site

```typescript
const { error } = await supabase
  .from('table_name')
  .insert([{
    ...data,
    organization_id: user.org_id,
    job_site_id: currentJobSite.id
  }]);
```

### Pattern 4: Real-Time Subscription

```typescript
useRealtimeSubscription('table_name', useCallback(() => {
  fetchData();
}, []));
```

---

