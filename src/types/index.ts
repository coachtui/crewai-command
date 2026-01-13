export interface Organization {
  id: string;
  name: string;
  created_at: string;
}

export interface User {
  id: string;
  org_id: string;
  email: string;
  name: string;
  role: 'admin' | 'foreman';
  created_at: string;
}

export interface Worker {
  id: string;
  org_id: string;
  name: string;
  role: 'operator' | 'laborer' | 'carpenter' | 'mason';
  skills: string[];
  phone?: string;
  status: 'active' | 'inactive';
  notes?: string;
  created_at: string;
}

export interface Task {
  id: string;
  org_id: string;
  name: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  required_operators: number;
  required_laborers: number;
  required_carpenters?: number;
  required_masons?: number;
  status: 'planned' | 'active' | 'completed';
  notes?: string;
  attachments?: string[]; // Array of file URLs
  include_saturday?: boolean; // Whether this task includes Saturday work
  include_sunday?: boolean; // Whether this task includes Sunday work
  created_by: string;
  created_at: string;
  modified_by?: string;
  modified_at?: string;
}

export interface Assignment {
  id: string;
  org_id: string;
  task_id: string;
  worker_id: string;
  assigned_date: string;
  status: 'assigned' | 'completed' | 'reassigned';
  assigned_by: string;
  created_at: string;
  worker?: Worker;
  task?: Task;
}

export interface AssignmentRequest {
  id: string;
  org_id: string;
  worker_id: string;
  from_task_id?: string;
  to_task_id: string;
  requested_by: string;
  reason?: string;
  status: 'pending' | 'approved' | 'denied';
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  worker?: Worker;
  from_task?: Task;
  to_task?: Task;
  foreman?: User;
}

export interface TaskHistory {
  id: string;
  task_id: string;
  org_id: string;
  action: 'created' | 'modified' | 'completed' | 'reopened';
  performed_by?: string;
  performed_at: string;
  notes?: string;
  previous_status?: string;
  new_status?: string;
  changes?: Record<string, unknown>;
  user?: User;
}

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

export type StaffingStatus = 'success' | 'warning' | 'error';
