// ============================================================================
// CrewAI Command: Authentication Context
// Manages user authentication state and profile data
// ============================================================================

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { UserProfile, Organization, JobSiteAssignment, AuthContextType } from '../types';

// Create the context with a default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Development logging helper
const isDev = import.meta.env.DEV;
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

  // Refs so onAuthStateChange callback always sees current values
  // (the callback closure captures values at effect-setup time, not on re-render)
  const isAuthenticatedRef = useRef(false);
  const currentUserRef = useRef<UserProfile | null>(null);

  // Track last profile fetch to prevent excessive API calls
  const lastProfileFetchRef = useRef<number>(0);
  const PROFILE_FETCH_COOLDOWN = 30000; // 30 seconds cooldown between fetches

  // Keep refs in sync so the onAuthStateChange callback (which closes over
  // the initial values) can always read current auth state without being in deps.
  const setIsAuthenticatedAndRef = useCallback((val: boolean) => {
    isAuthenticatedRef.current = val;
    setIsAuthenticated(val);
  }, []);

  const setUserAndRef = useCallback((profile: UserProfile | null) => {
    currentUserRef.current = profile;
    setUser(profile);
  }, []);

  // Wrapper for setIsLoading with diagnostic logging
  const setIsLoadingWithLog = useCallback((value: boolean, reason: string) => {
    console.log(`[Auth] isLoading changing: ${!value} → ${value} (${reason})`);
    setIsLoading(value);
  }, []);

  // Fetch user profile with organization and job site assignments
  const fetchUserProfile = useCallback(async (userId: string, skipCooldown = false): Promise<UserProfile | null> => {
    // Check cooldown to prevent excessive API calls
    const now = Date.now();
    const timeSinceLastFetch = now - lastProfileFetchRef.current;

    if (!skipCooldown && timeSinceLastFetch < PROFILE_FETCH_COOLDOWN) {
      console.log(`[Auth] Skipping profile fetch - cooldown active (${Math.round(timeSinceLastFetch / 1000)}s since last fetch)`);
      return null;
    }

    lastProfileFetchRef.current = now;

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

      // Fetch organization + job site assignments in parallel (not sequential)
      const orgId = userData.org_id || userData.organization_id;

      const [orgResult, assignmentsResult] = await Promise.all([
        orgId
          ? supabase.from('organizations').select('*').eq('id', orgId).single()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from('job_site_assignments')
          .select('*, job_site:job_sites(*)')
          .eq('user_id', userId)
          .eq('is_active', true),
      ]);

      const organization: Organization | undefined =
        orgResult.data && !orgResult.error ? orgResult.data : undefined;

      const jobSiteAssignments: JobSiteAssignment[] =
        assignmentsResult.data && !assignmentsResult.error
          ? assignmentsResult.data
          : [];

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
          // Timeout — only remove the Supabase auth token, not all of localStorage.
          // (localStorage.clear() would wipe job-site preferences and other app state.)
          logCheckpoint('Session check timed out - clearing auth token only');
          console.warn('[Auth] Session check timed out, removing auth token from localStorage');
          try {
            const projectRef = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0];
            localStorage.removeItem(`sb-${projectRef}-auth-token`);
          } catch {
            // Fallback: remove any key that looks like a supabase auth token
            Object.keys(localStorage)
              .filter((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
              .forEach((k) => localStorage.removeItem(k));
          }
          setIsLoadingWithLog(false, 'session timeout');
          setIsAuthenticatedAndRef(false);
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
          const profile = await fetchUserProfile(session.user.id, true);
          if (profile) {
            setUserAndRef(profile);
            setIsAuthenticatedAndRef(true);
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

    // Listen for auth state changes.
    // IMPORTANT: this callback closes over the initial values of isAuthenticated/user
    // (always false/null) because the effect only runs once. We use refs instead of
    // the state variables so we always read the current values.
    // Inline types because @supabase/supabase-js dist/ is empty in this install
    // (types cannot be resolved by the TS language server via package imports).
    type _Event = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED' |
      'PASSWORD_RECOVERY' | 'INITIAL_SESSION' | 'MFA_CHALLENGE_VERIFIED';
    type _Session = { user: { id: string; email?: string } } | null;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: _Event, session: _Session) => {
      console.log('[Auth] Auth state changed:', event, {
        currentlyAuthenticated: isAuthenticatedRef.current,
        hasUser: !!currentUserRef.current,
      });

      if (event === 'SIGNED_IN' && session?.user) {
        // Use ref (not stale closure value) to decide whether we're already authed
        if (!isAuthenticatedRef.current || !currentUserRef.current) {
          console.log('[Auth] SIGNED_IN event - showing loading (not currently authenticated)');
          setIsLoadingWithLog(true, `auth state change: ${event}`);

          try {
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Profile fetch timeout')), 10000)
            );
            const profilePromise = fetchUserProfile(session.user.id, true);
            const profile = await Promise.race([profilePromise, timeoutPromise]) as UserProfile | null;

            if (profile) {
              setUserAndRef(profile);
              setIsAuthenticatedAndRef(true);
            } else {
              console.warn('[Auth] Profile fetch returned null - user profile may not exist in database');
            }
          } catch (error) {
            console.error('[Auth] Profile fetch failed/timed out:', error);
          }

          setIsLoadingWithLog(false, `auth state change complete: ${event}`);
        } else {
          console.log('[Auth] SIGNED_IN event - already authenticated, silent background refresh');
          try {
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Profile fetch timeout')), 10000)
            );
            const profilePromise = fetchUserProfile(session.user.id, false);
            const profile = await Promise.race([profilePromise, timeoutPromise]) as UserProfile | null;

            if (profile) {
              setUserAndRef(profile);
            }
          } catch (error) {
            console.error('[Auth] Background profile refresh failed:', error);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('[Auth] SIGNED_OUT event');
        setUserAndRef(null);
        setIsAuthenticatedAndRef(false);
        localStorage.removeItem(STORAGE_KEYS.LAST_JOB_SITE);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        console.log('[Auth] TOKEN_REFRESHED event - silent refresh, respecting cooldown');
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Profile fetch timeout')), 10000)
          );
          const profilePromise = fetchUserProfile(session.user.id, false);
          const profile = await Promise.race([profilePromise, timeoutPromise]) as UserProfile | null;

          if (profile) {
            setUserAndRef(profile);
          } else {
            console.log('[Auth] TOKEN_REFRESHED - profile fetch skipped (cooldown active or returned null)');
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
        const profile = await fetchUserProfile(data.user.id, true);
        if (profile) {
          setUserAndRef(profile);
          setIsAuthenticatedAndRef(true);
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
      setUserAndRef(null);
      setIsAuthenticatedAndRef(false);
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
      const profile = await fetchUserProfile(user.id, true);
      if (profile) {
        setUserAndRef(profile);
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  // Update profile info (name, phone, email)
  const updateProfile = async (updates: { name?: string; phone?: string; email?: string }): Promise<void> => {
    if (!user?.id) throw new Error('Not authenticated');

    // Update user_profiles table
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', user.id);

    if (profileError) throw profileError;

    // Keep legacy users table in sync
    const { error: usersError } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id);

    if (usersError) {
      console.warn('[Auth] Could not update legacy users table:', usersError);
    }

    // If email changed, update auth email (Supabase sends confirmation to new address)
    if (updates.email && updates.email !== user.email) {
      const { error: authError } = await supabase.auth.updateUser({ email: updates.email });
      if (authError) throw authError;
    }

    // Update local state immediately
    setUserAndRef({ ...user, ...updates });
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    signIn,
    signOut,
    refreshUser,
    updateProfile,
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
