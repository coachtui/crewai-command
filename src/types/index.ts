// ============================================================================
// CrewAI Command: Type Definitions
// Multi-Tenant Architecture with Job Site Management
// ============================================================================

// ============================================================================
// ORGANIZATION & MULTI-TENANCY
// ============================================================================

export interface Organization {
  id: string;
  name: string;
  slug: string;
  address?: string;
  phone?: string;
  created_at: string;
  updated_at?: string;
}

// ============================================================================
// JOB SITES
// ============================================================================

export type JobSiteStatus = 'active' | 'on_hold' | 'completed';

export interface JobSite {
  id: string;
  organization_id: string;
  name: string;
  address?: string;
  description?: string;
  status: JobSiteStatus;
  start_date?: string;
  end_date?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
  is_system_site?: boolean; // Marks system sites like "Unassigned" that can't be deleted
}

// ============================================================================
// USER & ROLE DEFINITIONS
// ============================================================================

// Base roles that a user can have at the organization level
export type BaseRole = 'manager' | 'admin' | 'superintendent' | 'engineer' | 'foreman' | 'worker';

// Roles that can be assigned at the job site level
export type JobSiteRole = 'superintendent' | 'engineer' | 'engineer_as_superintendent' | 'foreman' | 'worker';

// Legacy roles for backward compatibility
export type LegacyRole = 'admin' | 'foreman' | 'viewer';

export interface User {
  id: string;
  org_id: string;
  email: string;
  name: string;
  role: LegacyRole; // Keep for backward compatibility
  base_role?: BaseRole; // New field
  phone?: string;
  avatar_url?: string;
  created_at: string;
  updated_at?: string;
}

// Extended user profile with organization and job site info
export interface UserProfile extends User {
  organization?: Organization;
  job_site_assignments?: JobSiteAssignment[];
  current_job_site?: JobSite;
  current_site_role?: JobSiteRole;
}

// ============================================================================
// JOB SITE ASSIGNMENTS
// ============================================================================

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
  assigned_by_user?: User;
}

// ============================================================================
// WORKER SITE ASSIGNMENTS
// ============================================================================

export interface WorkerSiteAssignment {
  id: string;
  worker_id: string;
  job_site_id: string;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  assigned_by?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  // Joined data
  job_site?: JobSite;
}

// ============================================================================
// WORKER CREW ASSIGNMENTS (per-site crew membership)
// ============================================================================

export interface WorkerCrewAssignment {
  id: string;
  worker_id: string;
  job_site_id: string;
  crew_id: string;
  created_at: string;
}

// ============================================================================
// CREWS
// ============================================================================

export interface Crew {
  id: string;
  job_site_id: string;
  organization_id: string;
  name: string;
  color?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
  // Joined data
  workers?: Worker[];
}

// ============================================================================
// WORKERS
// ============================================================================

export type WorkerRole = 'operator' | 'laborer' | 'carpenter' | 'mason' | 'mechanic' | 'driver';
export type WorkerStatus = 'active' | 'inactive';

export interface Worker {
  id: string;
  org_id: string; // Keep for backward compatibility
  organization_id?: string; // New field (same as org_id)
  job_site_id?: string;
  user_id?: string; // Link to user account if worker has login
  crew_id?: string; // Crew membership (null = no crew)
  name: string;
  role: WorkerRole;
  skills: string[];
  phone?: string;
  status: WorkerStatus;
  notes?: string;
  created_at: string;
  // Joined data
  job_site?: JobSite;
  user?: User;
  crew?: Crew;
}

// ============================================================================
// TASKS
// ============================================================================

export type TaskStatus = 'planned' | 'active' | 'completed' | 'draft';

export interface Task {
  id: string;
  org_id: string; // Keep for backward compatibility
  organization_id?: string; // New field
  job_site_id?: string;
  name: string;
  activity_id?: string; // Activity ID from project schedule (e.g., A1000)
  activity_name?: string; // Activity name from project schedule
  duration?: number; // Duration in days
  location?: string;
  start_date?: string;
  end_date?: string;
  required_operators: number;
  required_laborers: number;
  required_carpenters?: number;
  required_masons?: number;
  status: TaskStatus;
  notes?: string;
  attachments?: string[];
  include_saturday?: boolean;
  include_sunday?: boolean;
  include_holidays?: boolean;
  created_by: string;
  created_at: string;
  modified_by?: string;
  modified_at?: string;
  // Joined data
  job_site?: JobSite;
  creator?: User;
}

