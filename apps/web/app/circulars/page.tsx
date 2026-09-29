'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { Archive } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { CircularBrowser } from '@/components/circulars/circular-browser';

export default function CircularsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Circular Archive"
        description="Government circulars, orders, SROs, gazettes and office orders — search by order no., subject, ministry, wing or tag."
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/books?tab=circulars">Books &amp; Tools</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/policy">Policy library</Link>
            </Button>
          </div>
        }
      />
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-sm text-muted">
            <Archive className="h-4 w-4" /> Loading archive…
          </div>
        }
      >
        <CircularBrowser />
      </Suspense>
    </div>
  );
}
