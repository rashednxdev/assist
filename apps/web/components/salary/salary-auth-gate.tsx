'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchMe, getAccessToken, SET_PASSWORD_PATH } from '@/lib/auth';
import { Skeleton } from '@/components/ui/skeleton';

const LOGIN_PATH = '/login?next=%2Fsalary';

/** /salary is for registered, signed-in users only. */
export function SalaryAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace(LOGIN_PATH);
      return;
    }
    fetchMe()
      .then((res) => {
        if (res.data.must_change_password) router.replace(SET_PASSWORD_PATH);
        else if (res.data.status === 'pending_verify') router.replace('/register/verify');
        else setReady(true);
      })
      .catch(() => router.replace(LOGIN_PATH));
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f7f5] p-6">
        <div className="w-full max-w-sm space-y-3 rounded-xl border border-border bg-white p-6 shadow-md">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
