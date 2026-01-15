// ============================================================================
// CrewAI Command: Job Site Context
// Manages current job site selection and switching
// ============================================================================

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { JobSite, JobSiteRole, JobSiteContextType } from '../types';

// Create the context
const JobSiteContext = createContext<JobSiteContextType | undefined>(undefined);

// Development logging helper
const isDev = import.meta.env.DEV;
const devLog = (...args: unknown[]) => {
  if (isDev) console.log('[JobSite]', ...args);
};

// Storage key for persisting last selected job site
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

  // Fetch available job sites based on user role
  const fetchJobSites = useCallback(async (): Promise<JobSite[]> => {
    if (!user?.org_id) return [];

    try {
      if (isAdmin) {
        // Admins can see all job sites in their organization
        const { data, error } = await supabase
          .from('job_sites')
          .select('*')
          .eq('organization_id', user.org_id)
          .order('name');

        if (error) {
          if (isDev) console.error('[JobSite] Error fetching job sites:', error);
          return [];
        }

        return data || [];
      } else {
        // Non-admins only see their assigned job sites
        // First try to get from user's job_site_assignments
        if (user.job_site_assignments && user.job_site_assignments.length > 0) {
          const sites = user.job_site_assignments
            .filter(assignment => assignment.is_active && assignment.job_site)
            .map(assignment => assignment.job_site as JobSite);
          return sites;
        }

        // Fallback: query job_site_assignments table directly
        try {
          const { data, error } = await supabase
            .from('job_site_assignments')
            .select(`
              role,
              job_site:job_sites(*)
            `)
            .eq('user_id', user.id)
            .eq('is_active', true);

          if (error) {
            if (isDev) console.error('[JobSite] Error fetching job site assignments:', error);
            return [];
          }

          if (data) {
            return data
              .filter(item => item.job_site)
              .map(item => item.job_site as unknown as JobSite);
          }
        } catch {
          // Table might not exist yet
          devLog('Job site assignments not available');
        }

        return [];
      }
    } catch (error) {
      if (isDev) console.error('[JobSite] Error in fetchJobSites:', error);
      return [];
    }
  }, [user, isAdmin]);

  // Get user's role on a specific job site
  const getUserSiteRole = useCallback(async (siteId: string): Promise<JobSiteRole | null> => {
    if (!user) return null;
    
    // Admins don't need a specific site role
    if (isAdmin) return null;

    // Check user's job_site_assignments
    if (user.job_site_assignments) {
      const assignment = user.job_site_assignments.find(
        a => a.job_site_id === siteId && a.is_active
      );
      if (assignment) return assignment.role;
    }

    // Fallback: query database
    try {
      const { data, error } = await supabase
        .from('job_site_assignments')
        .select('role')
        .eq('user_id', user.id)
        .eq('job_site_id', siteId)
        .eq('is_active', true)
        .single();

      if (!error && data) {
        return data.role as JobSiteRole;
      }
    } catch {
      devLog('Could not fetch user site role');
    }

    return null;
  }, [user, isAdmin]);

  // Switch to a different job site
  const switchJobSite = useCallback(async (siteId: string): Promise<void> => {
    // Find the site in available sites
    const site = availableJobSites.find(s => s.id === siteId);

    if (!site) {
      console.error('[JobSite] Job site not found:', siteId);
      return;
    }

    console.log('[JobSite] Switching to job site:', site.name);
    // Update current site
    setCurrentJobSite(site);

    // Get user's role on this site
    const role = await getUserSiteRole(siteId);
    setUserSiteRole(role);

    // Persist selection
    localStorage.setItem(LAST_JOB_SITE_KEY, siteId);
  }, [availableJobSites, getUserSiteRole]);

  // Refresh job sites
  const refreshJobSites = useCallback(async (): Promise<void> => {
    console.log('[JobSite] Refreshing job sites...');
    setIsLoading(true);
    try {
      const sites = await fetchJobSites();
      setAvailableJobSites(sites);

      // If current site is no longer available, switch to first available
      if (currentJobSite && !sites.find(s => s.id === currentJobSite.id)) {
        if (sites.length > 0) {
          await switchJobSite(sites[0].id);
        } else {
          setCurrentJobSite(null);
          setUserSiteRole(null);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [fetchJobSites, currentJobSite, switchJobSite]);

  // Initialize job sites when user changes
  useEffect(() => {
    const initJobSites = async () => {
      console.log('[JobSite] Initializing job sites...', { isAuthenticated, hasUser: !!user });

      if (!isAuthenticated || !user) {
        console.log('[JobSite] Not authenticated or no user, clearing state');
        setAvailableJobSites([]);
        setCurrentJobSite(null);
        setUserSiteRole(null);
        setIsLoading(false);
        return;
      }

      console.log('[JobSite] Setting loading = true');
      setIsLoading(true);

      try {
        console.log('[JobSite] Fetching job sites...');
        const sites = await fetchJobSites();
        console.log('[JobSite] Job sites fetched:', sites.length);
        setAvailableJobSites(sites);

        if (sites.length > 0) {
          // Try to restore last selected job site
          const lastSiteId = localStorage.getItem(LAST_JOB_SITE_KEY);
          let selectedSite: JobSite | null = null;

          if (lastSiteId) {
            selectedSite = sites.find(s => s.id === lastSiteId) || null;
          }

          // Default to first site if last selection not found
          if (!selectedSite) {
            selectedSite = sites[0];
          }

          console.log('[JobSite] Setting current job site:', selectedSite?.name);
          setCurrentJobSite(selectedSite);

          // Get user's role on selected site
          if (selectedSite) {
            const role = await getUserSiteRole(selectedSite.id);
            console.log('[JobSite] User site role:', role);
            setUserSiteRole(role);
            localStorage.setItem(LAST_JOB_SITE_KEY, selectedSite.id);
          }
        } else {
          console.log('[JobSite] No job sites available');
          setCurrentJobSite(null);
          setUserSiteRole(null);
        }
      } catch (error) {
        console.error('[JobSite] Error initializing job sites:', error);
      } finally {
        console.log('[JobSite] Setting loading = false');
        setIsLoading(false);
      }
    };

    initJobSites();
  }, [isAuthenticated, user?.id, user?.org_id]);

  // Subscribe to job site changes
  useEffect(() => {
    if (!isAuthenticated || !user?.org_id) return;

    // Subscribe to job_sites table changes
    const subscription = supabase
      .channel('job_sites_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
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

  // Computed permissions
  const canManageSite = isAdmin || 
    userSiteRole === 'superintendent' || 
    userSiteRole === 'engineer_as_superintendent';
  
  const canViewSite = isAdmin || 
    userSiteRole !== null || 
    availableJobSites.some(s => s.id === currentJobSite?.id);

  const value: JobSiteContextType = {
    currentJobSite,
    availableJobSites,
    isLoading,
    isAdmin,
    userSiteRole,
    switchJobSite,
    refreshJobSites,
    canManageSite,
    canViewSite,
  };

  return (
    <JobSiteContext.Provider value={value}>
      {children}
    </JobSiteContext.Provider>
  );
}

// Custom hook to use the job site context
export function useJobSite(): JobSiteContextType {
  const context = useContext(JobSiteContext);
  if (context === undefined) {
    throw new Error('useJobSite must be used within a JobSiteProvider');
  }
  return context;
}

// Helper hook to get current job site ID
export function useCurrentJobSiteId(): string | null {
  const { currentJobSite } = useJobSite();
  return currentJobSite?.id || null;
}

// Helper hook to check if user can manage current site
export function useCanManageSite(): boolean {
  const { canManageSite } = useJobSite();
  return canManageSite;
}

// Helper hook to check if job site selector should be shown
export function useShouldShowJobSiteSelector(): boolean {
  const { user } = useAuth();
  const { availableJobSites } = useJobSite();

  // Don't show for workers (they don't switch sites manually)
  if (user?.base_role === 'worker' || user?.role === 'viewer') return false;

  // Show if user has multiple job sites (works for admins and non-admins)
  return availableJobSites.length > 1;
}

export default JobSiteContext;
