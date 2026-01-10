import { format, eachDayOfInterval } from 'date-fns';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Task, Assignment, StaffingStatus } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getDatesInRange(startDate: string, endDate: string): string[] {
  const dates = eachDayOfInterval({
    start: new Date(startDate),
    end: new Date(endDate),
  });
  return dates.map((date) => format(date, 'yyyy-MM-dd'));
}

export function getStaffingStatus(
  task: Task,
  assignments: Assignment[]
): StaffingStatus {
  const taskAssignments = assignments.filter((a) => a.task_id === task.id);

  const assignedOps = taskAssignments.filter(
    (a) => a.worker?.role === 'operator'
  ).length;
  const assignedLabs = taskAssignments.filter(
    (a) => a.worker?.role === 'laborer'
  ).length;

  if (
    assignedOps >= task.required_operators &&
    assignedLabs >= task.required_laborers
  ) {
    return 'success'; // Green
  }
  if (assignedOps === 0 || assignedLabs === 0) {
    return 'error'; // Red
  }
  return 'warning'; // Yellow
}

export function formatDate(date: string): string {
  return format(new Date(date), 'MMM d, yyyy');
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}
