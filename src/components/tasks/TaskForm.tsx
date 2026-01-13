import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import type { Task } from '../../types';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { Upload, X, FileIcon, Image as ImageIcon } from 'lucide-react';

interface TaskFormProps {
  task: Task | null;
  onSave: (taskData: Partial<Task>) => void;
  onCancel: () => void;
}

export function TaskForm({ task, onSave, onCancel }: TaskFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    start_date: '',
    end_date: '',
    required_operators: 0,
    required_laborers: 0,
    status: 'planned' as 'planned' | 'active' | 'completed',
    notes: '',
    include_saturday: false,
    include_sunday: false,
  });
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (task) {
      setFormData({
        name: task.name,
        location: task.location || '',
        start_date: task.start_date || '',
        end_date: task.end_date || '',
        required_operators: task.required_operators,
        required_laborers: task.required_laborers,
        status: task.status,
        notes: task.notes || '',
        include_saturday: task.include_saturday || false,
        include_sunday: task.include_sunday || false,
      });
      setAttachments(task.attachments || []);
    }
  }, [task]);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const uploadedUrls: string[] = [];

      for (const file of Array.from(files)) {
        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('task-files')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('task-files')
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
      }

      setAttachments([...attachments, ...uploadedUrls]);
      toast.success(`Uploaded ${uploadedUrls.length} file(s)`);
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Failed to upload files');
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleRemoveAttachment = (url: string) => {
    setAttachments(attachments.filter(a => a !== url));
  };

  const isImage = (url: string) => {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    // Validate dates only if both are provided
    if (formData.start_date && formData.end_date) {
      if (new Date(formData.end_date) < new Date(formData.start_date)) {
        alert('End date must be after start date');
        return;
      }
    }
    
    onSave({ ...formData, attachments });
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

      {/* Weekend Work Options */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-3">
          Weekend Work
        </label>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.include_saturday}
              onChange={(e) => setFormData({ ...formData, include_saturday: e.target.checked })}
              className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm">Include Saturday</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.include_sunday}
              onChange={(e) => setFormData({ ...formData, include_sunday: e.target.checked })}
              className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm">Include Sunday</span>
          </label>
        </div>
        <p className="text-xs text-text-secondary mt-1">
          Check if this task requires work on weekends
        </p>
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

      {/* File Upload Section */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Files & Images
        </label>
        
        {/* Upload Button */}
        <label className="inline-flex items-center gap-2 px-4 py-2 bg-bg-secondary border border-border rounded-lg cursor-pointer hover:bg-bg-hover transition-colors">
          <Upload size={16} />
          <span className="text-sm">{uploading ? 'Uploading...' : 'Upload Files'}</span>
          <input
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
        <p className="text-xs text-text-secondary mt-1">
          Upload images, PDFs, or documents
        </p>

        {/* Attachments List */}
        {attachments.length > 0 && (
          <div className="mt-3 space-y-2">
            {attachments.map((url, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 bg-bg-secondary border border-border rounded-lg"
              >
                {isImage(url) ? (
                  <ImageIcon size={16} className="text-primary" />
                ) : (
                  <FileIcon size={16} className="text-text-secondary" />
                )}
                <span className="text-sm flex-1 truncate">
                  {url.split('/').pop()?.split('?')[0]}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(url)}
                  className="p-1 hover:bg-bg-hover rounded transition-colors"
                >
                  <X size={14} className="text-error" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

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
