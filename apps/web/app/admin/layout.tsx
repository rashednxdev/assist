'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isPlatformAdmin } from '@/lib/capabilities';
import { AppShell } from '@/components/layout/app-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { useCachedSession } from '@/lib/use-cached-session';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { ready, me } = useCachedSession();
  const admin = isPlatformAdmin(me);

  useEffect(() => {
    if (ready && me && !admin) router.replace('/learning');
  }, [ready, me, admin, router]);

  if (!ready || !admin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm space-y-3 rounded-xl border border-border bg-surface p-6 shadow-md">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
