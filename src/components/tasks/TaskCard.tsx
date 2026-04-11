import { Edit2, Trash2, MapPin, Calendar } from 'lucide-react';
import { ListItem } from '../ui/ListItem';
import { Badge } from '../ui/Badge';
import type { Task, Assignment } from '../../types';
import { formatDate } from '../../lib/utils';
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

  const displayName = task.name;

  // Get assignments for this task
  const taskAssignments = assignments.filter(a => a.task_id === task.id);

  // Count UNIQUE assigned workers by role (same worker can have multiple assignments for multi-day tasks)
  const uniqueOperators = taskAssignments
    .filter(a => a.worker?.role === 'operator')
    .reduce((acc, curr) => {
      if (!acc.find(a => a.worker?.id === curr.worker?.id)) {
        acc.push(curr);
      }
      return acc;
    }, [] as Assignment[]);

  const uniqueLaborers = taskAssignments
    .filter(a => a.worker?.role === 'laborer')
    .reduce((acc, curr) => {
      if (!acc.find(a => a.worker?.id === curr.worker?.id)) {
        acc.push(curr);
      }
      return acc;
    }, [] as Assignment[]);

  const assignedOperators = uniqueOperators.length;
  const assignedLaborers = uniqueLaborers.length;

  // Map task status to left-border color
  const statusColorMap: Record<string, 'blue' | 'green' | 'gray' | 'orange'> = {
    active: 'blue',
    completed: 'green',
    draft: 'gray',
    planned: 'gray',
    on_hold: 'orange',
  };
  const statusColor = statusColorMap[task.status] ?? 'gray';

  // Status badge
  const statusBadgeVariantMap: Record<string, 'success' | 'warning' | 'info' | 'default'> = {
    active: 'success',
    completed: 'default',
    planned: 'info',
    draft: 'default',
    on_hold: 'warning',
  };
  const statusLabelMap: Record<string, string> = {
    active: 'Active',
    completed: 'Completed',
    planned: 'Planned',
    draft: 'Draft',
    on_hold: 'On Hold',
  };
  const statusBadge = (
    <Badge variant={statusBadgeVariantMap[task.status] ?? 'default'}>
      {statusLabelMap[task.status] ?? task.status}
    </Badge>
  );

  // Count color: gray for 0/0, amber for partially filled, green for fully filled
  const getCountClass = (assigned: number, required: number) => {
    if (required === 0) return 'text-text-secondary font-medium';
    if (assigned >= required) return 'text-status-complete font-medium';
    return 'text-warning font-semibold';
  };

  // Build metadata array
  const metadata = [];
  if (task.location) {
    metadata.push({
      icon: <MapPin size={14} />,
      text: task.location,
    });
  }
  if (task.start_date && task.end_date) {
    metadata.push({
      icon: <Calendar size={14} />,
      text: `${formatDate(task.start_date)} - ${formatDate(task.end_date)}`,
    });
  }

  // Build right content
  const rightContent = (
    <div className="flex items-center justify-between gap-6">
      <div className="text-[13px]">
        <div className="mb-2">
          <span className="text-text-secondary">Operators: </span>
          <span className={getCountClass(assignedOperators, task.required_operators)}>
            {assignedOperators}/{task.required_operators}
          </span>
        </div>
        <div>
          <span className="text-text-secondary">Laborers: </span>
          <span className={getCountClass(assignedLaborers, task.required_laborers)}>
            {assignedLaborers}/{task.required_laborers}
          </span>
        </div>
      </div>
      <div className="flex gap-1 opacity-100 transition-opacity">
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
  );

  return (
    <>
      <ListItem
        statusColor={statusColor}
        title={displayName}
        badge={statusBadge}
        metadata={metadata}
        rightContent={rightContent}
        onClick={() => onAssign?.(task)}
      />
      {/* Attachments Modal - shown when clicked */}
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
    </>
  );
}
