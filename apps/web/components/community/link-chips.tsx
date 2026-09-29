import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { COMMUNITY_LINK_KIND_LABELS, type CommunityLinkKind, type CommunityLinkRecord } from '@ibas/shared-types';
import { LINK_KIND_STYLE } from '@/lib/community';
import { cn } from '@/lib/utils';

/** Tagged workflow / toolkit / circular cards shown under a post. */
export function LinkChips({ links, className }: { links: CommunityLinkRecord[]; className?: string }) {
  if (links.length === 0) return null;
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {links.map((l) => {
        const style = LINK_KIND_STYLE[l.kind];
        const Icon = style.icon;
        return (
          <Link
            key={`${l.type}:${l.id}`}
            href={l.href}
            className={cn('group inline-flex max-w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition hover:shadow-sm', style.className)}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="font-semibold uppercase tracking-wide opacity-80">{COMMUNITY_LINK_KIND_LABELS[l.kind]}</span>
            <span className="min-w-0 truncate font-medium">{l.title}</span>
            {l.subtitle && <span className="hidden truncate opacity-70 sm:inline">· {l.subtitle}</span>}
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
          </Link>
        );
      })}
    </div>
  );
}

/** Compact icons for list rows. */
export function LinkKindIcons({ kinds }: { kinds: CommunityLinkKind[] }) {
  if (kinds.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1">
      {kinds.map((k) => {
        const style = LINK_KIND_STYLE[k];
        const Icon = style.icon;
        return (
          <span key={k} title={`Tagged ${COMMUNITY_LINK_KIND_LABELS[k].toLowerCase()}`} className={cn('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium', style.className)}>
            <Icon className="h-3 w-3" />
            {COMMUNITY_LINK_KIND_LABELS[k]}
          </span>
        );
      })}
    </span>
  );
}
