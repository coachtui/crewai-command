import { Edit2, Trash2, Phone, Wrench, HardHat, Hammer } from 'lucide-react';
import { ListItem } from '../ui/ListItem';
import { Badge } from '../ui/Badge';
import type { Worker, Crew } from '../../types';
import { formatPhone } from '../../lib/utils';

interface WorkerCardProps {
  worker: Worker;
  crew?: Crew;
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

export function WorkerCard({ worker, crew, onEdit, onDelete }: WorkerCardProps) {
  const roleConfig = getRoleConfig(worker.role);
  const RoleIcon = roleConfig.icon;

  // Determine status color
  const statusColor: 'green' | 'gray' = worker.status === 'active' ? 'green' : 'gray';

  // Resolve crew from prop or joined data
  const resolvedCrew = crew || worker.crew;

  // Build metadata array
  const metadata = [];
  metadata.push({
    icon: <RoleIcon size={14} className={roleConfig.iconColor} />,
    text: worker.role.charAt(0).toUpperCase() + worker.role.slice(1),
  });
  if (worker.phone) {
    metadata.push({
      icon: <Phone size={14} />,
      text: formatPhone(worker.phone),
    });
  }

  // Build right content
  const rightContent = (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        {resolvedCrew && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border"
            style={{
              backgroundColor: (resolvedCrew.color || '#6366f1') + '20',
              borderColor: (resolvedCrew.color || '#6366f1') + '40',
              color: resolvedCrew.color || '#6366f1',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: resolvedCrew.color || '#6366f1' }}
            />
            {resolvedCrew.name}
          </span>
        )}
        <Badge variant={worker.status === 'active' ? 'success' : 'default'}>
          {worker.status === 'active' ? 'Available' : 'Inactive'}
        </Badge>
      </div>
      <div className="flex gap-1 opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(worker);
          }}
          className="p-1.5 hover:bg-bg-hover rounded transition-colors"
          title="Edit"
        >
          <Edit2 size={16} className="text-text-secondary" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(worker.id);
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
    <ListItem
      statusColor={statusColor}
      title={worker.name}
      metadata={metadata}
      rightContent={rightContent}
    />
  );
}
