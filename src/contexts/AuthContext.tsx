// ============================================================================
// CrewAI Command: Authentication Context
// Manages user authentication state and profile data
// ============================================================================

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { UserProfile, Organization, JobSiteAssignment, AuthContextType } from '../types';

// Create the context with a default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Development logging helper
const isDev = import.meta.env.DEV;
const devLog = (...args: unknown[]) => {
  if (isDev) console.log('[Auth]', ...args);
};

// Diagnostic checkpoint helper
function logCheckpoint(name: string) {
  if (typeof window !== 'undefined' && window.__APP_DIAGNOSTICS__) {
    const elapsed = Date.now() - window.__APP_DIAGNOSTICS__.startTime;
    window.__APP_DIAGNOSTICS__.checkpoints.push({ name: `[Auth] ${name}`, elapsed });
    console.log(`[DIAGNOSTIC] [Auth] ${name} (${elapsed}ms)`);
  }
}

// Storage keys
const STORAGE_KEYS = {
  LAST_JOB_SITE: 'crewai_last_job_site_id',
  USER_PREFERENCES: 'crewai_user_preferences',
};

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Wrapper for setIsLoading with diagnostic logging
  const setIsLoadingWithLog = useCallback((value: boolean, reason: string) => {
    console.log(`[Auth] isLoading changing: ${!value} → ${value} (${reason})`);
    setIsLoading(value);
  }, []);

  // Fetch user profile with organization and job site assignments
  const fetchUserProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      // Fetch user profile - try user_profiles first, fallback to users
      let userData;
      let userError;
      
      // Try user_profiles table first (new schema)
      const profileResult = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (profileResult.error) {
        // Fallback to users table (old schema)
        const usersResult = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();
        
        userData = usersResult.data;
        userError = usersResult.error;
      } else {
        userData = profileResult.data;
        userError = profileResult.error;
      }

      if (userError || !userData) {
        if (isDev) console.error('[Auth] Error fetching user profile:', userError);
        return null;
      }

      // Fetch organization
      let organization: Organization | undefined;
      const orgId = userData.org_id || userData.organization_id;
      
      if (orgId) {
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', orgId)
          .single();

        if (!orgError && orgData) {
          organization = orgData;
        }
      }

      // Fetch job site assignments (only for non-admins or if table exists)
      let jobSiteAssignments: JobSiteAssignment[] = [];
      
      try {
        const { data: assignmentData, error: assignmentError } = await supabase
          .from('job_site_assignments')
          .select(`
            *,
            job_site:job_sites(*)
          `)
          .eq('user_id', userId)
          .eq('is_active', true);

        if (!assignmentError && assignmentData) {
          jobSiteAssignments = assignmentData;
        }
      } catch {
        // Table might not exist yet, that's okay
        devLog('Job site assignments table not available yet');
      }

      // Construct user profile
      const userProfile: UserProfile = {
        id: userData.id,
        org_id: orgId,
        email: userData.email,
        name: userData.name,
        role: userData.role || 'viewer', // Legacy role
        base_role: userData.base_role || userData.role || 'worker', // New role system
        phone: userData.phone,
        avatar_url: userData.avatar_url,
        created_at: userData.created_at,
        updated_at: userData.updated_at,
        organization,
        job_site_assignments: jobSiteAssignments,
      };

      return userProfile;
    } catch (error) {
      if (isDev) console.error('[Auth] Error in fetchUserProfile:', error);
      return null;
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        logCheckpoint('AuthProvider initializing');

        // Check for existing session with timeout
        logCheckpoint('Checking for existing session');

        // Create a timeout promise (10 seconds)
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Session check timeout - clearing session')), 10000);
        });

        // Race between getSession and timeout
        const sessionPromise = supabase.auth.getSession();

        let sessionData;
        try {
          sessionData = await Promise.race([sessionPromise, timeoutPromise]);
        } catch (timeoutError) {
          // Timeout occurred - clear localStorage and force re-login
          logCheckpoint('Session check timed out - clearing corrupted session');
          console.warn('[Auth] Session check timed out, clearing localStorage');
          localStorage.clear();
          setIsLoadingWithLog(false, 'session timeout');
          setIsAuthenticated(false);
          return;
        }

        const { data: { session }, error: sessionError } = sessionData as any;

        if (sessionError) {
          if (isDev) console.error('[Auth] Session error:', sessionError);
          logCheckpoint('Session check failed');
          setIsLoadingWithLog(false, 'session error');
          return;
        }

        logCheckpoint(`Session check complete (has session: ${!!session})`);

        if (session?.user) {
          logCheckpoint('Fetching user profile');
          const profile = await fetchUserProfile(session.user.id);
          if (profile) {
            setUser(profile);
            setIsAuthenticated(true);
            logCheckpoint('User authenticated successfully');
          } else {
            logCheckpoint('Failed to fetch user profile');
          }
        } else {
          logCheckpoint('No session found - user not authenticated');
        }
      } catch (error) {
        if (isDev) console.error('[Auth] Initialization error:', error);
        logCheckpoint('Auth initialization error: ' + String(error));
      } finally {
        setIsLoadingWithLog(false, 'initialization complete');
        logCheckpoint('AuthProvider initialization complete');
      }
    };

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] Auth state changed:', event, { currentlyAuthenticated: isAuthenticated, hasUser: !!user });

      if (event === 'SIGNED_IN' && session?.user) {
        // Only show loading spinner if we're not already authenticated
        // This prevents unmounting the entire app when returning to the tab
        if (!isAuthenticated || !user) {
          console.log('[Auth] SIGNED_IN event - showing loading (not currently authenticated)');
          setIsLoadingWithLog(true, `auth state change: ${event}`);

          // Add 10-second timeout to profile fetch
          try {
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Profile fetch timeout')), 10000)
            );
            const profilePromise = fetchUserProfile(session.user.id);
            const profile = await Promise.race([profilePromise, timeoutPromise]) as UserProfile | null;

            if (profile) {
              setUser(profile);
              setIsAuthenticated(true);
            }
          } catch (error) {
            console.error('[Auth] Profile fetch failed/timed out:', error);
            localStorage.clear();
          }

          setIsLoadingWithLog(false, `auth state change complete: ${event}`);
        } else {
          console.log('[Auth] SIGNED_IN event - already authenticated, silently refreshing profile');
          // Already authenticated, just refresh profile in background with timeout
          try {
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Profile fetch timeout')), 10000)
            );
            const profilePromise = fetchUserProfile(session.user.id);
            const profile = await Promise.race([profilePromise, timeoutPromise]) as UserProfile | null;

            if (profile) {
              setUser(profile);
            }
          } catch (error) {
            console.error('[Auth] Background profile refresh failed:', error);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('[Auth] SIGNED_OUT event');
        setUser(null);
        setIsAuthenticated(false);
        // Clear stored preferences on logout
        localStorage.removeItem(STORAGE_KEYS.LAST_JOB_SITE);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        console.log('[Auth] TOKEN_REFRESHED event - silently refreshing profile');
        // Token refresh should be completely silent - don't unmount anything
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Profile fetch timeout')), 10000)
          );
          const profilePromise = fetchUserProfile(session.user.id);
          const profile = await Promise.race([profilePromise, timeoutPromise]) as UserProfile | null;

          if (profile) {
            setUser(profile);
          }
        } catch (error) {
          console.error('[Auth] TOKEN_REFRESHED profile fetch failed:', error);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  // Sign in function
  const signIn = async (email: string, password: string): Promise<void> => {
    setIsLoadingWithLog(true, 'manual sign in');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        const profile = await fetchUserProfile(data.user.id);
        if (profile) {
          setUser(profile);
          setIsAuthenticated(true);
        } else {
          throw new Error('Failed to load user profile');
        }
      }
    } finally {
      setIsLoadingWithLog(false, 'manual sign in complete');
    }
  };

  // Sign out function
  const signOut = async (): Promise<void> => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      setUser(null);
      setIsAuthenticated(false);
      // Clear stored preferences
      localStorage.removeItem(STORAGE_KEYS.LAST_JOB_SITE);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  // Refresh user profile
  const refreshUser = async (): Promise<void> => {
    if (!user?.id) return;
    
    try {
      const profile = await fetchUserProfile(user.id);
      if (profile) {
        setUser(profile);
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    signIn,
    signOut,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use the auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper hook to check if user is admin
export function useIsAdmin(): boolean {
  const { user } = useAuth();
  return user?.base_role === 'admin' || user?.role === 'admin';
}

// Helper hook to get user's organization ID
export function useOrgId(): string | null {
  const { user } = useAuth();
  return user?.org_id || null;
}

// Helper hook to get user's base role
export function useBaseRole(): string | null {
  const { user } = useAuth();
  return user?.base_role || user?.role || null;
}

export default AuthContext;
