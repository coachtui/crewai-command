import { Edit2, Trash2, MapPin, Calendar, Users, Paperclip } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import type { Task, Assignment } from '../../types';
import { formatDate, getStaffingStatus } from '../../lib/utils';
import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface TaskCardProps {
  task: Task;
  assignments: Assignment[];
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onAssign?: (task: Task) => void;
}

export function TaskCard({ task, assignments, onEdit, onDelete, onAssign }: TaskCardProps) {
  const [showAttachments, setShowAttachments] = useState(false);
  
  // Get assignments for this task
  const taskAssignments = assignments.filter(a => a.task_id === task.id);
  
  // Count assigned workers by role
  const assignedOperators = taskAssignments.filter(
    a => a.worker?.role === 'operator'
  ).length;
  const assignedLaborers = taskAssignments.filter(
    a => a.worker?.role === 'laborer'
  ).length;

  // Calculate staffing status
  const staffingStatus = getStaffingStatus(task, assignments);
  
  const statusColors = {
    success: 'bg-success/20 border-success',
    warning: 'bg-warning/20 border-warning',
    error: 'bg-error/20 border-error',
  };

  return (
    <Card 
      className={`hover:border-primary/50 transition-colors group relative border-l-4 cursor-pointer ${statusColors[staffingStatus]}`}
      onClick={() => onAssign?.(task)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-text-primary mb-1">{task.name}</h3>
          <Badge 
            variant={
              task.status === 'completed' ? 'success' : 
              task.status === 'active' ? 'info' : 
              'default'
            }
          >
            {task.status}
          </Badge>
        </div>
        
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(task);
            }}
            className="p-1.5 hover:bg-bg-hover rounded transition-colors"
            title="Edit"
          >
            <Edit2 size={16} className="text-text-secondary" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.id);
            }}
            className="p-1.5 hover:bg-bg-hover rounded transition-colors"
            title="Delete"
          >
            <Trash2 size={16} className="text-error" />
          </button>
        </div>
      </div>

      {task.location && (
        <div className="flex items-center gap-2 text-sm text-text-secondary mb-2">
          <MapPin size={14} />
          <span>{task.location}</span>
        </div>
      )}

      {task.start_date && task.end_date ? (
        <div className="flex items-center gap-2 text-sm text-text-secondary mb-3">
          <Calendar size={14} />
          <span>
            {formatDate(task.start_date)} - {formatDate(task.end_date)}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-text-secondary mb-3">
          <Calendar size={14} />
          <span className="italic">No dates set</span>
        </div>
      )}

      {/* Staffing Info */}
      <div className="space-y-2 pt-3 border-t border-border">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-info" />
            <span className="text-text-secondary">Operators:</span>
          </div>
          <span className={`font-medium ${
            assignedOperators >= task.required_operators ? 'text-success' : 'text-warning'
          }`}>
            {assignedOperators} / {task.required_operators}
          </span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-warning" />
            <span className="text-text-secondary">Laborers:</span>
          </div>
          <span className={`font-medium ${
            assignedLaborers >= task.required_laborers ? 'text-success' : 'text-warning'
          }`}>
            {assignedLaborers} / {task.required_laborers}
          </span>
        </div>
      </div>

      {task.notes && (
        <p className="text-sm text-text-secondary mt-3 line-clamp-2">
          {task.notes}
        </p>
      )}

      {/* Attachments Button */}
      {task.attachments && task.attachments.length > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowAttachments(true);
          }}
          className="mt-3 flex items-center gap-2 text-sm text-primary hover:text-primary-hover transition-colors"
        >
          <Paperclip size={14} />
          <span>{task.attachments.length} file{task.attachments.length !== 1 ? 's' : ''}</span>
        </button>
      )}

      {/* Attachments Modal */}
      <Modal
        isOpen={showAttachments}
        onClose={() => setShowAttachments(false)}
        title={`${task.name} - Files`}
        size="lg"
      >
        <div className="space-y-4">
          {task.attachments?.map((url, index) => {
            const fileName = url.split('/').pop()?.split('?')[0] || 'File';
            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);

            return (
              <div key={index} className="border border-border rounded-lg overflow-hidden">
                {isImage ? (
                  <div>
                    <img 
                      src={url} 
                      alt={fileName}
                      className="w-full h-auto"
                    />
                    <div className="p-3 bg-bg-secondary border-t border-border">
                      <p className="text-sm text-text-secondary truncate">{fileName}</p>
                      <Button
                        size="sm"
                        onClick={() => window.open(url, '_blank')}
                        className="mt-2"
                      >
                        Open in New Tab
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-bg-secondary">
                    <p className="text-sm font-medium mb-2">{fileName}</p>
                    <Button
                      size="sm"
                      onClick={() => window.open(url, '_blank')}
                    >
                      Open File
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Modal>
    </Card>
  );
}
