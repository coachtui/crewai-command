import { useState, type FormEvent } from 'react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { AlertCircle } from 'lucide-react';
import type { Worker, JobSite } from '../../types';

interface MoveWorkerFormProps {
  worker: Worker;
  availableJobSites: JobSite[];
  onSave: (targetSiteId: string, notes?: string) => void;
  onCancel: () => void;
}

export function MoveWorkerForm({ worker, availableJobSites, onSave, onCancel }: MoveWorkerFormProps) {
  const [targetSiteId, setTargetSiteId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const currentSite = availableJobSites.find(site => site.id === worker.job_site_id);
  const targetSite = availableJobSites.find(site => site.id === targetSiteId);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!targetSiteId) {
      alert('Please select a target job site');
      return;
    }

    if (targetSiteId === worker.job_site_id) {
      alert('Target job site must be different from current job site');
      return;
    }

    onSave(targetSiteId, notes);
  };

  const jobSiteOptions = availableJobSites
    .filter(site => site.id !== worker.job_site_id && site.status === 'active')
    .map(site => ({
      value: site.id,
      label: site.name
    }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-bg-hover p-4 rounded-lg border border-border-primary">
        <h4 className="font-medium text-text-primary mb-2">Worker Information</h4>
        <div className="space-y-1 text-sm">
          <div>
            <span className="text-text-secondary">Name: </span>
            <span className="text-text-primary font-medium">{worker.name}</span>
          </div>
          <div>
            <span className="text-text-secondary">Role: </span>
            <span className="text-text-primary capitalize">{worker.role}</span>
          </div>
          <div>
            <span className="text-text-secondary">Current Site: </span>
            <span className="text-text-primary font-medium">{currentSite?.name || 'Unknown'}</span>
          </div>
        </div>
      </div>

      <Select
        label="Target Job Site *"
        value={targetSiteId}
        onChange={(e) => setTargetSiteId(e.target.value)}
        options={jobSiteOptions}
        required
      />

      {targetSite && (
        <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 flex gap-2">
          <AlertCircle size={20} className="text-warning flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-text-primary mb-1">Moving Worker</p>
            <p className="text-text-secondary">
              {worker.name} will be moved from <strong>{currentSite?.name}</strong> to <strong>{targetSite.name}</strong>.
            </p>
          </div>
        </div>
      )}

      <Input
        label="Effective Date"
        type="date"
        value={effectiveDate}
        onChange={(e) => setEffectiveDate(e.target.value)}
      />

      <Textarea
        label="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Optional notes about this worker movement"
      />

      <div className="flex gap-3 pt-4">
        <Button type="submit" className="flex-1">
          Move Worker
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
