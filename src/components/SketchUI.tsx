import React, { forwardRef } from 'react';
import { cn } from '../lib/utils';

interface SketchCardProps {
  children: React.ReactNode;
  className?: string;
  decorated?: boolean;
  onClick?: () => void;
}

export const SketchCard = forwardRef<HTMLDivElement, SketchCardProps>(
  ({ children, className, decorated = false, onClick }, ref) => {
    return (
      <div
        ref={ref}
        onClick={onClick}
        className={cn(
          'sketch-card p-4',
          decorated && 'sketch-card-decorated',
          onClick && 'cursor-pointer',
          className
        )}
      >
        {children}
      </div>
    );
  }
);

SketchCard.displayName = 'SketchCard';

interface SketchButtonProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'primary' | 'ghost' | 'recommended';
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export const SketchButton = forwardRef<HTMLButtonElement, SketchButtonProps>(
  ({ 
    children, 
    className, 
    variant = 'default',
    selected = false,
    disabled = false,
    onClick 
  }, ref) => {
    const variantClasses = {
      default: 'sketch-btn',
      primary: 'sketch-btn sketch-btn-primary',
      ghost: 'sketch-btn sketch-btn-ghost',
      recommended: 'sketch-btn border-[--accent] bg-[--accent-soft]',
    };

    return (
      <button
        ref={ref}
        onClick={onClick}
        disabled={disabled}
        className={cn(
          variantClasses[variant],
          selected && 'bg-[--success] border-[--success] text-white shadow-none translate-x-[2px] translate-y-[2px]',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        {children}
      </button>
    );
  }
);

SketchButton.displayName = 'SketchButton';

interface SketchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export const SketchInput = forwardRef<HTMLInputElement, SketchInputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        {...props}
        ref={ref}
        className={cn('sketch-input', className)}
      />
    );
  }
);

SketchInput.displayName = 'SketchInput';

interface SketchTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}

export const SketchTextarea = forwardRef<HTMLTextAreaElement, SketchTextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        {...props}
        ref={ref}
        className={cn('sketch-textarea custom-scrollbar', className)}
      />
    );
  }
);

SketchTextarea.displayName = 'SketchTextarea';

interface SketchBadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'accent' | 'success';
  className?: string;
}

export function SketchBadge({ children, variant = 'default', className }: SketchBadgeProps) {
  const variantClasses = {
    default: 'sketch-badge',
    accent: 'sketch-badge sketch-badge-accent',
    success: 'sketch-badge sketch-badge-success',
  };

  return (
    <span className={cn(variantClasses[variant], className)}>
      {children}
    </span>
  );
}
