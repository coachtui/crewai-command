import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { useJobSite } from '../../contexts/JobSiteContext';
import {
  fetchWorkerSiteAssignments,
  assignWorkerToSite,
  removeWorkerSiteAssignment,
  updateWorkerSiteAssignment,
} from '../../lib/api/workers';
import type { WorkerSiteAssignment } from '../../types';
import { toast } from 'sonner';

interface WorkerSiteManagerProps {
  workerId: string;
  primarySiteId?: string; // The worker's main job_site_id (excluded from additional assignments)
  onAssignmentChange?: () => void; // Called after any add/remove so parents can refresh
}

export function WorkerSiteManager({ workerId, primarySiteId, onAssignmentChange }: WorkerSiteManagerProps) {
  const { user } = useAuth();
  const { availableJobSites } = useJobSite();
  const [assignments, setAssignments] = useState<WorkerSiteAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newAssignment, setNewAssignment] = useState({
    job_site_id: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    notes: '',
  });

  const assignedSiteIds = new Set(assignments.map(a => a.job_site_id));
  const availableSites = availableJobSites.filter(
    s => !s.is_system_site && s.id !== primarySiteId && !assignedSiteIds.has(s.id)
  );

  useEffect(() => {
    loadAssignments();
  }, [workerId]);

  const loadAssignments = async () => {
    try {
      setLoading(true);
      const data = await fetchWorkerSiteAssignments(workerId);
      setAssignments(data);
    } catch {
      toast.error('Failed to load site assignments');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newAssignment.job_site_id) {
      toast.error('Please select a job site');
      return;
    }
    try {
      const created = await assignWorkerToSite({
        worker_id: workerId,
        job_site_id: newAssignment.job_site_id,
        start_date: newAssignment.start_date || undefined,
        end_date: newAssignment.end_date || undefined,
        notes: newAssignment.notes || undefined,
        assigned_by: user?.id,
      });
      setAssignments(prev => [created, ...prev]);
      setNewAssignment({
        job_site_id: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        notes: '',
      });
      setIsAdding(false);
      toast.success('Site assignment added');
      onAssignmentChange?.();
    } catch {
      toast.error('Failed to add site assignment');
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeWorkerSiteAssignment(id);
      setAssignments(prev => prev.filter(a => a.id !== id));
      toast.success('Assignment removed');
      onAssignmentChange?.();
    } catch {
      toast.error('Failed to remove assignment');
    }
  };

  const handleUpdate = async (id: string, updates: { start_date?: string; end_date?: string }) => {
    try {
      const updated = await updateWorkerSiteAssignment(id, updates);
      setAssignments(prev => prev.map(a => a.id === id ? updated : a));
    } catch {
      toast.error('Failed to update assignment');
    }
  };

  if (loading) {
    return <p className="text-sm text-text-secondary">Loading assignments...</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-text-primary">
          Additional Site Assignments
        </label>
        {!isAdding && availableSites.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1"
          >
            <Plus size={14} />
            Add Site
          </Button>
        )}
      </div>

      {assignments.length === 0 && !isAdding && (
        <div className="text-sm text-text-secondary py-3 text-center border border-dashed border-border-primary rounded-lg">
          No additional site assignments. Use "Add Site" to assign this worker to another project.
        </div>
      )}

      {assignments.map(a => (
        <div key={a.id} className="border border-border-primary rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-sm text-text-primary">
              {a.job_site?.name || 'Unknown Site'}
            </span>
            <button
              type="button"
              onClick={() => handleRemove(a.id)}
              className="p-1 hover:bg-bg-hover rounded transition-colors"
              title="Remove assignment"
            >
              <Trash2 size={14} className="text-error" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Start Date"
              type="date"
              value={a.start_date || ''}
              onChange={e => handleUpdate(a.id, { start_date: e.target.value || undefined })}
            />
            <Input
              label="End Date"
              type="date"
              value={a.end_date || ''}
              onChange={e => handleUpdate(a.id, { end_date: e.target.value || undefined })}
            />
          </div>
        </div>
      ))}

      {isAdding && (
        <div className="border border-primary/50 rounded-lg p-3 bg-primary/5 space-y-3">
          <Select
            label="Job Site *"
            value={newAssignment.job_site_id}
            onChange={e => setNewAssignment(prev => ({ ...prev, job_site_id: e.target.value }))}
            options={availableSites.map(s => ({ value: s.id, label: s.name }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Start Date"
              type="date"
              value={newAssignment.start_date}
              onChange={e => setNewAssignment(prev => ({ ...prev, start_date: e.target.value }))}
            />
            <Input
              label="End Date"
              type="date"
              value={newAssignment.end_date}
              onChange={e => setNewAssignment(prev => ({ ...prev, end_date: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={handleAdd}>Add</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setIsAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
