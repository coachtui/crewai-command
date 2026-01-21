import { useState, useEffect, type FormEvent } from 'react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { UserRoleManager, type JobSiteAssignmentData } from './UserRoleManager';
import type { UserProfile, JobSite, BaseRole } from '../../types';

interface UserFormProps {
  user: UserProfile | null;
  availableJobSites: JobSite[];
  onSave: (userData: {
    email: string;
    name: string;
    phone?: string;
    base_role: BaseRole;
    job_site_assignments: JobSiteAssignmentData[];
  }) => void;
  onCancel: () => void;
}

export function UserForm({ user, availableJobSites, onSave, onCancel }: UserFormProps) {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    phone: '',
    base_role: 'worker' as BaseRole,
  });

  const [assignments, setAssignments] = useState<JobSiteAssignmentData[]>([]);

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email,
        name: user.name,
        phone: user.phone || '',
        base_role: user.base_role || 'worker',
      });

      // Convert existing assignments to the format expected by UserRoleManager
      if (user.job_site_assignments) {
        const converted = user.job_site_assignments
          .filter((a: any) => a.is_active)
          .map((a: any) => ({
            id: a.id,
            job_site_id: a.job_site_id,
            role: a.role,
            start_date: a.start_date,
            end_date: a.end_date,
            is_active: a.is_active,
          }));
        setAssignments(converted);
      }
    }
  }, [user]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.name) {
      alert('Please fill in all required fields');
      return;
    }

    onSave({
      ...formData,
      job_site_assignments: assignments,
    });
  };

  const baseRoleOptions = [
    { value: 'admin', label: 'Admin' },
    { value: 'superintendent', label: 'Superintendent' },
    { value: 'engineer', label: 'Engineer' },
    { value: 'foreman', label: 'Foreman' },
    { value: 'worker', label: 'Worker' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-text-primary border-b border-border-primary pb-2">
          User Information
        </h3>

        <Input
          label="Email *"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="user@example.com"
          required
          disabled={!!user}
        />

        <Input
          label="Name *"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Enter user name"
          required
        />

        <Input
          label="Phone"
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          placeholder="(555) 123-4567"
        />

        <Select
          label="Base Role *"
          value={formData.base_role}
          onChange={(e) => setFormData({ ...formData, base_role: e.target.value as BaseRole })}
          options={baseRoleOptions}
        />
      </div>

      <div>
        <h3 className="text-lg font-medium text-text-primary border-b border-border-primary pb-2 mb-4">
          Job Site Assignments
        </h3>
        <UserRoleManager
          assignments={assignments}
          availableJobSites={availableJobSites}
          onChange={setAssignments}
        />
      </div>

      <div className="flex gap-3 pt-4 border-t border-border-primary">
        <Button type="submit" className="flex-1">
          {user ? 'Update User' : 'Invite User'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
