import { differenceInDays, eachDayOfInterval, addDays, format, parseISO } from 'date-fns';
import type { Task, Assignment } from '../types';

export interface GanttTask {
  id: string;
  name: string;
  location?: string;
  startDate: Date;
  endDate: Date;
  duration: number;
  workingDays: number;
  assignedOperators: number;
  assignedLaborers: number;
  assignedCarpenters: number;
  assignedMasons: number;
  requiredOperators: number;
  requiredLaborers: number;
  requiredCarpenters: number;
  requiredMasons: number;
  totalAssigned: number;
  totalRequired: number;
  staffingStatus: 'full' | 'partial' | 'empty';
  status: 'planned' | 'active' | 'completed';
  include_saturday?: boolean;
  include_sunday?: boolean;
}

export function transformTasksToGantt(
  tasks: Task[],
  assignments: Assignment[]
): GanttTask[] {
  return tasks
    .filter(task => task.start_date && task.end_date)
    .map(task => {
      // Use parseISO to properly handle date strings without timezone shifts
      const startDate = parseISO(task.start_date!);
      const endDate = parseISO(task.end_date!);
      
      // Calculate total calendar days (including weekends)
      const duration = differenceInDays(endDate, startDate) + 1;
      
      // Calculate working days (respecting task-specific weekend work settings)
      const workingDays = calculateWorkingDays(
        startDate, 
        endDate,
        task.include_saturday || false,
        task.include_sunday || false
      );
      
      // Get assignments for this task
      const taskAssignments = assignments.filter(a => a.task_id === task.id);
      
      // Count by role (matching calendar logic)
      const assignedOperators = taskAssignments.filter(
        a => a.worker?.role === 'operator'
      ).length;
      
      const assignedLaborers = taskAssignments.filter(
        a => a.worker?.role === 'laborer'
      ).length;
      
      const assignedCarpenters = taskAssignments.filter(
        a => a.worker?.role === 'carpenter'
      ).length;
      
      const assignedMasons = taskAssignments.filter(
        a => a.worker?.role === 'mason'
      ).length;
      
      const requiredCarpenters = task.required_carpenters || 0;
      const requiredMasons = task.required_masons || 0;
      
      const totalAssigned = assignedOperators + assignedLaborers + assignedCarpenters + assignedMasons;
      const totalRequired = task.required_operators + task.required_laborers + requiredCarpenters + requiredMasons;
      
      return {
        id: task.id,
        name: task.name,
        location: task.location,
        startDate,
        endDate,
        duration,
        workingDays,
        assignedOperators,
        assignedLaborers,
        assignedCarpenters,
        assignedMasons,
        requiredOperators: task.required_operators,
        requiredLaborers: task.required_laborers,
        requiredCarpenters,
        requiredMasons,
        totalAssigned,
        totalRequired,
        staffingStatus: getStaffingStatus(
          assignedOperators,
          assignedLaborers,
          task.required_operators,
          task.required_laborers
        ),
        status: task.status,
        include_saturday: task.include_saturday,
        include_sunday: task.include_sunday,
      };
    })
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

export function calculateWorkingDays(
  startDate: Date, 
  endDate: Date,
  includeSaturday: boolean = false,
  includeSunday: boolean = false
): number {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  
  return days.filter(day => {
    const dayOfWeek = day.getDay();
    
    // Always include Monday-Friday
    if (dayOfWeek >= 1 && dayOfWeek <= 5) return true;
    
    // Include Saturday if specified
    if (dayOfWeek === 6 && includeSaturday) return true;
    
    // Include Sunday if specified
    if (dayOfWeek === 0 && includeSunday) return true;
    
    return false;
  }).length;
}

export function getStaffingStatus(
  assignedOps: number,
  assignedLabs: number,
  requiredOps: number,
  requiredLabs: number
): 'full' | 'partial' | 'empty' {
  // Match calendar logic exactly
  if (assignedOps >= requiredOps && assignedLabs >= requiredLabs) {
    return 'full'; // Green - fully staffed
  }
  if (assignedOps === 0 || assignedLabs === 0) {
    return 'empty'; // Red - missing role entirely
  }
  return 'partial'; // Orange - understaffed but has some crew
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
    // Start from Monday of current week
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = addDays(today, -(dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    
    return {
      startDate: monday,
      endDate: addDays(monday, 27), // 4 weeks
      days: eachDayOfInterval({ start: monday, end: addDays(monday, 27) }),
    };
  }

  const allStartDates = tasks.map(t => t.startDate);
  const allEndDates = tasks.map(t => t.endDate);
  
  const minStart = new Date(Math.min(...allStartDates.map(d => d.getTime())));
  const maxEnd = new Date(Math.max(...allEndDates.map(d => d.getTime())));
  
  // Add padding, aligning to Monday
  const startDayOfWeek = minStart.getDay();
  const startMonday = addDays(minStart, -(startDayOfWeek === 0 ? 6 : startDayOfWeek - 1));
  const startDate = addDays(startMonday, -7); // One week before
  
  const endDate = addDays(maxEnd, 7); // One week after
  
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
