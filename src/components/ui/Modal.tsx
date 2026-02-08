import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-150"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          'relative bg-bg-secondary border border-border rounded-lg shadow-md-soft max-h-[90vh] overflow-y-auto transition-all duration-150 ease-smooth',
          {
            'w-full max-w-md': size === 'sm',
            'w-full max-w-2xl': size === 'md',
            'w-full max-w-4xl': size === 'lg',
          }
        )}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-[18px] font-semibold text-text-primary">{title}</h2>
            <button
              onClick={onClose}
              className="text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-md p-1 transition-all duration-150"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
