// ============================================================================
// Equipment Request Card
// Displays a single equipment request with status badge and action buttons.
// When dispatched/received, shows make/model/serial from inventory link.
// ============================================================================

import { ChevronDown, ChevronUp, MoveRight } from 'lucide-react';
import { useState } from 'react';
import type { EquipmentRequest } from '../../types';

interface EquipmentRequestCardProps {
  request: EquipmentRequest;
  // Admin/Manager action handlers — omit to hide action buttons
  onApprove?: (request: EquipmentRequest) => void;
  onDispatch?: (request: EquipmentRequest) => void;
  onMarkReceived?: (request: EquipmentRequest) => void;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  pending: {
    label: 'Pending',
    bg: 'bg-yellow-50',
    text: 'text-yellow-800',
    border: 'border-yellow-300',
  },
  approved: {
    label: 'Approved',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-300',
  },
  dispatched: {
    label: 'Dispatched',
    bg: 'bg-orange-50',
    text: 'text-orange-800',
    border: 'border-orange-300',
  },
  received: {
    label: 'Received',
    bg: 'bg-green-50',
    text: 'text-green-800',
    border: 'border-green-300',
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      {cfg.label}
    </span>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(isoStr: string) {
  return new Date(isoStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function EquipmentRequestCard({
  request,
  onApprove,
  onDispatch,
  onMarkReceived,
}: EquipmentRequestCardProps) {
  const [expanded, setExpanded] = useState(false);

  const submittedDate = new Date(request.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const inv = request.equipment_inventory;
  const isDispatched = request.status === 'dispatched' || request.status === 'received';
  const hasIdentity = inv && (inv.make || inv.model || inv.serial_number);

  return (
    <div className="bg-bg-secondary border border-border rounded-lg overflow-hidden">
      {/* Main row */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-bg-hover transition-colors min-h-[64px]"
      >
        <div className="flex-1 min-w-0">
          {/* Name + qty — prominent */}
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[15px] font-semibold text-text-primary">
              {request.equipment_name}
            </span>
            <span className="text-[13px] text-text-secondary">
              × {request.quantity_requested}
            </span>
          </div>
          {/* Make / model / serial — shown whenever available */}
          {hasIdentity && (
            <div className="text-[12px] text-text-secondary mt-0.5 flex gap-2 flex-wrap">
              {inv.make && <span>{inv.make}</span>}
              {inv.model && <span>{inv.model}</span>}
              {inv.serial_number && (
                <span className="text-text-tertiary">#{inv.serial_number}</span>
              )}
            </div>
          )}
          {/* Movement arrow */}
          {isDispatched && request.requesting_job_site && request.destination_job_site && (
            <div className="flex items-center gap-1 text-[12px] text-text-secondary mt-0.5">
              <span>{request.requesting_job_site.name}</span>
              <MoveRight size={12} className="text-text-tertiary" />
              <span className="font-medium text-text-primary">{request.destination_job_site.name}</span>
            </div>
          )}
          {/* Date + submitted (non-dispatched) */}
          {!isDispatched && (
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-[12px] text-text-secondary font-medium">
                Needed: {formatDate(request.date_needed)}
              </span>
              <span className="text-[11px] text-text-tertiary">
                Submitted {submittedDate}
              </span>
            </div>
          )}
          {isDispatched && (
            <div className="text-[11px] text-text-tertiary mt-0.5">
              Needed {formatDate(request.date_needed)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={request.status} />
          {expanded ? (
            <ChevronUp size={16} className="text-text-tertiary" />
          ) : (
            <ChevronDown size={16} className="text-text-tertiary" />
          )}
        </div>
      </button>

      {/* Expanded detail + action buttons */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">

          {/* Movement history timeline — shown when dispatched/received */}
          {isDispatched && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
                Movement
              </p>
              <div className="flex items-center gap-2 text-[13px]">
                <span className="text-text-secondary">
                  {request.requesting_job_site?.name ?? '—'}
                </span>
                <MoveRight size={14} className="text-text-tertiary flex-shrink-0" />
                <span className="font-medium text-text-primary">
                  {request.destination_job_site?.name ?? '—'}
                </span>
              </div>
              {request.dispatched_at && (
                <p className="text-[12px] text-text-secondary">
                  Dispatched {formatDateTime(request.dispatched_at)}
                </p>
              )}
              {request.received_at && (
                <p className="text-[12px] text-success font-medium">
                  Received {formatDateTime(request.received_at)}
                </p>
              )}
            </div>
          )}

          {/* Detail fields */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
            {request.requested_by_profile && (
              <>
                <span className="text-text-secondary">Requested by</span>
                <span className="text-text-primary">{request.requested_by_profile.name}</span>
              </>
            )}
            {request.dispatch_notes && (
              <>
                <span className="text-text-secondary">Dispatch notes</span>
                <span className="text-text-primary">{request.dispatch_notes}</span>
              </>
            )}
            {/* Make / model / serial in detail grid */}
            {inv?.make && (
              <>
                <span className="text-text-secondary">Make</span>
                <span className="text-text-primary">{inv.make}</span>
              </>
            )}
            {inv?.model && (
              <>
                <span className="text-text-secondary">Model</span>
                <span className="text-text-primary">{inv.model}</span>
              </>
            )}
            {inv?.serial_number && (
              <>
                <span className="text-text-secondary">Equipment #</span>
                <span className="text-text-primary">{inv.serial_number}</span>
              </>
            )}
          </div>

          {request.notes && (
            <p className="text-[13px] text-text-secondary italic">{request.notes}</p>
          )}

          {/* Action buttons */}
          {request.status === 'pending' && onApprove && (
            <button
              type="button"
              onClick={() => onApprove(request)}
              className="w-full min-h-[44px] bg-primary text-white rounded-lg text-[14px] font-medium hover:bg-primary-hover transition-colors"
            >
              Approve
            </button>
          )}
          {request.status === 'approved' && onDispatch && (
            <button
              type="button"
              onClick={() => onDispatch(request)}
              className="w-full min-h-[44px] bg-orange-500 text-white rounded-lg text-[14px] font-medium hover:bg-orange-600 transition-colors"
            >
              Dispatch
            </button>
          )}
          {request.status === 'dispatched' && onMarkReceived && (
            <button
              type="button"
              onClick={() => onMarkReceived(request)}
              className="w-full min-h-[44px] bg-green-600 text-white rounded-lg text-[14px] font-medium hover:bg-green-700 transition-colors"
            >
              Mark Received
            </button>
          )}
        </div>
      )}
    </div>
  );
}
