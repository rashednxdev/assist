'use client';

import { AppShell } from '@/components/layout/app-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { useCachedSession } from '@/lib/use-cached-session';

export default function StaticRefLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useCachedSession();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
