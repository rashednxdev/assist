import Link from 'next/link';
import { AlertTriangle, Archive, BookOpen, Scale } from 'lucide-react';
import type { ToolkitResolvedRef } from '@ibas/shared-types';
import { cn } from '@/lib/utils';

const ICON = { book_topic: Scale, book: BookOpen, circular: Archive } as const;

/** Rule / book / circular references shown under a checklist item, guide section or template. */
export function RefLinks({ refs, className }: { refs: ToolkitResolvedRef[]; className?: string }) {
  if (refs.length === 0) return null;
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {refs.map((r) => {
        const Icon = r.missing ? AlertTriangle : ICON[r.target_type];
        return r.missing ? (
          <span
            key={`${r.target_type}:${r.target_id}`}
            className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700"
            title="Admin only: this link points to a deleted or unpublished item"
          >
            <Icon className="h-3 w-3" /> {r.title}
          </span>
        ) : (
          <Link
            key={`${r.target_type}:${r.target_id}`}
            href={r.href}
            target="_blank"
            title={r.subtitle}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-primary hover:border-primary/40 hover:bg-primary-muted print:border-0 print:p-0 print:text-foreground"
          >
            <Icon className="h-3 w-3 shrink-0" />
            <span className="truncate">{r.title}</span>
          </Link>
        );
      })}
    </div>
  );
}
