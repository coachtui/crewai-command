import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Upload, Search, ChevronDown, ChevronRight,
  ArrowUpDown, ArrowUp, ArrowDown, List, LayoutGrid,
  MapPin, Calendar, Edit2, Trash2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useRealtimeSubscriptions } from '../../lib/hooks/useRealtime';
import { useAuth, useJobSite } from '../../contexts';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { TaskCard } from '../../components/tasks/TaskCard';
import { TaskForm } from '../../components/tasks/TaskForm';
import { TaskCSVUpload } from '../../components/tasks/TaskCSVUpload';
import { AssignmentModal } from '../../components/assignments/AssignmentModal';
import { Modal } from '../../components/ui/Modal';
import { ListContainer } from '../../components/ui/ListContainer';
import type { Task, Assignment, TaskDraft } from '../../types';
import { toast } from 'sonner';
import { format, addWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { formatDate } from '../../lib/utils';

type ViewMode = 'list' | 'board';
type FilterOption = 'this_week' | 'next_week' | 'all' | 'on_hold';

// Board columns — "On Hold" column is present but empty until a DB status field is added
// TODO: Add 'on_hold' to TaskStatus enum and DB once migrated
const BOARD_COLUMNS: { key: string; label: string; statuses: string[] }[] = [
  { key: 'planned',   label: 'Not Started', statuses: ['planned'] },
  { key: 'active',    label: 'In Progress',  statuses: ['active'] },
  { key: 'on_hold',   label: 'On Hold',      statuses: [] },       // TODO: add 'on_hold' status to DB
  { key: 'completed', label: 'Complete',     statuses: ['completed'] },
];

// ─── Board task card ────────────────────────────────────────────────────────
function BoardTaskCard({
  task,
  assignments,
  onEdit,
  onDelete,
}: {
  task: Task;
  assignments: Assignment[];
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
}) {
  const taskAssignments = assignments.filter(a => a.task_id === task.id);

  const assignedOperators = [...new Set(
    taskAssignments.filter(a => a.worker?.role === 'operator').map(a => a.worker?.id)
  )].length;
  const assignedLaborers = [...new Set(
    taskAssignments.filter(a => a.worker?.role === 'laborer').map(a => a.worker?.id)
  )].length;

  // Strip "ON HOLD" prefix from display name
  const displayName = task.name.replace(/^\*{0,2}\s*ON HOLD\s*\*{0,2}\s*[-–]?\s*/i, '').trim();

  const getCountClass = (assigned: number, required: number) => {
    if (required === 0) return 'text-text-secondary';
    if (assigned >= required) return 'text-status-complete';
    return 'text-warning';
  };

  return (
    <div className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[13px] font-semibold text-text-primary leading-snug flex-1 min-w-0">
          {displayName}
        </p>
        <div className="flex gap-0.5 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(task); }}
            className="p-1 hover:bg-bg-hover rounded transition-colors"
            title="Edit"
          >
            <Edit2 size={13} className="text-text-secondary" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
            className="p-1 hover:bg-bg-hover rounded transition-colors"
            title="Delete"
          >
            <Trash2 size={13} className="text-error" />
          </button>
        </div>
      </div>

      {task.location && (
        <div className="flex items-center gap-1 text-[12px] text-text-secondary mb-1">
          <MapPin size={11} />
          <span className="truncate">{task.location}</span>
        </div>
      )}
      {task.start_date && task.end_date && (
        <div className="flex items-center gap-1 text-[12px] text-text-secondary mb-2">
          <Calendar size={11} />
          <span>{formatDate(task.start_date)} – {formatDate(task.end_date)}</span>
        </div>
      )}

      <div className="flex gap-3 text-[12px]">
        <span>
          <span className="text-text-secondary">Ops: </span>
          <span className={`font-medium ${getCountClass(assignedOperators, task.required_operators)}`}>
            {assignedOperators}/{task.required_operators}
          </span>
        </span>
        <span>
          <span className="text-text-secondary">Lab: </span>
          <span className={`font-medium ${getCountClass(assignedLaborers, task.required_laborers)}`}>
            {assignedLaborers}/{task.required_laborers}
          </span>
        </span>
      </div>
    </div>
  );
}

// ─── Main Tasks page ────────────────────────────────────────────────────────
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

  // View mode — persisted in localStorage
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try { return (localStorage.getItem('tasksViewMode') as ViewMode) || 'list'; } catch { return 'list'; }
  });

  // Active time filter
  const [activeFilter, setActiveFilter] = useState<FilterOption>('this_week');

  // Which week sections are expanded (keyed by weekStart 'yyyy-MM-dd')
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(() => {
    const key = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    return new Set([key]);
  });

  useEffect(() => {
    if (currentJobSite && user?.org_id) {
      fetchTasks();
      fetchAssignments();
      fetchDrafts();
    }
  }, [currentJobSite?.id, user?.org_id]);

  // When filter changes, reset expanded weeks to the newly visible week
  useEffect(() => {
    const today = new Date();
    if (activeFilter === 'next_week') {
      const key = format(startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      setExpandedWeeks(new Set([key]));
    } else {
      const key = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      setExpandedWeeks(new Set([key]));
    }
  }, [activeFilter]);

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
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          *,
          worker:workers(*, crew:crews(id, name, color)),
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
    if (!user?.id) { toast.error('User not authenticated'); return; }
    if (!user.org_id) { toast.error('Unable to determine organization'); return; }
    if (!currentJobSite) { toast.error('No job site selected'); return; }

    try {
      if (editingTask) {
        const { error } = await supabase
          .from('tasks')
          .update({ ...taskData, modified_by: user.id, modified_at: new Date().toISOString() })
          .eq('id', editingTask.id);
        if (error) throw error;
        toast.success('Task updated successfully');
      } else {
        const { error } = await supabase
          .from('tasks')
          .insert([{ ...taskData, organization_id: user.org_id, job_site_id: currentJobSite.id, created_by: user.id }]);
        if (error) throw error;
        toast.success('Task created successfully');

        if (loadingDraft) {
          await supabase.from('task_drafts').delete().eq('id', loadingDraft.id);
          fetchDrafts();
        }
      }

      fetchTasks();
      setIsModalOpen(false);
      setEditingTask(null);
      setLoadingDraft(null);
    } catch (error) {
      toast.error('Failed to save task');
      console.error(error);
    }
  };

  const handleSaveDraft = async (draftData: Partial<TaskDraft>) => {
    if (!user?.id || !user?.org_id) { toast.error('User not authenticated'); return; }
    if (!currentJobSite) { toast.error('No job site selected'); return; }

    try {
      const cleanedData = {
        ...draftData,
        start_date: draftData.start_date || null,
        end_date: draftData.end_date || null,
        org_id: user.org_id,
        organization_id: user.org_id,
        job_site_id: currentJobSite.id,
        created_by: user.id,
      };
      const { error } = await supabase.from('task_drafts').insert([cleanedData]);
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
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
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
      const { error } = await supabase.from('task_drafts').delete().eq('id', draftId);
      if (error) throw error;
      toast.success('Draft deleted successfully');
      fetchDrafts();
    } catch (error) {
      toast.error('Failed to delete draft');
      console.error(error);
    }
  };

  const handleCSVImport = async (csvRows: Array<{activityId: string; activityName: string; duration: string; taskName: string}>) => {
    if (!user?.id || !user?.org_id) { toast.error('User not authenticated'); throw new Error('User not authenticated'); }
    if (!currentJobSite) { toast.error('No job site selected'); throw new Error('No job site selected'); }

    try {
      const parseDuration = (durationStr: string): number | undefined => {
        if (!durationStr) return undefined;
        const match = durationStr.match(/^(\d+)/);
        return match ? parseInt(match[1], 10) : undefined;
      };

      const draftsToCreate = csvRows.map(row => ({
        name: row.taskName,
        activity_id: row.activityId,
        activity_name: row.activityName,
        duration: parseDuration(row.duration),
        org_id: user.org_id,
        organization_id: user.org_id,
        job_site_id: currentJobSite.id,
        created_by: user.id,
        required_operators: 0,
        required_laborers: 0,
        required_carpenters: 0,
        required_masons: 0,
      }));

      const { error } = await supabase.from('task_drafts').insert(draftsToCreate);
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

  // ─── Filtering & grouping ──────────────────────────────────────────────────

  const taskOverlapsRange = (task: Task, rangeStart: Date, rangeEnd: Date): boolean => {
    if (!task.start_date || !task.end_date) return false;
    const taskStart = new Date(task.start_date);
    const taskEnd = new Date(task.end_date);
    return (
      (taskStart >= rangeStart && taskStart <= rangeEnd) ||
      (taskEnd >= rangeStart && taskEnd <= rangeEnd) ||
      (taskStart <= rangeStart && taskEnd >= rangeEnd)
    );
  };

  const getFilteredTasks = (): Task[] => {
    const today = new Date();

    return tasks.filter(task => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matches =
          task.name.toLowerCase().includes(query) ||
          task.activity_id?.toLowerCase().includes(query) ||
          task.location?.toLowerCase().includes(query);
        if (!matches) return false;
      }

      if (activeFilter === 'on_hold') {
        // TODO: Migrate on_hold to a proper DB status field for tasks
        return false;
      }

      if (activeFilter === 'this_week') {
        const weekStart = startOfWeek(today, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
        return taskOverlapsRange(task, weekStart, weekEnd);
      }

      if (activeFilter === 'next_week') {
        const nextWeekStart = startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });
        const nextWeekEnd = endOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });
        return taskOverlapsRange(task, nextWeekStart, nextWeekEnd);
      }

      // 'all': no date filter
      return true;
    });
  };

  const getGroupedWeeks = () => {
    const filtered = getFilteredTasks();
    const today = new Date();

    if (activeFilter === 'this_week') {
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
      return [{
        weekStart,
        weekEnd,
        weekKey: format(weekStart, 'yyyy-MM-dd'),
        label: `This Week (${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d')})`,
        tasks: filtered,
      }];
    }

    if (activeFilter === 'next_week') {
      const weekStart = startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });
      return [{
        weekStart,
        weekEnd,
        weekKey: format(weekStart, 'yyyy-MM-dd'),
        label: `Next Week (${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d')})`,
        tasks: filtered,
      }];
    }

    if (activeFilter === 'on_hold') {
      return [];
    }

    // 'all' — 4 weeks, each filtered by date overlap
    return Array.from({ length: 4 }, (_, i) => {
      const weekStart = startOfWeek(addWeeks(today, i), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(addWeeks(today, i), { weekStartsOn: 1 });
      return {
        weekStart,
        weekEnd,
        weekKey: format(weekStart, 'yyyy-MM-dd'),
        label: `Week ${i + 1} (${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d')})`,
        tasks: filtered.filter(t => taskOverlapsRange(t, weekStart, weekEnd)),
      };
    });
  };

  const toggleWeek = (weekKey: string) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(weekKey)) { next.delete(weekKey); } else { next.add(weekKey); }
      return next;
    });
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    try { localStorage.setItem('tasksViewMode', mode); } catch { /* ignore */ }
  };

  // ─── Filter bar labels ─────────────────────────────────────────────────────
  const FILTERS: { key: FilterOption; label: string }[] = [
    { key: 'this_week', label: 'This Week' },
    { key: 'next_week', label: 'Next Week' },
    { key: 'all',       label: 'All Tasks' },
    { key: 'on_hold',   label: 'On Hold' },
  ];

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary mb-1">Tasks</h1>
          <p className="text-[14px] text-text-secondary">Manage project tasks and assignments</p>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center bg-bg-secondary border border-gray-200 rounded-lg p-0.5">
            <button
              onClick={() => handleViewModeChange('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              title="List view"
            >
              <List size={15} />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => handleViewModeChange('board')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                viewMode === 'board'
                  ? 'bg-white text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              title="Board view"
            >
              <LayoutGrid size={15} />
              <span className="hidden sm:inline">Board</span>
            </button>
          </div>

          <Button variant="secondary" onClick={() => setIsCSVModalOpen(true)}>
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
      <div className="relative mb-3">
        <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          type="text"
          placeholder="Search tasks by name, activity ID, or location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-bg-secondary border border-gray-200 rounded-xl text-[14px] text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
        />
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveFilter(key)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[13px] font-medium transition-all ${
              activeFilter === key
                ? 'bg-primary text-white shadow-sm'
                : 'bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
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
                  return prev.direction === 'asc' ? { column, direction: 'desc' } : null;
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
              <div className="mb-8 border border-gray-100 rounded-xl overflow-hidden shadow-sm-soft">
                <button
                  onClick={() => setUnscheduledExpanded(!unscheduledExpanded)}
                  className="w-full flex items-center justify-between p-4 bg-bg-secondary hover:bg-bg-hover transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {unscheduledExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    <h2 className="text-[15px] font-semibold text-text-primary">Task Drafts</h2>
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
                            <span className="flex items-center">Activity ID <SortIcon column="activity_id" /></span>
                          </th>
                          <th
                            className="px-4 py-3 text-left text-sm font-medium text-text-primary cursor-pointer hover:bg-bg-hover select-none"
                            onClick={() => handleSort('name')}
                          >
                            <span className="flex items-center">Name <SortIcon column="name" /></span>
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

          {/* ── LIST VIEW ── */}
          {viewMode === 'list' && (
            <>
              {activeFilter === 'on_hold' ? (
                <div className="text-center py-12 bg-bg-secondary border border-gray-100 rounded-xl">
                  <p className="text-text-secondary text-[14px]">
                    No tasks are currently on hold.
                  </p>
                  <p className="text-text-secondary text-[12px] mt-1 opacity-70">
                    {/* TODO: Add on_hold status to tasks DB table to enable this filter */}
                    On Hold status for tasks coming soon.
                  </p>
                </div>
              ) : (
                getGroupedWeeks().map((week) => {
                  const isExpanded = expandedWeeks.has(week.weekKey);
                  return (
                    <div key={week.weekKey} className="border border-gray-100 rounded-xl overflow-hidden shadow-sm-soft">
                      {/* Week header — collapsible */}
                      <button
                        onClick={() => toggleWeek(week.weekKey)}
                        className="w-full flex items-center justify-between px-5 py-4 bg-bg-secondary hover:bg-bg-hover transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded
                            ? <ChevronDown size={18} className="text-text-secondary" />
                            : <ChevronRight size={18} className="text-text-secondary" />
                          }
                          <h2 className="text-[15px] font-semibold text-text-primary">{week.label}</h2>
                          <Badge variant="default">{week.tasks.length} {week.tasks.length === 1 ? 'task' : 'tasks'}</Badge>
                        </div>
                        <span className="text-[12px] text-text-secondary hidden sm:inline">
                          {isExpanded ? 'Collapse' : 'Expand'}
                        </span>
                      </button>

                      {/* Week tasks */}
                      {isExpanded && (
                        <>
                          {week.tasks.length === 0 ? (
                            <div className="text-center py-8 bg-white">
                              <p className="text-text-secondary text-[14px]">No tasks scheduled for this week</p>
                            </div>
                          ) : (
                            <ListContainer>
                              {week.tasks.map((task) => (
                                <TaskCard
                                  key={task.id}
                                  task={task}
                                  assignments={assignments}
                                  onEdit={handleEditTask}
                                  onDelete={handleDeleteTask}
                                  onAssign={(t: Task) => setAssigningTask(t)}
                                />
                              ))}
                            </ListContainer>
                          )}
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* ── BOARD VIEW ── */}
          {viewMode === 'board' && (
            <>
              {activeFilter === 'on_hold' ? (
                <div className="text-center py-12 bg-bg-secondary border border-gray-100 rounded-xl">
                  <p className="text-text-secondary text-[14px]">On Hold status for tasks coming soon.</p>
                </div>
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
                  {BOARD_COLUMNS.map((col) => {
                    const colTasks = getFilteredTasks().filter(t => col.statuses.includes(t.status));
                    return (
                      <div
                        key={col.key}
                        className="flex-shrink-0 w-72 sm:w-80"
                      >
                        {/* Column header */}
                        <div className="flex items-center justify-between mb-3 px-1">
                          <h3 className="text-[13px] font-semibold text-text-primary uppercase tracking-wide">
                            {col.label}
                          </h3>
                          <span className="text-[12px] text-text-secondary bg-bg-secondary border border-gray-200 rounded-full px-2 py-0.5">
                            {colTasks.length}
                          </span>
                        </div>

                        {/* Task cards */}
                        <div className="space-y-2.5 min-h-[120px] bg-bg-subtle rounded-xl p-2.5">
                          {colTasks.length === 0 ? (
                            <div className="flex items-center justify-center h-20 text-[12px] text-text-secondary">
                              No tasks
                            </div>
                          ) : (
                            colTasks.map((task) => (
                              <BoardTaskCard
                                key={task.id}
                                task={task}
                                assignments={assignments}
                                onEdit={handleEditTask}
                                onDelete={handleDeleteTask}
                              />
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
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
