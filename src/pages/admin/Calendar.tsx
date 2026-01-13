import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useRealtimeSubscriptions } from '../../lib/hooks/useRealtime';
import type { Task, Assignment, Holiday } from '../../types';
import { 
  format, 
  addWeeks, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval,
  isSameDay,
  parseISO
} from 'date-fns';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/Badge';
import { getStaffingStatus } from '../../lib/utils';
import { GanttChartView } from '../../components/calendar/GanttChartView';
import { TaskDetailsModal } from '../../components/tasks/TaskDetailsModal';

type ViewMode = 'calendar' | 'gantt';

export function Calendar() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskDetails, setShowTaskDetails] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  // Enable real-time subscriptions
  useRealtimeSubscriptions([
    { table: 'tasks', onUpdate: useCallback(() => fetchData(), []) },
    { table: 'assignments', onUpdate: useCallback(() => fetchData(), []) },
  ]);

  const fetchData = async () => {
    try {
      const [tasksData, assignmentsData, holidaysData] = await Promise.all([
        supabase.from('tasks').select('*').order('start_date'),
        supabase.from('assignments').select(`*, worker:workers(*)`),
        supabase.from('holidays').select('*').eq('year', 2026).order('date'),
      ]);

      if (tasksData.error) throw tasksData.error;
      if (assignmentsData.error) throw assignmentsData.error;
      if (holidaysData.error) throw holidaysData.error;

      setTasks(tasksData.data || []);
      setAssignments(assignmentsData.data || []);
      setHolidays(holidaysData.data || []);
    } catch (error) {
      toast.error('Failed to load calendar data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Check if a date is a working day for a specific task
  const isWorkingDayForTask = (date: Date, task: Task): boolean => {
    const dayOfWeek = date.getDay();
    
    // Check if it's a holiday
    const dateStr = format(date, 'yyyy-MM-dd');
    const isHoliday = holidays.some(h => h.date === dateStr);
    
    // If it's a holiday and task doesn't include holidays, it's not a working day
    if (isHoliday && !task.include_holidays) {
      return false;
    }
    
    // Monday-Friday are always working days (unless it's a holiday and include_holidays is false)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      return true;
    }
    
    // Saturday: only if task includes Saturday
    if (dayOfWeek === 6) {
      return task.include_saturday || false;
    }
    
    // Sunday: only if task includes Sunday
    if (dayOfWeek === 0) {
      return task.include_sunday || false;
    }
    
    return false;
  };

  // Generate 4 weeks of calendar data
  const generateWeeks = () => {
    const weeks = [];
    const today = new Date();

    for (let i = 0; i < 4; i++) {
      const weekStart = startOfWeek(addWeeks(today, i), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(addWeeks(today, i), { weekStartsOn: 1 });
      const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

      weeks.push({
        weekNumber: i + 1,
        weekStart,
        weekEnd,
        days,
      });
    }

    return weeks;
  };

  // Get tasks for a specific date - only show if it's a working day for that task
  const getTasksForDate = (date: Date) => {
    return tasks.filter(task => {
      // Skip tasks without dates
      if (!task.start_date || !task.end_date) return false;
      
      const taskStart = parseISO(task.start_date);
      const taskEnd = parseISO(task.end_date);
      
      // Check if date is within task range
      if (date < taskStart || date > taskEnd) return false;
      
      // Check if it's a working day for this specific task
      return isWorkingDayForTask(date, task);
    });
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setShowTaskDetails(true);
  };

  const weeks = generateWeeks();

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Calendar</h1>
            <p className="text-text-secondary">
              {viewMode === 'calendar' 
                ? '4-week task schedule overview' 
                : 'Professional Gantt chart timeline view'}
            </p>
          </div>
          
          {/* View Toggle */}
          <div className="flex items-center gap-2 bg-bg-secondary border border-border rounded-lg p-1">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-4 py-2 rounded-md transition-colors flex items-center gap-2 ${
                viewMode === 'calendar'
                  ? 'bg-primary text-white'
                  : 'hover:bg-bg-hover'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Calendar
            </button>
            <button
              onClick={() => setViewMode('gantt')}
              className={`px-4 py-2 rounded-md transition-colors flex items-center gap-2 ${
                viewMode === 'gantt'
                  ? 'bg-primary text-white'
                  : 'hover:bg-bg-hover'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Gantt Chart
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-text-secondary">Loading calendar...</p>
        </div>
      ) : viewMode === 'gantt' ? (
        <GanttChartView tasks={tasks} assignments={assignments} />
      ) : (
        <div className="overflow-x-auto">
          <div className="flex gap-4 min-w-max">
            {weeks.map((week) => (
              <div
                key={week.weekNumber}
                className="flex-shrink-0 w-[280px] bg-bg-secondary border border-border rounded-lg p-4"
              >
                {/* Week Header */}
                <div className="mb-4 pb-3 border-b border-border">
                  <h2 className="font-bold text-lg">
                    Week {week.weekNumber}
                  </h2>
                  <p className="text-sm text-text-secondary">
                    {format(week.weekStart, 'MMM d')} - {format(week.weekEnd, 'MMM d')}
                  </p>
                </div>

                {/* Days */}
                <div className="space-y-3">
                  {week.days.map((day) => {
                    const dayTasks = getTasksForDate(day);
                    const isToday = isSameDay(day, new Date());

                    return (
                      <div
                        key={day.toISOString()}
                        className={`p-3 rounded-lg border ${
                          isToday
                            ? 'bg-primary/10 border-primary'
                            : 'bg-bg-primary border-border'
                        }`}
                      >
                        {/* Day Header */}
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="font-medium text-sm">
                              {format(day, 'EEE')}
                            </div>
                            <div className="text-xs text-text-secondary">
                              {format(day, 'MMM d')}
                            </div>
                          </div>
                          {isToday && (
                            <Badge variant="info" className="text-xs">
                              Today
                            </Badge>
                          )}
                        </div>

                        {/* Tasks for this day */}
                        {dayTasks.length === 0 ? (
                          <div className="text-xs text-text-secondary italic">
                            No tasks
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {dayTasks.map((task) => {
                              const status = getStaffingStatus(task, assignments);
                              return (
                                <div
                                  key={task.id}
                                  onClick={() => handleTaskClick(task)}
                                  className={`p-2 rounded border-l-2 text-xs cursor-pointer hover:opacity-80 transition-opacity ${
                                    status === 'success'
                                      ? 'bg-success/10 border-success'
                                      : status === 'warning'
                                      ? 'bg-warning/10 border-warning'
                                      : 'bg-error/10 border-error'
                                  }`}
                                >
                                  <div className="font-medium line-clamp-1">
                                    {task.name}
                                  </div>
                                  {task.location && (
                                    <div className="text-text-secondary line-clamp-1 mt-0.5">
                                      {task.location}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend - Only show for calendar view, hidden on mobile */}
      {viewMode === 'calendar' && (
        <div className="mt-8 hidden md:flex items-center gap-6 p-4 bg-bg-secondary border border-border rounded-lg">
          <div className="font-medium">Staffing Status:</div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-success"></div>
            <span className="text-sm">Fully Staffed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-warning"></div>
            <span className="text-sm">Partially Staffed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-error"></div>
            <span className="text-sm">Understaffed</span>
          </div>
        </div>
      )}

      {/* Task Details Modal */}
      {selectedTask && (
        <TaskDetailsModal
          isOpen={showTaskDetails}
          onClose={() => {
            setShowTaskDetails(false);
            setSelectedTask(null);
          }}
          task={selectedTask}
          assignments={assignments}
        />
      )}
    </div>
  );
}
