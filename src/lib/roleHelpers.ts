// ============================================================================
// CrewAI Command: Role Helpers
// Permission checking utilities for multi-tenant role-based access control
// ============================================================================

import type { User, UserProfile, BaseRole, JobSiteRole, Permissions } from '../types';

// ============================================================================
// BASIC ROLE CHECKS (Backward Compatible)
// ============================================================================

/**
 * Check if a user has permission to edit/modify data
 * Viewers/Workers have read-only access
 */
export const canEdit = (user: User | UserProfile | null): boolean => {
  if (!user) return false;

  // Check base_role first (new system)
  if (user.base_role) {
    return ['manager', 'admin', 'superintendent', 'engineer', 'foreman'].includes(user.base_role);
  }

  // Fall back to legacy role
  return user.role === 'admin' || user.role === 'foreman';
};

/**
 * Check if user is a viewer (read-only access) - legacy support
 */
export const isViewer = (user: User | UserProfile | null): boolean => {
  if (!user) return true;
  
  // In new system, workers are view-only
  if (user.base_role) {
    return user.base_role === 'worker';
  }
  
  return user.role === 'viewer';
};

/**
 * Check if user is a manager (company-wide authority, above admin)
 */
export const isManager = (user: User | UserProfile | null): boolean => {
  if (!user) return false;
  return user.base_role === 'manager';
};

/**
 * Check if user is a manager or admin (elevated access)
 */
export const isManagerOrAdmin = (user: User | UserProfile | null): boolean => {
  if (!user) return false;
  return user.base_role === 'manager' || user.base_role === 'admin' || user.role === 'admin';
};

/**
 * Check if user is an admin (job-site-scoped authority)
 */
export const isAdmin = (user: User | UserProfile | null): boolean => {
  if (!user) return false;
  return user.base_role === 'admin' || user.role === 'admin';
};

/**
 * Check if user is a foreman
 */
export const isForeman = (user: User | UserProfile | null): boolean => {
  if (!user) return false;
  return user.base_role === 'foreman' || user.role === 'foreman';
};

// ============================================================================
// NEW ROLE CHECKS (Multi-Tenant System)
// ============================================================================

/**
 * Check if user is a superintendent
 */
export const isSuperintendent = (user: User | UserProfile | null): boolean => {
  if (!user) return false;
  return user.base_role === 'superintendent';
};

/**
 * Check if user is an engineer
 */
export const isEngineer = (user: User | UserProfile | null): boolean => {
  if (!user) return false;
  return user.base_role === 'engineer';
};

/**
 * Check if user is a worker
 */
export const isWorker = (user: User | UserProfile | null): boolean => {
  if (!user) return false;
  return user.base_role === 'worker' || user.role === 'viewer';
};

/**
 * Get user's base role
 */
export const getBaseRole = (user: User | UserProfile | null): BaseRole | null => {
  if (!user) return null;
  
  if (user.base_role) {
    return user.base_role as BaseRole;
  }
  
  // Map legacy roles to new roles
  switch (user.role) {
    case 'admin':
      return 'admin';
    case 'foreman':
      return 'foreman';
    case 'viewer':
      return 'worker';
    default:
      return 'worker';
  }
};

// ============================================================================
// JOB SITE ROLE CHECKS
// ============================================================================

/**
 * Check if a job site role can manage the site (create/edit tasks, manage workers)
 */
export const canManageJobSite = (role: JobSiteRole | null, isAdmin: boolean): boolean => {
  if (isAdmin) return true;
  if (!role) return false;
  
  return ['superintendent', 'engineer_as_superintendent'].includes(role);
};

/**
 * Check if a job site role can create tasks
 */
export const canCreateTasks = (role: JobSiteRole | null, isAdmin: boolean): boolean => {
  if (isAdmin) return true;
  if (!role) return false;
  
  return ['superintendent', 'engineer_as_superintendent'].includes(role);
};

/**
 * Check if a job site role can assign workers to tasks
 */
export const canAssignWorkers = (role: JobSiteRole | null, isAdmin: boolean): boolean => {
  if (isAdmin) return true;
  if (!role) return false;
  
  return ['superintendent', 'engineer_as_superintendent'].includes(role);
};

/**
 * Check if a job site role can approve reassignment requests
 */
export const canApproveRequests = (role: JobSiteRole | null, isAdmin: boolean): boolean => {
  if (isAdmin) return true;
  if (!role) return false;
  
  return ['superintendent', 'engineer_as_superintendent'].includes(role);
};

/**
 * Check if a job site role can request worker reassignments
 */
export const canRequestReassignment = (role: JobSiteRole | null, isAdmin: boolean): boolean => {
  if (isAdmin) return true;
  if (!role) return false;
  
  return ['superintendent', 'engineer_as_superintendent', 'foreman'].includes(role);
};

/**
 * Check if a job site role can update task status
 */
export const canUpdateTaskStatus = (role: JobSiteRole | null, isAdmin: boolean): boolean => {
  if (isAdmin) return true;
  if (!role) return false;
  
  return ['superintendent', 'engineer_as_superintendent', 'foreman'].includes(role);
};

/**
 * Check if a job site role can clock workers in/out
 */
export const canClockWorkers = (role: JobSiteRole | null, isAdmin: boolean): boolean => {
  if (isAdmin) return true;
  if (!role) return false;
  
  return ['superintendent', 'engineer_as_superintendent', 'foreman'].includes(role);
};

/**
 * Check if a job site role can view all workers on site
 */
