'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchMe, getAccessToken, SET_PASSWORD_PATH, type MeUser } from '@/lib/auth';
import { Skeleton } from '@/components/ui/skeleton';

const LOGIN_PATH = '/login?next=%2Fsalary';

const SalaryUserContext = createContext<MeUser | null>(null);

export function useSalaryUser(): MeUser | null {
  return useContext(SalaryUserContext);
}

/** /salary is for registered, signed-in users only. */
export function SalaryAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<MeUser | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace(LOGIN_PATH);
      return;
    }
    fetchMe()
      .then((res) => {
        if (res.data.must_change_password) router.replace(SET_PASSWORD_PATH);
        else if (res.data.status === 'pending_verify') router.replace('/register/verify');
        else setMe({ ...res.data, module_access: res.data.module_access ?? [] });
      })
      .catch(() => router.replace(LOGIN_PATH));
  }, [router]);

  if (!me) {
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

  return <SalaryUserContext.Provider value={me}>{children}</SalaryUserContext.Provider>;
}
