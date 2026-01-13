import type { User } from '../types';

/**
 * Check if a user has permission to edit/modify data
 * Viewers have read-only access
 */
export const canEdit = (user: User | null): boolean => {
  if (!user) return false;
  return user.role === 'admin' || user.role === 'foreman';
};

/**
 * Check if user is a viewer (read-only access)
 */
export const isViewer = (user: User | null): boolean => {
  return user?.role === 'viewer';
};

/**
 * Check if user is an admin
 */
export const isAdmin = (user: User | null): boolean => {
  return user?.role === 'admin';
};

/**
 * Check if user is a foreman
 */
export const isForeman = (user: User | null): boolean => {
  return user?.role === 'foreman';
};
