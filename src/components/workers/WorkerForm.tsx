import { useState, useEffect, type FormEvent } from 'react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { X } from 'lucide-react';
import type { Worker } from '../../types';

interface WorkerFormProps {
  worker: Worker | null;
  onSave: (workerData: Partial<Worker>) => void;
  onCancel: () => void;
}

export function WorkerForm({ worker, onSave, onCancel }: WorkerFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    role: 'laborer' as 'operator' | 'laborer',
    skills: [] as string[],
    notes: '',
    status: 'active' as 'active' | 'inactive',
  });
  const [skillInput, setSkillInput] = useState('');

  useEffect(() => {
    if (worker) {
      setFormData({
        name: worker.name,
        phone: worker.phone || '',
        role: worker.role,
        skills: worker.skills || [],
        notes: worker.notes || '',
        status: worker.status,
      });
    }
  }, [worker]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const addSkill = () => {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      setFormData({
        ...formData,
        skills: [...formData.skills, skillInput.trim()],
      });
      setSkillInput('');
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter((skill) => skill !== skillToRemove),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Name *"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        placeholder="Enter worker name"
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
        label="Role *"
        value={formData.role}
        onChange={(e) => setFormData({ ...formData, role: e.target.value as 'operator' | 'laborer' })}
        options={[
          { value: 'operator', label: 'Operator' },
          { value: 'laborer', label: 'Laborer' },
        ]}
      />

      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">
          Skills
        </label>
        <div className="flex gap-2 mb-2">
          <Input
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            placeholder="Add a skill"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSkill();
              }
            }}
          />
          <Button type="button" onClick={addSkill} variant="secondary">
            Add
          </Button>
        </div>
        {formData.skills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {formData.skills.map((skill) => (
              <div
                key={skill}
                className="flex items-center gap-1 bg-bg-hover px-3 py-1 rounded-full text-sm"
              >
                <span>{skill}</span>
                <button
                  type="button"
                  onClick={() => removeSkill(skill)}
                  className="text-text-secondary hover:text-error"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Textarea
        label="Notes"
        value={formData.notes}
        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        placeholder="Additional information about the worker"
      />

      <Select
        label="Status *"
        value={formData.status}
        onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
        options={[
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
        ]}
      />

      <div className="flex gap-3 pt-4">
        <Button type="submit" className="flex-1">
          {worker ? 'Update Worker' : 'Create Worker'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
