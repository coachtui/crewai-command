import { Edit2, Trash2, Phone, Wrench, HardHat, Hammer } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import type { Worker } from '../../types';
import { formatPhone } from '../../lib/utils';

interface WorkerCardProps {
  worker: Worker;
  onEdit: (worker: Worker) => void;
  onDelete: (workerId: string) => void;
}

const getRoleConfig = (role: Worker['role']) => {
  switch (role) {
    case 'operator':
      return {
        bgColor: 'bg-info/20',
        iconColor: 'text-info',
        badgeVariant: 'info' as const,
        icon: Wrench,
      };
    case 'carpenter':
      return {
        bgColor: 'bg-success/20',
        iconColor: 'text-success',
        badgeVariant: 'success' as const,
        icon: Hammer,
      };
    case 'mason':
      return {
        bgColor: 'bg-purple-500/20',
        iconColor: 'text-purple-400',
        badgeVariant: 'default' as const,
        icon: HardHat,
      };
    case 'laborer':
    default:
      return {
        bgColor: 'bg-warning/20',
        iconColor: 'text-warning',
        badgeVariant: 'default' as const,
        icon: HardHat,
      };
  }
};

export function WorkerCard({ worker, onEdit, onDelete }: WorkerCardProps) {
  const roleConfig = getRoleConfig(worker.role);
  const RoleIcon = roleConfig.icon;

  return (
    <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${roleConfig.bgColor}`}>
            <RoleIcon className={roleConfig.iconColor} size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-text-primary">{worker.name}</h3>
            <Badge variant={roleConfig.badgeVariant} className="mt-1">
              {worker.role}
            </Badge>
          </div>
        </div>
        
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(worker)}
            className="p-1.5 hover:bg-bg-hover rounded transition-colors"
            title="Edit"
          >
            <Edit2 size={16} className="text-text-secondary" />
          </button>
          <button
            onClick={() => onDelete(worker.id)}
            className="p-1.5 hover:bg-bg-hover rounded transition-colors"
            title="Delete"
          >
            <Trash2 size={16} className="text-error" />
          </button>
        </div>
      </div>

      {worker.phone && (
        <div className="flex items-center gap-2 text-sm text-text-secondary mb-3">
          <Phone size={14} />
          <span>{formatPhone(worker.phone)}</span>
        </div>
      )}

      {worker.skills && worker.skills.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {worker.skills.map((skill, index) => (
            <Badge key={index} variant="default" className="text-xs">
              {skill}
            </Badge>
          ))}
        </div>
      )}

      {worker.notes && (
        <p className="text-sm text-text-secondary mt-2 line-clamp-2">
          {worker.notes}
        </p>
      )}
    </Card>
  );
}