export interface TaskDraft {
  id: string;
  org_id: string;
  organization_id?: string;
  job_site_id?: string;
  name: string;
  activity_id?: string;
  activity_name?: string;
  duration?: number;
  location?: string;
  start_date?: string;
  end_date?: string;
  required_operators: number;
  required_laborers: number;
  required_carpenters: number;
  required_masons: number;
  notes?: string;
  attachments?: string[];
  include_saturday?: boolean;
  include_sunday?: boolean;
  include_holidays?: boolean;
  created_by: string;
  created_at: string;
  modified_by?: string;
  modified_at?: string;
}

// ============================================================================
// ASSIGNMENTS (Worker to Task)
// ============================================================================

export type AssignmentStatus = 'assigned' | 'completed' | 'reassigned';

export interface Assignment {
  id: string;
  organization_id: string;
  org_id?: string; // Deprecated: use organization_id
  job_site_id?: string;
  task_id: string;
  worker_id: string;
  assigned_date: string;
  status: AssignmentStatus;
  acknowledged?: boolean;
  assigned_by: string;
  created_at: string;
  // Joined data
  worker?: Worker;
  task?: Task;
  job_site?: JobSite;
}

// ============================================================================
// ASSIGNMENT REQUESTS
// ============================================================================

export type RequestStatus = 'pending' | 'approved' | 'denied';

export interface AssignmentRequest {
  id: string;
  organization_id: string;
  org_id?: string; // Deprecated: use organization_id
  job_site_id?: string;
  worker_id: string;
  from_task_id?: string;
  to_task_id: string;
  requested_by: string;
  reason?: string;
  status: RequestStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  // Joined data
  worker?: Worker;
  from_task?: Task;
  to_task?: Task;
  foreman?: User;
  job_site?: JobSite;
}

// ============================================================================
// TASK HISTORY
// ============================================================================

export type TaskAction = 'created' | 'modified' | 'completed' | 'reopened';

export interface TaskHistory {
  id: string;
  task_id: string;
  org_id: string;
  organization_id?: string;
  job_site_id?: string;
  action: TaskAction;
  performed_by?: string;
  performed_at: string;
  notes?: string;
  previous_status?: string;
  new_status?: string;
  changes?: Record<string, unknown>;
  // Joined data
  user?: User;
  task?: Task;
}

// ============================================================================
// HOLIDAYS
// ============================================================================

export interface Holiday {
  id: string;
  name: string;
  date: string;
  year: number;
  state_county: boolean;
  federal: boolean;
  gcla: boolean;
  four_basic_trades: boolean;
  pay_rates: {
    carpenters?: string;
    laborers?: string;
    masons?: string;
    operators?: string;
    federal?: string;
    state_county?: string;
  };
  notes?: string;
  created_at: string;
}

// ============================================================================
// DAILY HOURS
// ============================================================================

export type DailyHoursStatus = 'worked' | 'off' | 'transferred';

export interface DailyHours {
  id: string;
  org_id: string;
  organization_id?: string;
  job_site_id?: string;
  worker_id: string;
  log_date: string;
  status: DailyHoursStatus;
  hours_worked: number;
  ot_hours?: number;
  task_id?: string;
  transferred_to_task_id?: string;
  transferred_to_job_site_id?: string;
  notes?: string;
  logged_by?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  worker?: Worker;
  task?: Task;
  transferred_to_task?: Task;
  transferred_to_job_site?: JobSite;
  job_site?: JobSite;
}

// ============================================================================
// SITE EVENTS
// ============================================================================

