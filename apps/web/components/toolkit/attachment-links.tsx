import { ExternalLink, FileText } from 'lucide-react';
import type { ToolkitAttachment } from '@ibas/shared-types';
import { cn } from '@/lib/utils';

function fileKind(url: string): string | null {
  const path = url.split(/[?#]/)[0]!.toLowerCase();
  const ext = path.match(/\.(pdf|docx?|xlsx?|pptx?|zip)$/)?.[1];
  if (ext) return ext.toUpperCase();
  if (/drive\.google\.com|docs\.google\.com/.test(path)) return 'Drive';
  return null;
}

/** PDF / document links attached by admins; opens in a new tab. */
export function AttachmentLinks({
  files,
  compact = false,
  className,
}: {
  files: ToolkitAttachment[];
  compact?: boolean;
  className?: string;
}) {
  if (files.length === 0) return null;
  return (
    <ul className={cn(compact ? 'flex flex-wrap gap-1.5' : 'grid gap-2 sm:grid-cols-2', className)}>
      {files.map((f, i) => {
        const kind = fileKind(f.url);
        return (
          <li key={`${f.url}-${i}`}>
            <a
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'group flex items-center gap-2 rounded-md border border-border bg-background text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5',
                compact ? 'px-2 py-1 text-xs' : 'px-3 py-2',
              )}
            >
              <FileText className={cn('shrink-0 text-red-600', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
              <span className="min-w-0 flex-1 truncate">{f.title}</span>
              {kind && !compact && (
                <span className="rounded bg-muted/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted">{kind}</span>
              )}
              <ExternalLink className="h-3 w-3 shrink-0 text-muted group-hover:text-primary print:hidden" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
