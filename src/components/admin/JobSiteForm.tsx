import { useState, useEffect, type FormEvent } from 'react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import type { JobSite } from '../../types';

interface JobSiteFormProps {
  jobSite: JobSite | null;
  onSave: (jobSiteData: Partial<JobSite>) => void;
  onCancel: () => void;
}

export function JobSiteForm({ jobSite, onSave, onCancel }: JobSiteFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    description: '',
    status: 'active' as 'active' | 'on_hold' | 'completed',
    start_date: '',
    end_date: '',
  });

  useEffect(() => {
    if (jobSite) {
      setFormData({
        name: jobSite.name,
        address: jobSite.address || '',
        description: jobSite.description || '',
        status: jobSite.status,
        start_date: jobSite.start_date || '',
        end_date: jobSite.end_date || '',
      });
    }
  }, [jobSite]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    // Validate dates
    if (formData.start_date && formData.end_date) {
      const startDate = new Date(formData.start_date);
      const endDate = new Date(formData.end_date);
      if (endDate < startDate) {
        alert('End date must be after start date');
        return;
      }
    }

    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Name *"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        placeholder="Enter job site name"
        required
      />

      <Input
        label="Address"
        value={formData.address}
        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
        placeholder="123 Main St, City, State ZIP"
      />

      <Textarea
        label="Description"
        value={formData.description}
        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        placeholder="Brief description of the job site"
      />

      <Select
        label="Status *"
        value={formData.status}
        onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'on_hold' | 'completed' })}
        options={[
          { value: 'active', label: 'Active' },
          { value: 'on_hold', label: 'On Hold' },
          { value: 'completed', label: 'Completed' },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Start Date"
          type="date"
          value={formData.start_date}
          onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
        />

        <Input
          label="End Date"
          type="date"
          value={formData.end_date}
          onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
        />
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="submit" className="flex-1">
          {jobSite ? 'Update Job Site' : 'Create Job Site'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
