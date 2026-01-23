import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import type { Task, Assignment, TaskHistory, User } from '../../types';
import { format, parseISO } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

interface TaskDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  assignments: Assignment[];
  onEdit?: () => void;
  onDelete?: () => void;
}

export function TaskDetailsModal({
  isOpen,
  onClose,
  task,
  assignments,
  onEdit,
  onDelete,
}: TaskDetailsModalProps) {
  const [history, setHistory] = useState<TaskHistory[]>([]);
  const [createdByUser, setCreatedByUser] = useState<User | null>(null);
  const [modifiedByUser, setModifiedByUser] = useState<User | null>(null);

  useEffect(() => {
    if (isOpen && task.id) {
      fetchTaskDetails();
    }
  }, [isOpen, task.id]);

  const fetchTaskDetails = async () => {
    try {
      // Fetch task history
      const { data: historyData, error: historyError } = await supabase
        .from('task_history')
        .select('*, user:users(*)')
        .eq('task_id', task.id)
        .order('performed_at', { ascending: false });

      if (historyError) throw historyError;
      setHistory(historyData || []);

      // Fetch created by user
      if (task.created_by) {
        const { data: createdUser } = await supabase
          .from('users')
          .select('*')
          .eq('id', task.created_by)
          .single();
        setCreatedByUser(createdUser);
      }

      // Fetch modified by user
      if (task.modified_by) {
        const { data: modifiedUser } = await supabase
          .from('users')
          .select('*')
          .eq('id', task.modified_by)
          .single();
        setModifiedByUser(modifiedUser);
      }
    } catch (error) {
      console.error('Error fetching task details:', error);
      toast.error('Failed to load task details');
    }
  };

  const taskAssignments = assignments.filter(a => a.task_id === task.id);
  
  // Group workers by role - GET UNIQUE WORKERS ONLY
  // If a worker is assigned for multiple days, only show them once
  const getUniqueWorkersByRole = (role: string) => {
    const workerMap = new Map();
    taskAssignments
      .filter(a => a.worker?.role === role)
      .forEach(a => {
        if (a.worker && !workerMap.has(a.worker.id)) {
          workerMap.set(a.worker.id, a);
        }
      });
    return Array.from(workerMap.values());
  };
  
  const operators = getUniqueWorkersByRole('operator');
  const laborers = getUniqueWorkersByRole('laborer');
  const carpenters = getUniqueWorkersByRole('carpenter');
  const masons = getUniqueWorkersByRole('mason');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Task Details" size="lg">
      <div className="space-y-6">
        {/* Task Info */}
        <div>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-2xl font-bold">{task.name}</h3>
              {task.location && (
                <p className="text-text-secondary flex items-center gap-2 mt-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {task.location}
                </p>
              )}
            </div>
            <Badge
              variant={
                task.status === 'completed'
                  ? 'success'
                  : task.status === 'active'
                  ? 'info'
                  : 'default'
              }
            >
              {task.status}
            </Badge>
          </div>

          {/* Activity Info & Dates */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-bg-primary rounded-lg border border-border">
            {task.activity_id && (
              <div>
                <p className="text-sm text-text-secondary mb-1">Activity ID</p>
                <p className="font-medium">{task.activity_id}</p>
              </div>
            )}
            {task.duration && (
              <div>
                <p className="text-sm text-text-secondary mb-1">Duration</p>
                <p className="font-medium">{task.duration} day{task.duration !== 1 ? 's' : ''}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-text-secondary mb-1">Start Date</p>
              <p className="font-medium">
                {task.start_date ? format(parseISO(task.start_date), 'MMM d, yyyy') : 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-sm text-text-secondary mb-1">End Date</p>
              <p className="font-medium">
                {task.end_date ? format(parseISO(task.end_date), 'MMM d, yyyy') : 'Not set'}
              </p>
            </div>
          </div>
        </div>

        {/* Assigned Workers */}
        <div>
          <h4 className="font-semibold mb-3">Assigned Workers</h4>
          <div className="space-y-4">
            {/* Operators */}
            <div className="p-4 bg-bg-primary rounded-lg border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Operators</span>
                <Badge variant={operators.length >= task.required_operators ? 'success' : 'warning'}>
                  {operators.length}/{task.required_operators}
                </Badge>
              </div>
              {operators.length > 0 ? (
                <div className="space-y-1">
                  {operators.map(assignment => (
                    <div key={assignment.id} className="text-sm flex items-center gap-2">
                      <svg className="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>{assignment.worker?.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-secondary italic">No operators assigned</p>
              )}
            </div>

            {/* Laborers */}
            <div className="p-4 bg-bg-primary rounded-lg border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Laborers</span>
                <Badge variant={laborers.length >= task.required_laborers ? 'success' : 'warning'}>
                  {laborers.length}/{task.required_laborers}
                </Badge>
              </div>
              {laborers.length > 0 ? (
                <div className="space-y-1">
                  {laborers.map(assignment => (
                    <div key={assignment.id} className="text-sm flex items-center gap-2">
                      <svg className="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>{assignment.worker?.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-secondary italic">No laborers assigned</p>
              )}
            </div>

            {/* Carpenters (if any) */}
            {(carpenters.length > 0 || (task.required_carpenters && task.required_carpenters > 0)) && (
              <div className="p-4 bg-bg-primary rounded-lg border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Carpenters</span>
                  <Badge variant={carpenters.length >= (task.required_carpenters || 0) ? 'success' : 'warning'}>
                    {carpenters.length}/{task.required_carpenters || 0}
                  </Badge>
                </div>
                {carpenters.length > 0 ? (
                  <div className="space-y-1">
                    {carpenters.map(assignment => (
                      <div key={assignment.id} className="text-sm flex items-center gap-2">
                        <svg className="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span>{assignment.worker?.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary italic">No carpenters assigned</p>
                )}
              </div>
            )}

            {/* Masons (if any) */}
            {(masons.length > 0 || (task.required_masons && task.required_masons > 0)) && (
              <div className="p-4 bg-bg-primary rounded-lg border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Masons</span>
                  <Badge variant={masons.length >= (task.required_masons || 0) ? 'success' : 'warning'}>
                    {masons.length}/{task.required_masons || 0}
                  </Badge>
                </div>
                {masons.length > 0 ? (
                  <div className="space-y-1">
                    {masons.map(assignment => (
                      <div key={assignment.id} className="text-sm flex items-center gap-2">
                        <svg className="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span>{assignment.worker?.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary italic">No masons assigned</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Task Attribution */}
        <div>
          <h4 className="font-semibold mb-3">Task Attribution</h4>
          <div className="space-y-3 p-4 bg-bg-primary rounded-lg border border-border">
            <div>
              <p className="text-sm text-text-secondary mb-1">Created By</p>
              <p className="font-medium">
                {createdByUser?.name || 'Unknown'} •{' '}
                <span className="text-text-secondary font-normal">
                  {format(parseISO(task.created_at), 'MMM d, yyyy h:mm a')}
                </span>
              </p>
            </div>
            {task.modified_by && task.modified_at && (
              <div>
                <p className="text-sm text-text-secondary mb-1">Last Modified By</p>
                <p className="font-medium">
                  {modifiedByUser?.name || 'Unknown'} •{' '}
                  <span className="text-text-secondary font-normal">
                    {format(parseISO(task.modified_at), 'MMM d, yyyy h:mm a')}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Task History */}
        {history.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3">Task History</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {history.map(entry => (
                <div
                  key={entry.id}
                  className="p-3 bg-bg-primary rounded-lg border border-border text-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Badge
                        variant={
                          entry.action === 'completed'
                            ? 'success'
                            : entry.action === 'created'
                            ? 'info'
                            : 'default'
                        }
                        className="mb-2"
                      >
                        {entry.action}
                      </Badge>
                      {entry.action === 'completed' && (
                        <p className="text-text-secondary">
                          Marked as complete by <span className="font-medium">{entry.user?.name || 'Unknown'}</span>
                        </p>
                      )}
                      {entry.action === 'created' && (
                        <p className="text-text-secondary">
                          Task created by <span className="font-medium">{entry.user?.name || 'Unknown'}</span>
                        </p>
                      )}
                      {entry.action === 'modified' && (
                        <p className="text-text-secondary">
                          Modified by <span className="font-medium">{entry.user?.name || 'Unknown'}</span>
                          {entry.previous_status && entry.new_status && (
                            <span> • Status: {entry.previous_status} → {entry.new_status}</span>
                          )}
                        </p>
                      )}
                      {entry.notes && (
                        <p className="text-text-secondary mt-1 italic">{entry.notes}</p>
                      )}
                    </div>
                    <span className="text-xs text-text-secondary whitespace-nowrap ml-4">
                      {format(parseISO(entry.performed_at), 'MMM d, h:mm a')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {task.notes && (
          <div>
            <h4 className="font-semibold mb-2">Notes</h4>
            <p className="text-text-secondary p-4 bg-bg-primary rounded-lg border border-border">
              {task.notes}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-border">
          {onEdit && (
            <Button onClick={onEdit} className="flex-1">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Task
            </Button>
          )}
          {onDelete && (
            <Button onClick={onDelete} variant="danger" className="flex-1">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Task
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
