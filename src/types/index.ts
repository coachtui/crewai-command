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
  role: 'operator' | 'laborer';
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
  start_date: string;
  end_date: string;
  required_operators: number;
  required_laborers: number;
  status: 'planned' | 'active' | 'completed';
  notes?: string;
  created_by: string;
  created_at: string;
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

export type StaffingStatus = 'success' | 'warning' | 'error';