export const canViewAllWorkers = (role: JobSiteRole | null, isAdmin: boolean): boolean => {
  if (isAdmin) return true;
  if (!role) return false;
  
  // All site-assigned roles can view workers on their site
  return ['superintendent', 'engineer_as_superintendent', 'engineer', 'foreman'].includes(role);
};

// ============================================================================
// ADMIN-ONLY OPERATIONS
// ============================================================================

/**
 * Check if user can create new job sites (manager only)
 */
export const canCreateJobSites = (user: User | UserProfile | null): boolean => {
  return isManager(user);
};

/**
 * Check if user can move workers between job sites (manager only)
 */
export const canMoveWorkersBetweenSites = (user: User | UserProfile | null): boolean => {
  return isManager(user);
};

/**
 * Check if user can manage user roles and assignments (manager or admin)
 */
export const canManageUsers = (user: User | UserProfile | null): boolean => {
  return isManagerOrAdmin(user);
};

/**
 * Check if user can access company-wide data (manager only)
 */
export const canAccessCompanyWideData = (user: User | UserProfile | null): boolean => {
  return isManager(user);
};

/**
 * Check if user can manage billing and settings (manager only)
 */
export const canManageSettings = (user: User | UserProfile | null): boolean => {
  return isManager(user);
};

// ============================================================================
// COMPREHENSIVE PERMISSIONS OBJECT
// ============================================================================

/**
 * Get all permissions for a user based on their role and job site assignment
 */
export const getPermissions = (
  user: User | UserProfile | null,
  siteRole: JobSiteRole | null = null
): Permissions => {
  const userIsAdmin = isAdmin(user);
  const userIsManager = isManager(user);
  const userIsManagerOrAdmin = userIsManager || userIsAdmin;

  return {
    // Job Site Level
    canViewJobSite: userIsManagerOrAdmin || siteRole !== null,
    canManageJobSite: canManageJobSite(siteRole, userIsManagerOrAdmin),
    canCreateJobSite: canCreateJobSites(user),
    canDeleteJobSite: userIsManager,

    // Worker Level
    canViewWorkers: canViewAllWorkers(siteRole, userIsManagerOrAdmin),
    canManageWorkers: canManageJobSite(siteRole, userIsManagerOrAdmin),
    canMoveWorkersBetweenSites: canMoveWorkersBetweenSites(user),

    // Task Level
    canViewTasks: userIsManagerOrAdmin || siteRole !== null,
    canCreateTasks: canCreateTasks(siteRole, userIsManagerOrAdmin),
    canEditTasks: canCreateTasks(siteRole, userIsManagerOrAdmin),
    canDeleteTasks: canCreateTasks(siteRole, userIsManagerOrAdmin),
    canAssignWorkers: canAssignWorkers(siteRole, userIsManagerOrAdmin),

    // Assignment Level
    canRequestReassignment: canRequestReassignment(siteRole, userIsManagerOrAdmin),
    canApproveReassignments: canApproveRequests(siteRole, userIsManagerOrAdmin),

    // Hours Level
    canLogHours: canClockWorkers(siteRole, userIsManagerOrAdmin),
    canEditHours: canClockWorkers(siteRole, userIsManagerOrAdmin),

    // Admin Level
    canManageUsers: canManageUsers(user),
    canManageOrganization: userIsManager,
    canViewAllSites: userIsManagerOrAdmin,
  };
};

// ============================================================================
// ROLE DISPLAY HELPERS
// ============================================================================

/**
 * Get display name for a base role
 */
export const getBaseRoleDisplayName = (role: BaseRole): string => {
  const displayNames: Record<BaseRole, string> = {
    manager: 'Manager',
    admin: 'Admin',
    superintendent: 'Superintendent',
    engineer: 'Engineer',
    foreman: 'Foreman',
    worker: 'Worker',
  };
  return displayNames[role] || role;
};

/**
 * Get display name for a job site role
 */
export const getJobSiteRoleDisplayName = (role: JobSiteRole): string => {
  const displayNames: Record<JobSiteRole, string> = {
    superintendent: 'Superintendent',
    engineer: 'Engineer',
    engineer_as_superintendent: 'Engineer (Acting Superintendent)',
    foreman: 'Foreman',
    worker: 'Worker',
  };
  return displayNames[role] || role;
};

/**
 * Get color class for a role badge
 */
export const getRoleColor = (role: BaseRole | JobSiteRole | string): string => {
  const colors: Record<string, string> = {
    manager: 'bg-orange-100 text-orange-800',
    admin: 'bg-purple-100 text-purple-800',
    superintendent: 'bg-blue-100 text-blue-800',
    engineer: 'bg-cyan-100 text-cyan-800',
    engineer_as_superintendent: 'bg-indigo-100 text-indigo-800',
    foreman: 'bg-green-100 text-green-800',
    worker: 'bg-gray-100 text-gray-800',
    viewer: 'bg-gray-100 text-gray-800',
  };
  return colors[role] || 'bg-gray-100 text-gray-800';
};

/**
 * Check if a role should see the job site selector
 */
export const shouldShowJobSiteSelector = (
  user: User | UserProfile | null,
  numAssignedSites: number
): boolean => {
  if (!user) return false;

  // Managers see all sites company-wide — no selector needed
  if (isManager(user)) return false;

  // Workers don't switch sites manually
  if (isWorker(user)) return false;

  // Show selector only if user has multiple sites
  return numAssignedSites > 1;
};
