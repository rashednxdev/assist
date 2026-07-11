'use client';

import { ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';

export default function Jsi2016Page() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-3 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="JSI 2016"
          description="যৌথ বাহিনী নির্দেশাবলী (জেএসআই) 01/2016 — static scanned reference"
        />
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <a href="/static-ref/jsi-2016/index.html" target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            Open fullscreen
          </a>
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <iframe
          title="JSI 2016 static reference"
          src="/static-ref/jsi-2016/index.html"
          className="h-full w-full border-0"
        />
      </div>
    </div>
  );
}
