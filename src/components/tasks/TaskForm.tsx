import { useState, useEffect, type FormEvent } from 'react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import type { Task } from '../../types';
import { format } from 'date-fns';

interface TaskFormProps {
  task: Task | null;
  onSave: (taskData: Partial<Task>) => void;
  onCancel: () => void;
}

export function TaskForm({ task, onSave, onCancel }: TaskFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
    required_operators: 0,
    required_laborers: 0,
    status: 'planned' as 'planned' | 'active' | 'completed',
    notes: '',
  });

  useEffect(() => {
    if (task) {
      setFormData({
        name: task.name,
        location: task.location || '',
        start_date: task.start_date,
        end_date: task.end_date,
        required_operators: task.required_operators,
        required_laborers: task.required_laborers,
        status: task.status,
        notes: task.notes || '',
      });
    }
  }, [task]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    // Validate dates
    if (new Date(formData.end_date) < new Date(formData.start_date)) {
      alert('End date must be after start date');
      return;
    }
    
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Task Name *"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        placeholder="Enter task name"
        required
      />

      <Input
        label="Location"
        value={formData.location}
        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
        placeholder="Job site location"
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Start Date *"
          type="date"
          value={formData.start_date}
          onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
          required
        />

        <Input
          label="End Date *"
          type="date"
          value={formData.end_date}
          onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Required Operators *"
          type="number"
          min="0"
          value={formData.required_operators}
          onChange={(e) => setFormData({ ...formData, required_operators: parseInt(e.target.value) || 0 })}
          required
        />

        <Input
          label="Required Laborers *"
          type="number"
          min="0"
          value={formData.required_laborers}
          onChange={(e) => setFormData({ ...formData, required_laborers: parseInt(e.target.value) || 0 })}
          required
        />
      </div>

      <Select
        label="Status *"
        value={formData.status}
        onChange={(e) => setFormData({ ...formData, status: e.target.value as 'planned' | 'active' | 'completed' })}
        options={[
          { value: 'planned', label: 'Planned' },
          { value: 'active', label: 'Active' },
          { value: 'completed', label: 'Completed' },
        ]}
      />

      <Textarea
        label="Notes"
        value={formData.notes}
        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        placeholder="Additional task details"
      />

      <div className="flex gap-3 pt-4">
        <Button type="submit" className="flex-1">
          {task ? 'Update Task' : 'Create Task'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
