import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useRealtimeSubscriptions } from '../../lib/hooks/useRealtime';
import type { Task, Assignment } from '../../types';
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

export function Calendar() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

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
      const [tasksData, assignmentsData] = await Promise.all([
        supabase.from('tasks').select('*').order('start_date'),
        supabase.from('assignments').select(`*, worker:workers(*)`),
      ]);

      if (tasksData.error) throw tasksData.error;
      if (assignmentsData.error) throw assignmentsData.error;

      setTasks(tasksData.data || []);
      setAssignments(assignmentsData.data || []);
    } catch (error) {
      toast.error('Failed to load calendar data');
      console.error(error);
    } finally {
      setLoading(false);
    }
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

  // Get tasks for a specific date
  const getTasksForDate = (date: Date) => {
    return tasks.filter(task => {
      // Skip tasks without dates
      if (!task.start_date || !task.end_date) return false;
      
      const taskStart = parseISO(task.start_date);
      const taskEnd = parseISO(task.end_date);
      return date >= taskStart && date <= taskEnd;
    });
  };

  const weeks = generateWeeks();

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Calendar</h1>
        <p className="text-text-secondary">4-week task schedule overview</p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-text-secondary">Loading calendar...</p>
        </div>
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
                                  className={`p-2 rounded border-l-2 text-xs ${
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

      {/* Legend - Hidden on mobile */}
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
    </div>
  );
}
