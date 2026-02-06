import { useState, useEffect, useCallback } from 'react';
import { Plus, Upload, Search, ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useRealtimeSubscriptions } from '../../lib/hooks/useRealtime';
import { useAuth, useJobSite } from '../../contexts';
import { Button } from '../../components/ui/Button';
import { TaskCard } from '../../components/tasks/TaskCard';
import { TaskForm } from '../../components/tasks/TaskForm';
import { TaskCSVUpload } from '../../components/tasks/TaskCSVUpload';
import { AssignmentModal } from '../../components/assignments/AssignmentModal';
import { Modal } from '../../components/ui/Modal';
import type { Task, Assignment, TaskDraft } from '../../types';
import { toast } from 'sonner';
import { format, addWeeks, startOfWeek, endOfWeek } from 'date-fns';

export function Tasks() {
  const { user } = useAuth();
  const { currentJobSite } = useJobSite();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [drafts, setDrafts] = useState<TaskDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCSVModalOpen, setIsCSVModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [assigningTask, setAssigningTask] = useState<Task | null>(null);
  const [loadingDraft, setLoadingDraft] = useState<TaskDraft | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [unscheduledExpanded, setUnscheduledExpanded] = useState(false);
  const [draftSort, setDraftSort] = useState<{ column: 'activity_id' | 'name'; direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    if (currentJobSite && user?.org_id) {
      fetchTasks();
      fetchAssignments();
      fetchDrafts();
    }
  }, [currentJobSite?.id, user?.org_id]);

  // Enable real-time subscriptions for tasks and assignments
  useRealtimeSubscriptions([
    { table: 'tasks', onUpdate: useCallback(() => fetchTasks(), []) },
    { table: 'assignments', onUpdate: useCallback(() => fetchAssignments(), []) },
  ]);

  const fetchTasks = async () => {
    if (!currentJobSite || !user?.org_id) {
      setTasks([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('organization_id', user.org_id)
        .eq('job_site_id', currentJobSite.id)
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
    if (!currentJobSite || !user?.org_id) {
      setAssignments([]);
      return;
    }

    try {
      // Fetch assignments for tasks in the current job site
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          *,
          worker:workers(*),
          task:tasks!inner(job_site_id, organization_id)
        `)
        .eq('organization_id', user.org_id)
        .eq('task.organization_id', user.org_id)
        .eq('task.job_site_id', currentJobSite.id);

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error('Failed to load assignments:', error);
    }
  };

  const fetchDrafts = async () => {
    if (!currentJobSite) {
      setDrafts([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('task_drafts')
        .select('*')
        .eq('job_site_id', currentJobSite.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDrafts(data || []);
    } catch (error) {
      console.error('Failed to load drafts:', error);
      toast.error('Failed to load drafts');
    }
  };

  const handleSaveTask = async (taskData: Partial<Task>) => {
    // Validate user, org_id, and current job site
    if (!user?.id) {
      toast.error('User not authenticated');
      return;
    }
    if (!user.org_id) {
      toast.error('Unable to determine organization');
      return;
    }
    if (!currentJobSite) {
      toast.error('No job site selected');
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
        // Create new task with user's org_id and current job_site_id
        const { error } = await supabase
          .from('tasks')
          .insert([{
            ...taskData,
            organization_id: user.org_id,
            job_site_id: currentJobSite.id,
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
    // Validate user, org_id, and current job site
    if (!user?.id || !user?.org_id) {
      toast.error('User not authenticated');
      return;
    }
    if (!currentJobSite) {
      toast.error('No job site selected');
      return;
    }

    try {
      // Clean data: convert empty strings to null for date fields
      const cleanedData = {
        ...draftData,
        start_date: draftData.start_date || null,
        end_date: draftData.end_date || null,
        org_id: user.org_id,
        organization_id: user.org_id,
        job_site_id: currentJobSite.id,
        created_by: user.id
      };

      // Save to task_drafts table
      const { error } = await supabase
        .from('task_drafts')
        .insert([cleanedData]);

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

  const handleLoadDraft = (draft: TaskDraft) => {
    setLoadingDraft(draft);
    setIsModalOpen(true);
  };

  const handleDeleteDraft = async (draftId: string) => {
    if (!confirm('Are you sure you want to delete this draft?')) return;

    try {
      const { error } = await supabase
        .from('task_drafts')
        .delete()
        .eq('id', draftId);

      if (error) throw error;
      toast.success('Draft deleted successfully');
      fetchDrafts();
    } catch (error) {
      toast.error('Failed to delete draft');
      console.error(error);
    }
  };

  const handleCSVImport = async (csvRows: Array<{activityId: string, activityName: string, duration: string, taskName: string}>) => {
    // Validate user, org_id, and current job site
    if (!user?.id || !user?.org_id) {
      toast.error('User not authenticated');
      throw new Error('User not authenticated');
    }
    if (!currentJobSite) {
      toast.error('No job site selected');
      throw new Error('No job site selected');
    }

    try {
      // Helper to parse duration string (e.g., "5 days", "5", "5d") into number of days
      const parseDuration = (durationStr: string): number | undefined => {
        if (!durationStr) return undefined;
        const match = durationStr.match(/^(\d+)/);
        return match ? parseInt(match[1], 10) : undefined;
      };

      // Create drafts array from CSV data
      const draftsToCreate = csvRows.map(row => ({
        name: row.taskName, // Combined "Activity ID - Activity Name"
        activity_id: row.activityId,
        activity_name: row.activityName,
        duration: parseDuration(row.duration),
        org_id: user.org_id, // Required field
        organization_id: user.org_id,
        job_site_id: currentJobSite.id,
        created_by: user.id,
        required_operators: 0,
        required_laborers: 0,
        required_carpenters: 0,
        required_masons: 0,
      }));

      // Bulk insert into task_drafts
      const { error } = await supabase
        .from('task_drafts')
        .insert(draftsToCreate);

      if (error) throw error;

      toast.success(`Successfully imported ${draftsToCreate.length} draft${draftsToCreate.length !== 1 ? 's' : ''}`);
      fetchDrafts();
      setIsCSVModalOpen(false);
    } catch (error) {
      console.error('Failed to import tasks from CSV:', error);
      toast.error('Failed to import tasks');
      throw error;
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

        // Apply search filter
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const matchesSearch =
            task.name.toLowerCase().includes(query) ||
            task.activity_id?.toLowerCase().includes(query) ||
            task.location?.toLowerCase().includes(query);
          if (!matchesSearch) return false;
        }

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Tasks</h1>
          <p className="text-text-secondary">Manage project tasks and assignments</p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => setIsCSVModalOpen(true)}
          >
            <Upload size={20} className="mr-2" />
            Upload CSV
          </Button>
          <Button
            onClick={() => {
              setEditingTask(null);
              setLoadingDraft(null);
              setIsModalOpen(true);
            }}
          >
            <Plus size={20} className="mr-2" />
            New Task
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          type="text"
          placeholder="Search tasks by name, activity ID, or location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-bg-secondary border border-border rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      {/* Tasks by Week */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-text-secondary">Loading tasks...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Task Drafts (Unscheduled) */}
          {(() => {
            const filteredDrafts = drafts
              .filter(draft => {
                if (!searchQuery.trim()) return true;
                const query = searchQuery.toLowerCase();
                return (
                  draft.name.toLowerCase().includes(query) ||
                  draft.activity_id?.toLowerCase().includes(query) ||
                  draft.location?.toLowerCase().includes(query)
                );
              })
              .sort((a, b) => {
                if (!draftSort) return 0;
                const { column, direction } = draftSort;
                const aVal = (a[column] || '').toLowerCase();
                const bVal = (b[column] || '').toLowerCase();
                const cmp = aVal.localeCompare(bVal);
                return direction === 'asc' ? cmp : -cmp;
              });

            const handleSort = (column: 'activity_id' | 'name') => {
              setDraftSort(prev => {
                if (prev?.column === column) {
                  return prev.direction === 'asc'
                    ? { column, direction: 'desc' }
                    : null;
                }
                return { column, direction: 'asc' };
              });
            };

            const SortIcon = ({ column }: { column: 'activity_id' | 'name' }) => {
              if (draftSort?.column !== column) return <ArrowUpDown size={14} className="ml-1 opacity-50" />;
              return draftSort.direction === 'asc'
                ? <ArrowUp size={14} className="ml-1" />
                : <ArrowDown size={14} className="ml-1" />;
            };
            if (drafts.length === 0) return null;
            return (
              <div className="mb-8 border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setUnscheduledExpanded(!unscheduledExpanded)}
                  className="w-full flex items-center justify-between p-4 bg-bg-secondary hover:bg-bg-hover transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {unscheduledExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    <h2 className="text-xl font-bold">Task Drafts</h2>
                    <span className="text-text-secondary">
                      ({searchQuery ? `${filteredDrafts.length} of ${drafts.length}` : drafts.length})
                    </span>
                  </div>
                  <span className="text-sm text-text-secondary">Click to {unscheduledExpanded ? 'collapse' : 'expand'}</span>
                </button>
                {unscheduledExpanded && (
                  <div className="max-h-96 overflow-y-auto overflow-x-auto">
                    <table className="w-full table-fixed min-w-[800px]">
                      <thead className="bg-bg-tertiary sticky top-0 z-10">
                        <tr>
                          <th
                            className="w-28 px-4 py-3 text-left text-sm font-medium text-text-primary cursor-pointer hover:bg-bg-hover select-none"
                            onClick={() => handleSort('activity_id')}
                          >
                            <span className="flex items-center">
                              Activity ID
                              <SortIcon column="activity_id" />
                            </span>
                          </th>
                          <th
                            className="px-4 py-3 text-left text-sm font-medium text-text-primary cursor-pointer hover:bg-bg-hover select-none"
                            onClick={() => handleSort('name')}
                          >
                            <span className="flex items-center">
                              Name
                              <SortIcon column="name" />
                            </span>
                          </th>
                          <th className="w-24 px-4 py-3 text-left text-sm font-medium text-text-primary">Duration</th>
                          <th className="w-28 px-4 py-3 text-right text-sm font-medium text-text-primary">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredDrafts.map((draft) => (
                          <tr key={draft.id} className="hover:bg-bg-hover">
                            <td className="w-28 px-4 py-3 text-sm text-text-secondary font-mono truncate">
                              {draft.activity_id || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-text-primary truncate" title={draft.name}>
                              {draft.name}
                            </td>
                            <td className="w-24 px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
                              {draft.duration ? `${draft.duration}d` : '-'}
                            </td>
                            <td className="w-28 px-4 py-3 text-sm text-right whitespace-nowrap">
                              <button
                                onClick={() => handleLoadDraft(draft)}
                                className="text-primary hover:text-primary/80 mr-3"
                              >
                                Schedule
                              </button>
                              <button
                                onClick={() => handleDeleteDraft(draft.id)}
                                className="text-error hover:text-error/80"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredDrafts.length === 0 && searchQuery && (
                      <div className="text-center py-8 text-text-secondary">
                        No drafts match "{searchQuery}"
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

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
          setLoadingDraft(null);
        }}
        title={editingTask ? 'Edit Task' : loadingDraft ? 'Create Task from Draft' : 'Create New Task'}
      >
        <TaskForm
          task={editingTask}
          draft={loadingDraft}
          onSave={handleSaveTask}
          onSaveDraft={handleSaveDraft}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingTask(null);
            setLoadingDraft(null);
          }}
        />
      </Modal>

      {/* CSV Upload Modal */}
      <Modal
        isOpen={isCSVModalOpen}
        onClose={() => setIsCSVModalOpen(false)}
        title="Upload Tasks from CSV"
      >
        <TaskCSVUpload
          onImport={handleCSVImport}
          onCancel={() => setIsCSVModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
