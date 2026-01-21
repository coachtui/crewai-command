import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import type { JobSite, JobSiteRole } from '../../types';

export interface JobSiteAssignmentData {
  id?: string;
  job_site_id: string;
  role: JobSiteRole;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
}

interface UserRoleManagerProps {
  assignments: JobSiteAssignmentData[];
  availableJobSites: JobSite[];
  onChange: (assignments: JobSiteAssignmentData[]) => void;
}

export function UserRoleManager({ assignments, availableJobSites, onChange }: UserRoleManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newAssignment, setNewAssignment] = useState<JobSiteAssignmentData>({
    job_site_id: '',
    role: 'worker',
    start_date: new Date().toISOString().split('T')[0],
    is_active: true,
  });

  const handleAddAssignment = () => {
    if (!newAssignment.job_site_id) {
      alert('Please select a job site');
      return;
    }

    // Check for duplicate
    const exists = assignments.some(a => a.job_site_id === newAssignment.job_site_id && a.is_active);
    if (exists) {
      alert('User is already assigned to this job site');
      return;
    }

    onChange([...assignments, newAssignment]);
    setNewAssignment({
      job_site_id: '',
      role: 'worker',
      start_date: new Date().toISOString().split('T')[0],
      is_active: true,
    });
    setIsAdding(false);
  };

  const handleRemoveAssignment = (index: number) => {
    const updated = assignments.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleUpdateAssignment = (index: number, updates: Partial<JobSiteAssignmentData>) => {
    const updated = [...assignments];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const getJobSiteName = (siteId: string) => {
    return availableJobSites.find(s => s.id === siteId)?.name || 'Unknown Site';
  };

  const activeAssignments = assignments.filter(a => a.is_active);
  const availableSites = availableJobSites.filter(
    site => !activeAssignments.some(a => a.job_site_id === site.id)
  );

  const roleOptions = [
    { value: 'superintendent', label: 'Superintendent' },
    { value: 'engineer', label: 'Engineer' },
    { value: 'engineer_as_superintendent', label: 'Engineer (as Superintendent)' },
    { value: 'foreman', label: 'Foreman' },
    { value: 'worker', label: 'Worker' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-text-primary">
          Job Site Assignments
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
            Add Assignment
          </Button>
        )}
      </div>

      {activeAssignments.length === 0 && !isAdding && (
        <div className="text-sm text-text-secondary py-4 text-center border border-dashed border-border-primary rounded-lg">
          No job site assignments. Click "Add Assignment" to assign this user to a job site.
        </div>
      )}

      <div className="space-y-3">
        {activeAssignments.map((assignment, index) => (
          <div key={index} className="border border-border-primary rounded-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-medium text-text-primary">{getJobSiteName(assignment.job_site_id)}</h4>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveAssignment(index)}
                className="p-1 hover:bg-bg-hover rounded transition-colors"
                title="Remove assignment"
              >
                <Trash2 size={14} className="text-error" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Select
                label="Role"
                value={assignment.role}
                onChange={(e) => handleUpdateAssignment(index, { role: e.target.value as JobSiteRole })}
                options={roleOptions}
              />

              <Input
                label="Start Date"
                type="date"
                value={assignment.start_date || ''}
                onChange={(e) => handleUpdateAssignment(index, { start_date: e.target.value })}
              />

              <Input
                label="End Date"
                type="date"
                value={assignment.end_date || ''}
                onChange={(e) => handleUpdateAssignment(index, { end_date: e.target.value })}
              />
            </div>
          </div>
        ))}

        {isAdding && (
          <div className="border border-primary/50 rounded-lg p-4 bg-primary/5">
            <h4 className="font-medium text-text-primary mb-3">New Assignment</h4>

            <div className="space-y-3">
              <Select
                label="Job Site *"
                value={newAssignment.job_site_id}
                onChange={(e) => setNewAssignment({ ...newAssignment, job_site_id: e.target.value })}
                options={availableSites.map(site => ({ value: site.id, label: site.name }))}
                required
              />

              <Select
                label="Role *"
                value={newAssignment.role}
                onChange={(e) => setNewAssignment({ ...newAssignment, role: e.target.value as JobSiteRole })}
                options={roleOptions}
              />

              <Input
                label="Start Date"
                type="date"
                value={newAssignment.start_date || ''}
                onChange={(e) => setNewAssignment({ ...newAssignment, start_date: e.target.value })}
              />

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddAssignment}
                >
                  Add
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setIsAdding(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
