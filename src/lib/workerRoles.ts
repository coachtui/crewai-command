// ============================================================================
// Canonical worker role constants — import from here, not defined locally
// ============================================================================

export const WORKER_ROLES = ['operator', 'laborer', 'carpenter', 'mason', 'mechanic', 'driver'] as const;

export const ROLE_LABELS: Record<string, string> = {
  operator: 'Operators',
  laborer: 'Laborers',
  carpenter: 'Carpenters',
  mason: 'Masons',
  mechanic: 'Mechanics',
  driver: 'Drivers',
};
