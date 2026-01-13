import { useState, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useRealtimeSubscriptions } from '../../lib/hooks/useRealtime';
import { Button } from '../../components/ui/Button';
import { TaskCard } from '../../components/tasks/TaskCard';
import { TaskForm } from '../../components/tasks/TaskForm';
import { AssignmentModal } from '../../components/assignments/AssignmentModal';
import { Modal } from '../../components/ui/Modal';
import type { Task, Assignment, TaskDraft } from '../../types';
import { toast } from 'sonner';
import { format, addWeeks, startOfWeek, endOfWeek } from 'date-fns';

export function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [assigningTask, setAssigningTask] = useState<Task | null>(null);

  useEffect(() => {
    fetchTasks();
    fetchAssignments();
  }, []);

  // Enable real-time subscriptions for tasks and assignments
  useRealtimeSubscriptions([
    { table: 'tasks', onUpdate: useCallback(() => fetchTasks(), []) },
    { table: 'assignments', onUpdate: useCallback(() => fetchAssignments(), []) },
  ]);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('start_date');

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      toast.error('Failed to load tasks');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          *,
          worker:workers(*)
        `);

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error('Failed to load assignments:', error);
    }
  };

  const handleSaveTask = async (taskData: Partial<Task>) => {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    try {
      if (editingTask) {
        // Update existing task with modified_by and modified_at
        const { error } = await supabase
          .from('tasks')
          .update({
            ...taskData,
            modified_by: user.id,
            modified_at: new Date().toISOString()
          })
          .eq('id', editingTask.id);

        if (error) throw error;
        toast.success('Task updated successfully');
      } else {
        // Create new task with required fields
        const { error } = await supabase
          .from('tasks')
          .insert([{
            ...taskData,
            org_id: '550e8400-e29b-41d4-a716-446655440000',
            created_by: user.id
          }]);

        if (error) throw error;
        toast.success('Task created successfully');
      }

      fetchTasks();
      setIsModalOpen(false);
      setEditingTask(null);
    } catch (error) {
      toast.error('Failed to save task');
      console.error(error);
    }
  };

  const handleSaveDraft = async (draftData: Partial<TaskDraft>) => {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    try {
      // Save to task_drafts table
      const { error } = await supabase
        .from('task_drafts')
        .insert([{
          ...draftData,
          org_id: '550e8400-e29b-41d4-a716-446655440000',
          created_by: user.id
        }]);

      if (error) throw error;
      toast.success('Draft saved successfully');
      
      setIsModalOpen(false);
    } catch (error) {
      toast.error('Failed to save draft');
      console.error(error);
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      toast.success('Task deleted successfully');
      fetchTasks();
    } catch (error) {
      toast.error('Failed to delete task');
      console.error(error);
    }
  };

  // Group tasks by week (next 4 weeks)
  const groupedTasks = () => {
    const weeks = [];
    const today = new Date();
    
    for (let i = 0; i < 4; i++) {
      const weekStart = startOfWeek(addWeeks(today, i), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(addWeeks(today, i), { weekStartsOn: 1 });
      
      const weekTasks = tasks.filter(task => {
        // Skip tasks without dates
        if (!task.start_date || !task.end_date) return false;
        
        const taskStart = new Date(task.start_date);
        const taskEnd = new Date(task.end_date);
        return (taskStart >= weekStart && taskStart <= weekEnd) ||
               (taskEnd >= weekStart && taskEnd <= weekEnd) ||
               (taskStart <= weekStart && taskEnd >= weekEnd);
      });

      weeks.push({
        weekStart,
        weekEnd,
        label: `Week ${i + 1} (${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')})`,
        tasks: weekTasks
      });
    }
    
    return weeks;
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Tasks</h1>
          <p className="text-text-secondary">Manage project tasks and assignments</p>
        </div>

        <Button
          onClick={() => {
            setEditingTask(null);
            setIsModalOpen(true);
          }}
        >
          <Plus size={20} className="mr-2" />
          New Task
        </Button>
      </div>

      {/* Tasks by Week */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-text-secondary">Loading tasks...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedTasks().map((week, index) => (
            <div key={index}>
              <h2 className="text-xl font-bold mb-4">{week.label}</h2>
              {week.tasks.length === 0 ? (
                <div className="text-center py-8 bg-bg-secondary border border-border rounded-lg">
                  <p className="text-text-secondary">No tasks scheduled for this week</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {week.tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      assignments={assignments}
                      onEdit={handleEditTask}
                      onDelete={handleDeleteTask}
                      onAssign={(task: Task) => setAssigningTask(task)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Assignment Modal */}
      <AssignmentModal
        task={assigningTask}
        isOpen={!!assigningTask}
        onClose={() => setAssigningTask(null)}
        onUpdate={() => {
          fetchTasks();
          fetchAssignments();
        }}
      />

      {/* Task Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
        }}
        title={editingTask ? 'Edit Task' : 'Create New Task'}
      >
        <TaskForm
          task={editingTask}
          draft={null}
          onSave={handleSaveTask}
          onSaveDraft={handleSaveDraft}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingTask(null);
          }}
        />
      </Modal>
    </div>
  );
}
