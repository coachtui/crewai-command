import { differenceInDays, eachDayOfInterval, addDays, format } from 'date-fns';
import type { Task, Assignment } from '../types';

export interface GanttTask {
  id: string;
  name: string;
  location?: string;
  startDate: Date;
  endDate: Date;
  duration: number;
  assignedCount: number;
  requiredCount: number;
  staffingStatus: 'full' | 'partial' | 'empty';
  status: 'planned' | 'active' | 'completed';
}

export function transformTasksToGantt(
  tasks: Task[],
  assignments: Assignment[]
): GanttTask[] {
  return tasks
    .filter(task => task.start_date && task.end_date)
    .map(task => {
      const startDate = new Date(task.start_date!);
      const endDate = new Date(task.end_date!);
      const duration = differenceInDays(endDate, startDate) + 1;
      
      const taskAssignments = assignments.filter(a => a.task_id === task.id);
      const assignedCount = taskAssignments.length;
      const requiredCount = task.required_operators + task.required_laborers;
      
      return {
        id: task.id,
        name: task.name,
        location: task.location,
        startDate,
        endDate,
        duration,
        assignedCount,
        requiredCount,
        staffingStatus: getStaffingStatus(assignedCount, requiredCount),
        status: task.status,
      };
    })
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

export function getStaffingStatus(
  assigned: number,
  required: number
): 'full' | 'partial' | 'empty' {
  if (assigned >= required) return 'full';
  if (assigned === 0) return 'empty';
  return 'partial';
}

export function getColorByStatus(status: 'full' | 'partial' | 'empty'): string {
  switch (status) {
    case 'full':
      return '#10b981'; // Green - fully staffed
    case 'partial':
      return '#f59e0b'; // Orange - understaffed
    case 'empty':
      return '#ef4444'; // Red - not staffed
  }
}

export function calculateTimelineRange(tasks: GanttTask[]): {
  startDate: Date;
  endDate: Date;
  days: Date[];
} {
  if (tasks.length === 0) {
    const today = new Date();
    return {
      startDate: today,
      endDate: addDays(today, 28),
      days: eachDayOfInterval({ start: today, end: addDays(today, 28) }),
    };
  }

  const allStartDates = tasks.map(t => t.startDate);
  const allEndDates = tasks.map(t => t.endDate);
  
  const minStart = new Date(Math.min(...allStartDates.map(d => d.getTime())));
  const maxEnd = new Date(Math.max(...allEndDates.map(d => d.getTime())));
  
  // Add some padding
  const startDate = addDays(minStart, -3);
  const endDate = addDays(maxEnd, 3);
  
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  
  return { startDate, endDate, days };
}

export function calculateTaskBarPosition(
  task: GanttTask,
  timelineStart: Date,
  dayWidth: number
): { left: number; width: number } {
  const daysFromStart = differenceInDays(task.startDate, timelineStart);
  const left = Math.max(0, daysFromStart * dayWidth);
  const width = task.duration * dayWidth;
  
  return { left, width };
}

export function formatDateHeader(date: Date, index: number): string {
  // Show full date for Mondays or first day
  if (index === 0 || date.getDay() === 1) {
    return format(date, 'MMM d');
  }
  return format(date, 'd');
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}
