import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default';
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium transition-all duration-150 ease-smooth',
          {
            'bg-success/10 text-success border border-success/20': variant === 'success',
            'bg-warning/10 text-warning border border-warning/20': variant === 'warning',
            'bg-error-bg text-error border border-error/20': variant === 'error',
            'bg-info/10 text-info border border-info/20': variant === 'info',
            'bg-bg-subtle text-text-secondary border border-border': variant === 'default',
          },
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
