import { Edit2, Trash2, MapPin, Calendar } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import type { JobSite } from '../../types';

interface JobSiteCardProps {
  jobSite: JobSite;
  onEdit: (jobSite: JobSite) => void;
  onDelete: (jobSiteId: string) => void;
}

const getStatusConfig = (status: JobSite['status']) => {
  switch (status) {
    case 'active':
      return {
        badgeVariant: 'success' as const,
        bgColor: 'bg-success/20',
        iconColor: 'text-success',
      };
    case 'on_hold':
      return {
        badgeVariant: 'warning' as const,
        bgColor: 'bg-warning/20',
        iconColor: 'text-warning',
      };
    case 'completed':
      return {
        badgeVariant: 'default' as const,
        bgColor: 'bg-bg-hover',
        iconColor: 'text-text-secondary',
      };
  }
};

export function JobSiteCard({ jobSite, onEdit, onDelete }: JobSiteCardProps) {
  const statusConfig = getStatusConfig(jobSite.status);

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-text-primary text-lg">{jobSite.name}</h3>
          <Badge variant={statusConfig.badgeVariant} className="mt-2">
            {jobSite.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(jobSite)}
            className="p-1.5 hover:bg-bg-hover rounded transition-colors"
            title="Edit"
          >
            <Edit2 size={16} className="text-text-secondary" />
          </button>
          <button
            onClick={() => onDelete(jobSite.id)}
            className="p-1.5 hover:bg-bg-hover rounded transition-colors"
            title="Delete"
          >
            <Trash2 size={16} className="text-error" />
          </button>
        </div>
      </div>

      {jobSite.address && (
        <div className="flex items-start gap-2 text-sm text-text-secondary mb-3">
          <MapPin size={14} className="mt-0.5 flex-shrink-0" />
          <span>{jobSite.address}</span>
        </div>
      )}

      {(jobSite.start_date || jobSite.end_date) && (
        <div className="flex items-center gap-2 text-sm text-text-secondary mb-3">
          <Calendar size={14} />
          <span>
            {formatDate(jobSite.start_date) || 'No start date'}
            {' - '}
            {formatDate(jobSite.end_date) || 'Ongoing'}
          </span>
        </div>
      )}

      {jobSite.description && (
        <p className="text-sm text-text-secondary mt-2 line-clamp-2">
          {jobSite.description}
        </p>
      )}
    </Card>
  );
}
