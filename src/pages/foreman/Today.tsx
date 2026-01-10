import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRealtimeSubscriptions } from '../../lib/hooks/useRealtime';
import type { Task, Assignment, Worker } from '../../types';
import { format } from 'date-fns';
import { Calendar, Users, ArrowRight } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { toast } from 'sonner';

export function Today() {
  const [todaysTasks, setTodaysTasks] = useState<Task[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<{worker: Worker, task: Task} | null>(null);

  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    fetchData();
  }, []);

  // Real-time updates
  useRealtimeSubscriptions([
    { table: 'tasks', onUpdate: () => fetchData() },
    { table: 'assignments', onUpdate: () => fetchData() },
  ]);

  const fetchData = async () => {
    try {
      // Get today's assignments with tasks and workers
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select(`
          *,
          task:tasks(*),
          worker:workers(*)
        `)
        .eq('assigned_date', today)
        .eq('status', 'assigned');

      if (assignmentsError) throw assignmentsError;

      // Extract unique tasks
      const taskIds = new Set(assignmentsData?.map(a => a.task_id));
      const uniqueTasks = Array.from(taskIds).map(taskId => {
        const assignment = assignmentsData?.find(a => a.task_id === taskId);
        return assignment?.task;
      }).filter(Boolean) as Task[];

      setTodaysTasks(uniqueTasks);
      setAssignments(assignmentsData || []);
    } catch (error) {
      toast.error('Failed to load data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Get workers assigned to a specific task today
  const getTaskWorkers = (taskId: string) => {
    return assignments.filter(a => a.task_id === taskId);
  };

  const handleWorkerLongPress = (worker: Worker, task: Task) => {
    setSelectedWorker({ worker, task });
  };

  return (
    <div className="min-h-screen bg-bg-primary p-4 pb-20">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-text-secondary mb-2">
          <Calendar size={20} />
          <span className="text-sm font-medium">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </span>
        </div>
        <h1 className="text-3xl font-bold">Today's Schedule</h1>
        <p className="text-text-secondary mt-1">
          {todaysTasks.length} {todaysTasks.length === 1 ? 'task' : 'tasks'} scheduled
        </p>
      </div>

      {/* Tasks List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-text-secondary">Loading schedule...</p>
        </div>
      ) : todaysTasks.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-text-secondary">No tasks scheduled for today</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {todaysTasks.map((task) => {
            const taskWorkers = getTaskWorkers(task.id);
            const operators = taskWorkers.filter(a => a.worker?.role === 'operator');
            const laborers = taskWorkers.filter(a => a.worker?.role === 'laborer');

            return (
              <Card key={task.id} className="p-4">
                {/* Task Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg mb-1">{task.name}</h3>
                    {task.location && (
                      <p className="text-sm text-text-secondary">📍 {task.location}</p>
                    )}
                  </div>
                  <Badge variant={task.status === 'active' ? 'success' : 'default'}>
                    {task.status}
                  </Badge>
                </div>

                {/* Crew Section */}
                <div className="space-y-3">
                  {/* Operators */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Users size={16} className="text-info" />
                      <span className="text-sm font-medium">
                        Operators ({operators.length}/{task.required_operators})
                      </span>
                    </div>
                    {operators.length === 0 ? (
                      <p className="text-xs text-text-secondary italic ml-6">No operators assigned</p>
                    ) : (
                      <div className="space-y-1 ml-6">
                        {operators.map((assignment) => (
                          <button
                            key={assignment.id}
                            onClick={() => handleWorkerLongPress(assignment.worker!, task)}
                            className="w-full text-left p-2 bg-bg-primary border border-border rounded hover:border-primary transition-colors"
                          >
                            <div className="font-medium text-sm">{assignment.worker?.name}</div>
                            {assignment.worker?.skills && assignment.worker.skills.length > 0 && (
                              <div className="text-xs text-text-secondary mt-0.5">
                                {(assignment.worker.skills as string[]).join(', ')}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Laborers */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Users size={16} className="text-warning" />
                      <span className="text-sm font-medium">
                        Laborers ({laborers.length}/{task.required_laborers})
                      </span>
                    </div>
                    {laborers.length === 0 ? (
                      <p className="text-xs text-text-secondary italic ml-6">No laborers assigned</p>
                    ) : (
                      <div className="space-y-1 ml-6">
                        {laborers.map((assignment) => (
                          <button
                            key={assignment.id}
                            onClick={() => handleWorkerLongPress(assignment.worker!, task)}
                            className="w-full text-left p-2 bg-bg-primary border border-border rounded hover:border-primary transition-colors"
                          >
                            <div className="font-medium text-sm">{assignment.worker?.name}</div>
                            {assignment.worker?.skills && assignment.worker.skills.length > 0 && (
                              <div className="text-xs text-text-secondary mt-0.5">
                                {(assignment.worker.skills as string[]).join(', ')}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Task Notes */}
                {task.notes && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-sm text-text-secondary">{task.notes}</p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Request Move Modal - Simplified for now */}
      {selectedWorker && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-bg-secondary w-full sm:w-96 sm:rounded-lg p-6 animate-slide-up">
            <h3 className="text-xl font-bold mb-4">Request Worker Move</h3>
            
            <div className="mb-4 p-3 bg-bg-primary border border-border rounded">
              <div className="font-medium">{selectedWorker.worker.name}</div>
              <div className="text-sm text-text-secondary">
                Currently on: {selectedWorker.task.name}
              </div>
            </div>

            <p className="text-sm text-text-secondary mb-4">
              Worker reassignment requests will be available when the Superintendent approval system is activated.
              For now, the Superintendent can reassign workers directly from the Tasks page.
            </p>

            <Button onClick={() => setSelectedWorker(null)} variant="secondary" className="w-full">
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
