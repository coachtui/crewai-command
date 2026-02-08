// ============================================================================
// CrewAI Command: Job Site Selector Component
// Dropdown for switching between job sites
// ============================================================================

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, MapPin, Check, Building2 } from 'lucide-react';
import { useJobSite, useShouldShowJobSiteSelector } from '../../contexts';
import type { JobSite } from '../../types';

interface JobSiteSelectorProps {
  className?: string;
  compact?: boolean; // For mobile view
}

export function JobSiteSelector({ className = '', compact = false }: JobSiteSelectorProps) {
  const { currentJobSite, availableJobSites, switchJobSite, isLoading } = useJobSite();
  const shouldShow = useShouldShowJobSiteSelector();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Don't render if shouldn't show
  if (!shouldShow) {
    return null;
  }

  const handleSiteSelect = async (site: JobSite) => {
    await switchJobSite(site.id);
    setIsOpen(false);
  };

  // Get display name (truncate if compact)
  const getDisplayName = (name: string): string => {
    if (compact && name.length > 12) {
      return name.substring(0, 12) + '...';
    }
    if (!compact && name.length > 24) {
      return name.substring(0, 24) + '...';
    }
    return name;
  };

  // Get status badge color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active':
        return 'bg-success/20 text-success';
      case 'on_hold':
        return 'bg-warning/20 text-warning';
      case 'completed':
        return 'bg-text-secondary/20 text-text-secondary';
      default:
        return 'bg-primary/20 text-primary';
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 bg-bg-secondary border border-border rounded-md ${className}`}>
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-[13px] text-text-secondary">Loading...</span>
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full flex items-center gap-2 px-3 py-2
          bg-bg-secondary hover:bg-bg-hover
          border border-border rounded-md
          transition-all duration-150 ease-smooth cursor-pointer
          ${isOpen ? 'ring-2 ring-primary ring-opacity-50 border-primary' : ''}
          ${compact ? 'text-[13px]' : 'text-[14px]'}
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <MapPin size={compact ? 14 : 16} className="text-primary flex-shrink-0" />
        <span className="text-text-primary font-medium truncate">
          {currentJobSite ? getDisplayName(currentJobSite.name) : 'Select Site'}
        </span>
        <ChevronDown
          size={compact ? 14 : 16}
          className={`text-text-secondary transition-transform duration-150 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`
            absolute z-50 mt-2
            bg-bg-secondary border border-border rounded-md shadow-md-soft
            min-w-[200px] max-w-[300px] w-max
            ${compact ? 'right-0' : 'left-0'}
          `}
          role="listbox"
        >
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-border">
            <p className="text-[11px] text-text-secondary font-semibold uppercase tracking-wide">
              Your Job Sites
            </p>
          </div>

          {/* Site List */}
          <div className="max-h-[300px] overflow-y-auto py-1">
            {availableJobSites.length === 0 ? (
              <div className="px-4 py-6 text-center text-text-secondary text-[13px]">
                No job sites available
              </div>
            ) : (
              availableJobSites.map((site) => (
                <button
                  key={site.id}
                  onClick={() => handleSiteSelect(site)}
                  className={`
                    w-full flex items-start gap-3 px-4 py-2.5
                    hover:bg-bg-hover transition-all duration-150
                    text-left
                    ${currentJobSite?.id === site.id ? 'bg-primary-subtle' : ''}
                  `}
                  role="option"
                  aria-selected={currentJobSite?.id === site.id}
                >
                  {/* Selection indicator */}
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {currentJobSite?.id === site.id ? (
                      <Check size={16} className="text-primary" />
                    ) : (
                      <Building2 size={16} className="text-text-secondary" />
                    )}
                  </div>

                  {/* Site info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-[14px] font-medium truncate ${
                      currentJobSite?.id === site.id ? 'text-primary' : 'text-text-primary'
                    }`}>
                      {site.name}
                    </p>
                    {site.address && (
                      <p className="text-[12px] text-text-secondary truncate mt-0.5">
                        {site.address}
                      </p>
                    )}
                  </div>

                  {/* Status badge */}
                  <span className={`
                    px-2 py-0.5 text-[11px] font-medium rounded-full flex-shrink-0
                    ${getStatusColor(site.status)}
                  `}>
                    {site.status === 'on_hold' ? 'Hold' : site.status}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Footer - show total count */}
          {availableJobSites.length > 0 && (
            <div className="px-4 py-2.5 border-t border-border bg-bg-subtle">
              <p className="text-[11px] text-text-secondary text-center">
                {availableJobSites.length} site{availableJobSites.length !== 1 ? 's' : ''} assigned
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Mobile-optimized full-screen selector
export function JobSiteSelectorMobile() {
  const { currentJobSite, availableJobSites, switchJobSite, isLoading } = useJobSite();
  const shouldShow = useShouldShowJobSiteSelector();
  const [isOpen, setIsOpen] = useState(false);

  if (!shouldShow) {
    return null;
  }

  const handleSiteSelect = async (site: JobSite) => {
    await switchJobSite(site.id);
    setIsOpen(false);
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active':
        return 'bg-success/20 text-success';
      case 'on_hold':
        return 'bg-warning/20 text-warning';
      case 'completed':
        return 'bg-text-secondary/20 text-text-secondary';
      default:
        return 'bg-primary/20 text-primary';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 bg-bg-secondary border border-border rounded-md">
        <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* Compact trigger */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-2 py-1.5 bg-bg-secondary hover:bg-bg-hover border border-border rounded-md transition-all duration-150"
      >
        <MapPin size={14} className="text-primary" />
        <span className="text-[13px] text-text-primary font-medium max-w-[80px] truncate">
          {currentJobSite?.name || 'Site'}
        </span>
        <ChevronDown size={12} className="text-text-secondary" />
      </button>

      {/* Full-screen modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-bg-primary">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-lg font-semibold text-text-primary">Select Job Site</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Site list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {availableJobSites.map((site) => (
              <button
                key={site.id}
                onClick={() => handleSiteSelect(site)}
                className={`
                  w-full flex items-start gap-3 p-4
                  bg-bg-secondary hover:bg-bg-hover 
                  border border-border rounded-lg
                  transition-colors text-left
                  ${currentJobSite?.id === site.id ? 'ring-2 ring-primary' : ''}
                `}
              >
                {/* Selection indicator */}
                <div className={`
                  w-6 h-6 rounded-full border-2 flex items-center justify-center
                  ${currentJobSite?.id === site.id 
                    ? 'border-primary bg-primary' 
                    : 'border-border'
                  }
                `}>
                  {currentJobSite?.id === site.id && (
                    <Check size={14} className="text-white" />
                  )}
                </div>

                {/* Site info */}
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium text-text-primary">
                    {site.name}
                  </p>
                  {site.address && (
                    <p className="text-sm text-text-secondary mt-1">
                      {site.address}
                    </p>
                  )}
                  {site.description && (
                    <p className="text-sm text-text-secondary mt-1 line-clamp-2">
                      {site.description}
                    </p>
                  )}
                </div>

                {/* Status badge */}
                <span className={`
                  px-2 py-1 text-xs font-medium rounded
                  ${getStatusColor(site.status)}
                `}>
                  {site.status === 'on_hold' ? 'On Hold' : 
                   site.status.charAt(0).toUpperCase() + site.status.slice(1)}
                </span>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-border">
            <p className="text-sm text-text-secondary text-center">
              {availableJobSites.length} job site{availableJobSites.length !== 1 ? 's' : ''} assigned to you
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export default JobSiteSelector;
