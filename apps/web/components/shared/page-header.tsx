import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  description,
  backHref,
  backLabel = 'Back',
  action,
  className,
}: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0 space-y-1">
        {backHref && (
          <Link
            href={backHref}
            className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark"
          >
            <ChevronLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-muted sm:text-base">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}
