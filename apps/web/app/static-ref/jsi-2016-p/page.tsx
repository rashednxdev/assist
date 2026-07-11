'use client';

import { ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';

export default function Jsi2016PPage() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-3 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="JSI 2016 P"
          description="যৌথ বাহিনী নির্দেশাবলী (জেএসআই) ১/২০১৬ — pay & pension reference (unicode text)"
        />
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <a href="/static-ref/jsi-2016-p/index.html" target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            Open fullscreen
          </a>
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <iframe
          title="JSI 2016 P static reference"
          src="/static-ref/jsi-2016-p/index.html"
          className="h-full w-full border-0"
        />
      </div>
    </div>
  );
}
