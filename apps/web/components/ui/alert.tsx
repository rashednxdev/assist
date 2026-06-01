import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

const variants = {
  error: 'border-red-200 bg-destructive-light text-red-900',
  success: 'border-emerald-200 bg-success-light text-emerald-900',
  warning: 'border-amber-200 bg-warning-light text-amber-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
};

export function Alert({
  variant = 'info',
  title,
  children,
  className,
}: {
  variant?: keyof typeof variants;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const Icon =
    variant === 'error'
      ? AlertCircle
      : variant === 'success'
        ? CheckCircle2
        : variant === 'warning'
          ? AlertCircle
          : Info;
  return (
    <div className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm', variants[variant], className)} role="alert">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
      <div>
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>
      </div>
    </div>
  );
}
