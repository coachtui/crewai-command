import React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-all duration-150 ease-smooth focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
          {
            'bg-primary text-white hover:bg-primary-hover shadow-subtle hover:shadow-sm-soft': variant === 'primary',
            'bg-bg-secondary text-text-primary hover:bg-bg-hover border border-border shadow-subtle': variant === 'secondary',
            'text-text-primary hover:bg-bg-hover': variant === 'ghost',
            'bg-error text-white hover:bg-error/90 shadow-subtle': variant === 'danger',
          },
          {
            'px-3 py-1.5 text-[13px]': size === 'sm',
            'px-4 py-2 text-[14px]': size === 'md',
            'px-6 py-3 text-[15px]': size === 'lg',
          },
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button };
