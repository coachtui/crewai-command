import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Users, Plus, X, ChevronDown } from 'lucide-react';
import type { Task, Worker, Assignment, Crew } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth, useJobSite } from '../../contexts';
import { toast } from 'sonner';
import { getDatesInRange } from '../../lib/utils';

interface AssignmentModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function AssignmentModal({ task, isOpen, onClose, onUpdate }: AssignmentModalProps) {
  const { user } = useAuth();
  const { currentJobSite } = useJobSite();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [crews, setCrews] = useState<Crew[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [showWorkerPicker, setShowWorkerPicker] = useState<'operator' | 'laborer' | 'mechanic' | 'driver' | null>(null);
  const [showCrewPicker, setShowCrewPicker] = useState(false);
  const [assigningCrewId, setAssigningCrewId] = useState<string | null>(null);

  useEffect(() => {
    if (task && isOpen && currentJobSite) {
      fetchData();
    }
  }, [task, isOpen, currentJobSite?.id]);

  const fetchData = async () => {
    if (!task || !currentJobSite) return;

    setLoading(true);
    try {
      const [workersData, assignmentsData, crewsData] = await Promise.all([
        supabase
          .from('workers')
          .select('*, crew:crews(id, name, color)')
          .eq('job_site_id', currentJobSite.id)
          .eq('status', 'active')
          .order('name'),
        supabase
          .from('assignments')
          .select(`*, worker:workers(*, crew:crews(id, name, color))`)
          .eq('task_id', task.id),
        supabase
          .from('crews')
          .select('*')
          .eq('job_site_id', currentJobSite.id)
          .order('name'),
      ]);

      if (workersData.error) throw workersData.error;
      if (assignmentsData.error) throw assignmentsData.error;
      if (crewsData.error) throw crewsData.error;

      let allWorkers = workersData.data || [];

      // Also include active workers temporarily assigned to this site via worker_site_assignments
      const today = new Date().toISOString().split('T')[0];
      const { data: siteAssignments } = await supabase
        .from('worker_site_assignments')
        .select('worker_id')
        .eq('job_site_id', currentJobSite.id)
        .eq('is_active', true)
        .or(`start_date.is.null,start_date.lte.${today}`)
        .or(`end_date.is.null,end_date.gte.${today}`);

      if (siteAssignments?.length) {
        const primaryIds = new Set(allWorkers.map(w => w.id));
        const extraIds = siteAssignments
          .map(a => a.worker_id)
          .filter(id => !primaryIds.has(id));

        if (extraIds.length) {
          const { data: extraWorkers } = await supabase
            .from('workers')
            .select('*, crew:crews(id, name, color)')
            .in('id', extraIds)
            .eq('status', 'active')
            .order('name');

          allWorkers = [...allWorkers, ...(extraWorkers || [])];
        }
      }

      setWorkers(allWorkers);
      setAssignments(assignmentsData.data || []);
      setCrews(crewsData.data || []);
    } catch (error) {
      toast.error('Failed to load data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignWorker = async (workerId: string) => {
    if (!task) return;

    if (!user?.org_id) {
      toast.error('Unable to determine organization');
      return;
    }

    if (!task.start_date || !task.end_date) {
      toast.error('Please set task dates before assigning workers');
      return;
    }

    try {
      const dates = getDatesInRange(task.start_date, task.end_date);

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

      const newAssignments = dates.map(date => ({
        task_id: task.id,
        worker_id: workerId,
        assigned_date: date,
        status: 'assigned',
        organization_id: user.org_id,
      }));

      const { error } = await supabase.from('assignments').insert(newAssignments);
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

  const handleAssignCrew = async (crewId: string) => {
    if (!task || !user?.org_id) return;

    if (!task.start_date || !task.end_date) {
      toast.error('Please set task dates before assigning workers');
      return;
    }

    // Get all active workers in this crew
    const crewWorkers = workers.filter(w => w.crew_id === crewId);
    if (crewWorkers.length === 0) {
      toast.error('This crew has no active workers at this job site');
      return;
    }

    const assignedWorkerIds = new Set(assignments.map(a => a.worker_id));
    const unassignedCrewMembers = crewWorkers.filter(w => !assignedWorkerIds.has(w.id));

    if (unassignedCrewMembers.length === 0) {
      toast.error('All crew members are already assigned to this task');
      return;
    }

    setAssigningCrewId(crewId);
    try {
      const dates = getDatesInRange(task.start_date, task.end_date);

      // Check conflicts for all crew members
      const workerIds = unassignedCrewMembers.map(w => w.id);
      const { data: conflicts, error: conflictError } = await supabase
        .from('assignments')
        .select('worker_id')
        .in('worker_id', workerIds)
        .in('assigned_date', dates)
        .neq('task_id', task.id);

      if (conflictError) throw conflictError;

      const conflictWorkerIds = new Set((conflicts || []).map(c => c.worker_id));
      const assignableWorkers = unassignedCrewMembers.filter(w => !conflictWorkerIds.has(w.id));
      const skipped = unassignedCrewMembers.length - assignableWorkers.length;

      if (assignableWorkers.length === 0) {
        toast.error('All crew members have conflicts on these dates');
        setAssigningCrewId(null);
        return;
      }

      // Bulk insert assignments
      const newAssignments = assignableWorkers.flatMap(worker =>
        dates.map(date => ({
          task_id: task.id,
          worker_id: worker.id,
          assigned_date: date,
          status: 'assigned',
          organization_id: user.org_id,
        }))
      );

      const { error } = await supabase.from('assignments').insert(newAssignments);
      if (error) throw error;

      const crew = crews.find(c => c.id === crewId);
      if (skipped > 0) {
        toast.success(`${assignableWorkers.length} of ${unassignedCrewMembers.length} crew members assigned (${skipped} had conflicts)`);
      } else {
        toast.success(`${crew?.name || 'Crew'} assigned — ${assignableWorkers.length} workers`);
      }

      fetchData();
      onUpdate();
      setShowCrewPicker(false);
    } catch (error) {
      toast.error('Failed to assign crew');
      console.error(error);
    } finally {
      setAssigningCrewId(null);
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

  // Deduplicate assigned workers by role
  const dedupeByWorker = (list: Assignment[]) =>
    list.reduce((acc, curr) => {
      if (!acc.find(w => w.worker?.id === curr.worker?.id)) acc.push(curr);
      return acc;
    }, [] as Assignment[]);

  const assignedOperators = dedupeByWorker(assignments.filter(a => a.worker?.role === 'operator'));
  const assignedLaborers = dedupeByWorker(assignments.filter(a => a.worker?.role === 'laborer'));
  const assignedMechanics = dedupeByWorker(assignments.filter(a => a.worker?.role === 'mechanic'));
  const assignedDrivers = dedupeByWorker(assignments.filter(a => a.worker?.role === 'driver'));

  const assignedWorkerIds = new Set(assignments.map(a => a.worker_id));
  const availableOperators = workers.filter(w => w.role === 'operator' && !assignedWorkerIds.has(w.id));
  const availableLaborers = workers.filter(w => w.role === 'laborer' && !assignedWorkerIds.has(w.id));
  const availableMechanics = workers.filter(w => w.role === 'mechanic' && !assignedWorkerIds.has(w.id));
  const availableDrivers = workers.filter(w => w.role === 'driver' && !assignedWorkerIds.has(w.id));

  // Crews that have at least one unassigned active member
  const availableCrews = crews.filter(crew => {
    const crewWorkers = workers.filter(w => w.crew_id === crew.id);
    return crewWorkers.some(w => !assignedWorkerIds.has(w.id));
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Assign Workers — ${task.name}`} size="lg">
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
                📅 {new Date(task.start_date).toLocaleDateString()} — {new Date(task.end_date).toLocaleDateString()}
              </p>
            ) : (
              <p className="text-sm text-text-secondary italic">
                ⚠️ No dates set — add dates before assigning workers
              </p>
            )}
          </div>

          {/* Add Crew — bulk assign */}
          {crews.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-text-secondary" />
                  <h3 className="font-semibold text-[15px]">Add by Crew</h3>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowCrewPicker(!showCrewPicker)}
                >
                  <Plus size={16} className="mr-1" />
                  Add Crew
                  <ChevronDown size={14} className={`ml-1 transition-transform ${showCrewPicker ? 'rotate-180' : ''}`} />
                </Button>
              </div>

              {showCrewPicker && (
                <div className="p-3 bg-bg-primary border border-primary/40 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] font-medium">Select crew to add</span>
                    <button onClick={() => setShowCrewPicker(false)}>
                      <X size={14} className="text-text-secondary" />
                    </button>
                  </div>
                  {availableCrews.length === 0 ? (
                    <p className="text-[13px] text-text-secondary italic">
                      All crew members are already assigned
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {availableCrews.map(crew => {
                        const crewSize = workers.filter(w => w.crew_id === crew.id).length;
                        const unassignedCount = workers.filter(
                          w => w.crew_id === crew.id && !assignedWorkerIds.has(w.id)
                        ).length;
                        const isAssigning = assigningCrewId === crew.id;

                        return (
                          <button
                            key={crew.id}
                            onClick={() => handleAssignCrew(crew.id)}
                            disabled={isAssigning}
                            className="w-full text-left px-3 py-2.5 hover:bg-bg-hover rounded-lg flex items-center justify-between gap-3 disabled:opacity-50"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: crew.color || '#6366f1' }}
                              />
                              <span className="text-[13px] font-medium">{crew.name}</span>
                            </div>
                            <span className="text-[12px] text-text-secondary">
                              {isAssigning ? 'Assigning...' : `${unassignedCount} of ${crewSize} available`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{assignment.worker?.name}</span>
                      {assignment.worker?.crew && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium border"
                          style={{
                            backgroundColor: (assignment.worker.crew.color || '#6366f1') + '20',
                            borderColor: (assignment.worker.crew.color || '#6366f1') + '40',
                            color: assignment.worker.crew.color || '#6366f1',
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: assignment.worker.crew.color || '#6366f1' }}
                          />
                          {assignment.worker.crew.name}
                        </span>
                      )}
                    </div>
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
                        className="w-full text-left px-3 py-2 hover:bg-bg-hover rounded transition-colors flex items-center justify-between"
                      >
                        <span>{worker.name}</span>
                        {worker.crew && (
                          <span
                            className="text-[11px] px-1.5 py-0.5 rounded-full border"
                            style={{
                              backgroundColor: (worker.crew.color || '#6366f1') + '20',
                              borderColor: (worker.crew.color || '#6366f1') + '40',
                              color: worker.crew.color || '#6366f1',
                            }}
                          >
                            {worker.crew.name}
                          </span>
                        )}
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
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{assignment.worker?.name}</span>
                      {assignment.worker?.crew && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium border"
                          style={{
                            backgroundColor: (assignment.worker.crew.color || '#6366f1') + '20',
                            borderColor: (assignment.worker.crew.color || '#6366f1') + '40',
                            color: assignment.worker.crew.color || '#6366f1',
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: assignment.worker.crew.color || '#6366f1' }}
                          />
                          {assignment.worker.crew.name}
                        </span>
                      )}
                    </div>
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
                        className="w-full text-left px-3 py-2 hover:bg-bg-hover rounded transition-colors flex items-center justify-between"
                      >
                        <span>{worker.name}</span>
                        {worker.crew && (
                          <span
                            className="text-[11px] px-1.5 py-0.5 rounded-full border"
                            style={{
                              backgroundColor: (worker.crew.color || '#6366f1') + '20',
                              borderColor: (worker.crew.color || '#6366f1') + '40',
                              color: worker.crew.color || '#6366f1',
                            }}
                          >
                            {worker.crew.name}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mechanics Section — no required-count indicator */}
          {(assignedMechanics.length > 0 || availableMechanics.length > 0) && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users size={20} className="text-text-secondary" />
                  <h3 className="font-semibold">Mechanics</h3>
                  <span className="text-[12px] text-text-secondary">{assignedMechanics.length} assigned</span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowWorkerPicker('mechanic')}
                >
                  <Plus size={16} className="mr-1" />
                  Add
                </Button>
              </div>
              {assignedMechanics.length === 0 ? (
                <p className="text-sm text-text-secondary italic">No mechanics assigned</p>
              ) : (
                <div className="space-y-2">
                  {assignedMechanics.map((assignment) => (
                    <div
                      key={assignment.worker?.id}
                      className="flex items-center justify-between p-3 bg-bg-primary border border-border rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{assignment.worker?.name}</span>
                        {assignment.worker?.crew && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium border"
                            style={{
                              backgroundColor: (assignment.worker.crew.color || '#6366f1') + '20',
                              borderColor: (assignment.worker.crew.color || '#6366f1') + '40',
                              color: assignment.worker.crew.color || '#6366f1',
                            }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: assignment.worker.crew.color || '#6366f1' }} />
                            {assignment.worker.crew.name}
                          </span>
                        )}
                      </div>
                      <button onClick={() => handleUnassignWorker(assignment.worker?.id || '')} className="p-1 hover:bg-bg-hover rounded transition-colors">
                        <X size={16} className="text-error" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {showWorkerPicker === 'mechanic' && (
                <div className="mt-3 p-3 bg-bg-primary border border-primary rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">Select Mechanic</h4>
                    <button onClick={() => setShowWorkerPicker(null)} className="text-text-secondary hover:text-text-primary"><X size={16} /></button>
                  </div>
                  {availableMechanics.length === 0 ? (
                    <p className="text-sm text-text-secondary italic">No available mechanics</p>
                  ) : (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {availableMechanics.map((worker) => (
                        <button key={worker.id} onClick={() => handleAssignWorker(worker.id)} className="w-full text-left px-3 py-2 hover:bg-bg-hover rounded transition-colors flex items-center justify-between">
                          <span>{worker.name}</span>
                          {worker.crew && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded-full border" style={{ backgroundColor: (worker.crew.color || '#6366f1') + '20', borderColor: (worker.crew.color || '#6366f1') + '40', color: worker.crew.color || '#6366f1' }}>
                              {worker.crew.name}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Drivers Section — no required-count indicator */}
          {(assignedDrivers.length > 0 || availableDrivers.length > 0) && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users size={20} className="text-text-secondary" />
                  <h3 className="font-semibold">Drivers</h3>
                  <span className="text-[12px] text-text-secondary">{assignedDrivers.length} assigned</span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowWorkerPicker('driver')}
                >
                  <Plus size={16} className="mr-1" />
                  Add
                </Button>
              </div>
              {assignedDrivers.length === 0 ? (
                <p className="text-sm text-text-secondary italic">No drivers assigned</p>
              ) : (
                <div className="space-y-2">
                  {assignedDrivers.map((assignment) => (
                    <div
                      key={assignment.worker?.id}
                      className="flex items-center justify-between p-3 bg-bg-primary border border-border rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{assignment.worker?.name}</span>
                        {assignment.worker?.crew && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium border"
                            style={{
                              backgroundColor: (assignment.worker.crew.color || '#6366f1') + '20',
                              borderColor: (assignment.worker.crew.color || '#6366f1') + '40',
                              color: assignment.worker.crew.color || '#6366f1',
                            }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: assignment.worker.crew.color || '#6366f1' }} />
                            {assignment.worker.crew.name}
                          </span>
                        )}
                      </div>
                      <button onClick={() => handleUnassignWorker(assignment.worker?.id || '')} className="p-1 hover:bg-bg-hover rounded transition-colors">
                        <X size={16} className="text-error" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {showWorkerPicker === 'driver' && (
                <div className="mt-3 p-3 bg-bg-primary border border-primary rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">Select Driver</h4>
                    <button onClick={() => setShowWorkerPicker(null)} className="text-text-secondary hover:text-text-primary"><X size={16} /></button>
                  </div>
                  {availableDrivers.length === 0 ? (
                    <p className="text-sm text-text-secondary italic">No available drivers</p>
                  ) : (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {availableDrivers.map((worker) => (
                        <button key={worker.id} onClick={() => handleAssignWorker(worker.id)} className="w-full text-left px-3 py-2 hover:bg-bg-hover rounded transition-colors flex items-center justify-between">
                          <span>{worker.name}</span>
                          {worker.crew && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded-full border" style={{ backgroundColor: (worker.crew.color || '#6366f1') + '20', borderColor: (worker.crew.color || '#6366f1') + '40', color: worker.crew.color || '#6366f1' }}>
                              {worker.crew.name}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <Button variant="secondary" onClick={onClose} className="w-full">
            Done
          </Button>
        </div>
      )}
    </Modal>
  );
}
