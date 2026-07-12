'use client';

import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { resolveContentEmbedSrc, resolveContentOpenHref } from '@/lib/static-ref-pages';

export function RuleContentLinkEmbed({
  contentLink,
  title = 'Linked page',
  heightClassName = 'h-[min(70vh,640px)]',
}: {
  contentLink?: string | null;
  title?: string;
  heightClassName?: string;
}) {
  const link = contentLink?.trim();
  if (!link) return null;

  const embedSrc = resolveContentEmbedSrc(link);
  const openHref = resolveContentOpenHref(link);

  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Linked page view</p>
        <Button asChild size="sm" variant="outline">
          <a href={openHref} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            Open
          </a>
        </Button>
      </div>
      <div
        className={`overflow-hidden rounded-lg border border-amber-900/15 bg-white shadow-sm ${heightClassName}`}
      >
        <iframe title={title} src={embedSrc} className="h-full w-full border-0" />
      </div>
    </div>
  );
}
