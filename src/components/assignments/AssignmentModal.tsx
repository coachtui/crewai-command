import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Users, Plus, X } from 'lucide-react';
import type { Task, Worker, Assignment } from '../../types';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { getDatesInRange } from '../../lib/utils';

interface AssignmentModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function AssignmentModal({ task, isOpen, onClose, onUpdate }: AssignmentModalProps) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [showWorkerPicker, setShowWorkerPicker] = useState<'operator' | 'laborer' | null>(null);

  useEffect(() => {
    if (task && isOpen) {
      fetchData();
    }
  }, [task, isOpen]);

  const fetchData = async () => {
    if (!task) return;
    
    setLoading(true);
    try {
      const [workersData, assignmentsData] = await Promise.all([
        supabase.from('workers').select('*').eq('status', 'active').order('name'),
        supabase.from('assignments').select(`*, worker:workers(*)`).eq('task_id', task.id),
      ]);

      if (workersData.error) throw workersData.error;
      if (assignmentsData.error) throw assignmentsData.error;

      setWorkers(workersData.data || []);
      setAssignments(assignmentsData.data || []);
    } catch (error) {
      toast.error('Failed to load data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignWorker = async (workerId: string) => {
    if (!task) return;

    // Can't assign workers without dates
    if (!task.start_date || !task.end_date) {
      toast.error('Please set task dates before assigning workers');
      return;
    }

    try {
      // Get all dates in task range
      const dates = getDatesInRange(task.start_date, task.end_date);
      
      // Check for conflicts
      const { data: existingAssignments, error: checkError } = await supabase
        .from('assignments')
        .select('*')
        .eq('worker_id', workerId)
        .in('assigned_date', dates);

      if (checkError) throw checkError;

      if (existingAssignments && existingAssignments.length > 0) {
        toast.error('Worker is already assigned to another task on these dates');
        return;
      }

      // Create assignments for all dates
      const newAssignments = dates.map(date => ({
        task_id: task.id,
        worker_id: workerId,
        assigned_date: date,
        status: 'assigned',
        org_id: '550e8400-e29b-41d4-a716-446655440000'
      }));

      const { error } = await supabase
        .from('assignments')
        .insert(newAssignments);

      if (error) throw error;

      toast.success('Worker assigned successfully');
      fetchData();
      onUpdate();
      setShowWorkerPicker(null);
    } catch (error) {
      toast.error('Failed to assign worker');
      console.error(error);
    }
  };

  const handleUnassignWorker = async (workerId: string) => {
    if (!task) return;
    if (!confirm('Remove this worker from the task?')) return;

    try {
      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('task_id', task.id)
        .eq('worker_id', workerId);

      if (error) throw error;

      toast.success('Worker removed');
      fetchData();
      onUpdate();
    } catch (error) {
      toast.error('Failed to remove worker');
      console.error(error);
    }
  };

  if (!task) return null;

  // Get unique assigned workers by role
  const assignedOperators = assignments
    .filter(a => a.worker?.role === 'operator')
    .reduce((acc, curr) => {
      if (!acc.find(w => w.worker?.id === curr.worker?.id)) {
        acc.push(curr);
      }
      return acc;
    }, [] as Assignment[]);

  const assignedLaborers = assignments
    .filter(a => a.worker?.role === 'laborer')
    .reduce((acc, curr) => {
      if (!acc.find(w => w.worker?.id === curr.worker?.id)) {
        acc.push(curr);
      }
      return acc;
    }, [] as Assignment[]);

  // Get available workers (not already assigned)
  const assignedWorkerIds = new Set(assignments.map(a => a.worker_id));
  const availableOperators = workers.filter(
    w => w.role === 'operator' && !assignedWorkerIds.has(w.id)
  );
  const availableLaborers = workers.filter(
    w => w.role === 'laborer' && !assignedWorkerIds.has(w.id)
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Assign Workers - ${task.name}`} size="lg">
      {loading ? (
        <div className="text-center py-8">
          <p className="text-text-secondary">Loading...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Task Info */}
          <div className="p-4 bg-bg-primary border border-border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Task Details</h3>
              <Badge variant={task.status === 'completed' ? 'success' : task.status === 'active' ? 'info' : 'default'}>
                {task.status}
              </Badge>
            </div>
            {task.location && <p className="text-sm text-text-secondary mb-1">📍 {task.location}</p>}
            {task.start_date && task.end_date ? (
              <p className="text-sm text-text-secondary">
                📅 {new Date(task.start_date).toLocaleDateString()} - {new Date(task.end_date).toLocaleDateString()}
              </p>
            ) : (
              <p className="text-sm text-text-secondary italic">
                ⚠️ No dates set - add dates before assigning workers
              </p>
            )}
          </div>

          {/* Operators Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users size={20} className="text-info" />
                <h3 className="font-semibold">Operators</h3>
                <Badge variant={assignedOperators.length >= task.required_operators ? 'success' : 'warning'}>
                  {assignedOperators.length} / {task.required_operators}
                </Badge>
              </div>
              <Button
                size="sm"
                onClick={() => setShowWorkerPicker('operator')}
                disabled={assignedOperators.length >= task.required_operators}
              >
                <Plus size={16} className="mr-1" />
                Add
              </Button>
            </div>

            {assignedOperators.length === 0 ? (
              <p className="text-sm text-text-secondary italic">No operators assigned</p>
            ) : (
              <div className="space-y-2">
                {assignedOperators.map((assignment) => (
                  <div
                    key={assignment.worker?.id}
                    className="flex items-center justify-between p-3 bg-bg-primary border border-border rounded-lg"
                  >
                    <span className="font-medium">{assignment.worker?.name}</span>
                    <button
                      onClick={() => handleUnassignWorker(assignment.worker?.id || '')}
                      className="p-1 hover:bg-bg-hover rounded transition-colors"
                    >
                      <X size={16} className="text-error" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Worker Picker for Operators */}
            {showWorkerPicker === 'operator' && (
              <div className="mt-3 p-3 bg-bg-primary border border-primary rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-sm">Select Operator</h4>
                  <button onClick={() => setShowWorkerPicker(null)} className="text-text-secondary hover:text-text-primary">
                    <X size={16} />
                  </button>
                </div>
                {availableOperators.length === 0 ? (
                  <p className="text-sm text-text-secondary italic">No available operators</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {availableOperators.map((worker) => (
                      <button
                        key={worker.id}
                        onClick={() => handleAssignWorker(worker.id)}
                        className="w-full text-left px-3 py-2 hover:bg-bg-hover rounded transition-colors"
                      >
                        {worker.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Laborers Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users size={20} className="text-warning" />
                <h3 className="font-semibold">Laborers</h3>
                <Badge variant={assignedLaborers.length >= task.required_laborers ? 'success' : 'warning'}>
                  {assignedLaborers.length} / {task.required_laborers}
                </Badge>
              </div>
              <Button
                size="sm"
                onClick={() => setShowWorkerPicker('laborer')}
                disabled={assignedLaborers.length >= task.required_laborers}
              >
                <Plus size={16} className="mr-1" />
                Add
              </Button>
            </div>

            {assignedLaborers.length === 0 ? (
              <p className="text-sm text-text-secondary italic">No laborers assigned</p>
            ) : (
              <div className="space-y-2">
                {assignedLaborers.map((assignment) => (
                  <div
                    key={assignment.worker?.id}
                    className="flex items-center justify-between p-3 bg-bg-primary border border-border rounded-lg"
                  >
                    <span className="font-medium">{assignment.worker?.name}</span>
                    <button
                      onClick={() => handleUnassignWorker(assignment.worker?.id || '')}
                      className="p-1 hover:bg-bg-hover rounded transition-colors"
                    >
                      <X size={16} className="text-error" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Worker Picker for Laborers */}
            {showWorkerPicker === 'laborer' && (
              <div className="mt-3 p-3 bg-bg-primary border border-primary rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-sm">Select Laborer</h4>
                  <button onClick={() => setShowWorkerPicker(null)} className="text-text-secondary hover:text-text-primary">
                    <X size={16} />
                  </button>
                </div>
                {availableLaborers.length === 0 ? (
                  <p className="text-sm text-text-secondary italic">No available laborers</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {availableLaborers.map((worker) => (
                      <button
                        key={worker.id}
                        onClick={() => handleAssignWorker(worker.id)}
                        className="w-full text-left px-3 py-2 hover:bg-bg-hover rounded transition-colors"
                      >
                        {worker.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <Button variant="secondary" onClick={onClose} className="w-full">
            Done
          </Button>
        </div>
      )}
    </Modal>
  );
}
