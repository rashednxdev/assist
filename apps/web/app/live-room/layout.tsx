'use client';

import { useLayoutEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearAccessToken, fetchMe, getAccessToken, peekMe } from '@/lib/auth';
import { SALARY_HOME, isSalaryOnlyUser } from '@/lib/salary-only';
import { Skeleton } from '@/components/ui/skeleton';

/** Minimal chrome for the Live Class control room (opened in a new tab). */
export default function LiveRoomLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    let live = true;
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }
    const open = (user: Parameters<typeof isSalaryOnlyUser>[0]) => {
      if (!live) return;
      if (isSalaryOnlyUser(user)) router.replace(SALARY_HOME);
      else setReady(true);
    };
    const cached = peekMe();
    if (cached) open(cached);
    fetchMe()
      .then((res) => open(res.data))
      .catch(() => {
        if (!live) return;
        clearAccessToken();
        router.replace('/login');
      });
    return () => {
      live = false;
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
        <div className="w-full max-w-sm space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <Skeleton className="h-6 w-40 bg-slate-800" />
          <Skeleton className="h-4 w-full bg-slate-800" />
        </div>
      </div>
    );
  }

  return <div className="min-h-screen bg-slate-950 text-slate-100">{children}</div>;
}
