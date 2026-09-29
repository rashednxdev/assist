'use client';

import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { CommunityBrowser } from '@/components/community/community-browser';

export default function CommunityPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 rounded-3xl" />}>
      <CommunityBrowser />
    </Suspense>
  );
}
