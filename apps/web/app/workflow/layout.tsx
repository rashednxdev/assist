'use client';

import { AppShell } from '@/components/layout/app-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { useCachedSession } from '@/lib/use-cached-session';

export default function WorkflowLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useCachedSession();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm space-y-3 rounded-xl border border-border bg-surface p-6 shadow-md">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
