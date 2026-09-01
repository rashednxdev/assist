'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken, fetchMe, clearAccessToken, logoutRequest } from '@/lib/auth';
import { isPlatformAdmin } from '@/lib/capabilities';
import { AppShell } from '@/components/layout/app-shell';
import { Skeleton } from '@/components/ui/skeleton';

export default function GuidedTasksLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }
    fetchMe()
      .then((res) => {
        if (!isPlatformAdmin(res.data)) {
          void logoutRequest()
            .catch(() => clearAccessToken())
            .finally(() => router.replace('/unavailable'));
          return;
        }
        setReady(true);
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm space-y-3 rounded-xl border border-border bg-surface p-6 shadow-md">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
