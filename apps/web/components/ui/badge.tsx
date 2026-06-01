import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary-muted text-primary-dark ring-1 ring-primary/20',
        secondary: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
        success: 'bg-success-light text-success ring-1 ring-success/20',
        warning: 'bg-warning-light text-warning ring-1 ring-warning/20',
        destructive: 'bg-destructive-light text-destructive ring-1 ring-destructive/20',
        outline: 'border border-border bg-surface text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