export interface SiteEvent {
  id: string;
  job_site_id: string;
  organization_id: string;
  title: string;
  event_date: string; // DATE, e.g. "2026-03-15"
  start_time?: string; // TIME, e.g. "06:00"
  location?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

// ============================================================================
// DAILY NOTES
// ============================================================================

export interface DailyNote {
  id: string;
  organization_id: string;
  job_site_id?: string;
  note_date: string;
  general_notes?: string;
  equipment_notes?: string;
  tools_notes?: string;
  safety_notes?: string;
  weather_notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// EQUIPMENT
// ============================================================================

export type EquipmentType = 'heavy_equipment' | 'small_equipment' | 'tools' | 'vehicles' | 'other';
export type EquipmentStatus = 'available' | 'in_use' | 'maintenance' | 'retired';

export interface Equipment {
  id: string;
  organization_id: string;
  job_site_id?: string;
  name: string;
  type: EquipmentType;
  model?: string;
  serial_number?: string;
  status: EquipmentStatus;
  notes?: string;
  created_by?: string;
  created_at: string;
  // Joined data
  job_site?: JobSite;
}

export interface EquipmentSiteAssignment {
  id: string;
  equipment_id: string;
  job_site_id: string;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  assigned_by?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  // Joined data
  job_site?: JobSite;
}

// ============================================================================
// EQUIPMENT INVENTORY
// ============================================================================

export interface EquipmentInventory {
  id: string;
  organization_id: string;
  name: string;
  make?: string;
  model?: string;
  serial_number?: string;
  category?: string;
  quantity_total: number;
  quantity_available: number;
  current_job_site_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  current_location?: JobSite;
}

// ============================================================================
// EQUIPMENT MOVEMENT LOG
// ============================================================================

export interface EquipmentMovementLog {
  id: string;
  organization_id: string;
  equipment_inventory_id?: string;
  equipment_id?: string;
  equipment_name: string;
  from_job_site_id?: string;
  to_job_site_id?: string;
  moved_by?: string;
  request_id?: string;
  notes?: string;
  moved_at: string;
  // Joined data
  from_job_site?: JobSite;
  to_job_site?: JobSite;
  moved_by_profile?: User;
}

// ============================================================================
// EQUIPMENT REQUESTS
// ============================================================================

export type EquipmentRequestStatus = 'pending' | 'approved' | 'dispatched' | 'received';

export interface EquipmentRequest {
  id: string;
  organization_id: string;
  equipment_inventory_id?: string;
  equipment_name: string;
  quantity_requested: number;
  requesting_job_site_id: string;
  destination_job_site_id: string;
  date_needed: string;
  notes?: string;
  status: EquipmentRequestStatus;
  requested_by: string;
  approved_by?: string;
  dispatched_by?: string;
  dispatch_notes?: string;
  dispatched_at?: string;
  received_at?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  requesting_job_site?: JobSite;
  destination_job_site?: JobSite;
  requested_by_profile?: User;
  equipment_inventory?: EquipmentInventory;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type StaffingStatus = 'success' | 'warning' | 'error';

// ============================================================================
// CONTEXT TYPES
// ============================================================================

export interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (updates: { name?: string; phone?: string; email?: string }) => Promise<void>;
}

export interface JobSiteContextType {
  currentJobSite: JobSite | null;
  availableJobSites: JobSite[];
  isLoading: boolean;
  isAdmin: boolean; // true for manager OR admin (elevated access)
  isManager: boolean; // true only for manager (company-wide authority)
  userSiteRole: JobSiteRole | null;
  switchJobSite: (siteId: string) => Promise<void>;
  refreshJobSites: () => Promise<void>;
  canManageSite: boolean; // Can create/edit tasks, manage workers
  canViewSite: boolean; // Can view site data
}

// ============================================================================
// PERMISSION TYPES
// ============================================================================

export interface Permissions {
  // Job Site Level
  canViewJobSite: boolean;
  canManageJobSite: boolean;
  canCreateJobSite: boolean;
  canDeleteJobSite: boolean;
  
  // Worker Level
  canViewWorkers: boolean;
  canManageWorkers: boolean;
  canMoveWorkersBetweenSites: boolean;
  
  // Task Level
  canViewTasks: boolean;
  canCreateTasks: boolean;
  canEditTasks: boolean;
  canDeleteTasks: boolean;
  canAssignWorkers: boolean;
  
  // Assignment Level
  canRequestReassignment: boolean;
  canApproveReassignments: boolean;
  
  // Hours Level
  canLogHours: boolean;
  canEditHours: boolean;
  
  // Admin Level
  canManageUsers: boolean;
  canManageOrganization: boolean;
  canViewAllSites: boolean;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================================
// VOICE COMMAND TYPES
// ============================================================================

export type VoiceAction = 
  | 'reassign_worker'
  | 'create_task'
  | 'query_info'
  | 'update_timesheet'
  | 'approve_request'
  | 'clarify';

export interface VoiceIntent {
  action: VoiceAction;
  confidence: number;
  data: Record<string, unknown>;
  summary: string;
  needs_confirmation: boolean;
  question?: string;
  options?: string[];
  job_site_id?: string; // Context: which job site this applies to
}

// ============================================================================
// FORM TYPES
// ============================================================================

export interface CreateJobSiteForm {
  name: string;
  address?: string;
  description?: string;
  status: JobSiteStatus;
  start_date?: string;
  end_date?: string;
}

export interface AssignUserToSiteForm {
  user_id: string;
  job_site_id: string;
  role: JobSiteRole;
  start_date?: string;
}

export interface MoveWorkerForm {
  worker_id: string;
  from_site_id: string;
  to_site_id: string;
  effective_date?: string;
}

export interface CreateOrganizationForm {
  name: string;
  slug?: string;
  address?: string;
  phone?: string;
}

export interface InviteUserForm {
  email: string;
  name: string;
  base_role: BaseRole;
  job_site_ids?: string[];
  job_site_role?: JobSiteRole;
}
