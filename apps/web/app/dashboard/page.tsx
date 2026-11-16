'use client';

import { useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import { clearAccessToken, fetchMe, getAccessToken, peekMe, SET_PASSWORD_PATH } from '@/lib/auth';
import { homePathFor } from '@/lib/learning-access';

/**
 * Signed-in home is a redirect only: Learning when that access is granted, otherwise Salary.
 * Uses the profile already in memory, and never loads the admin overview.
 */
export default function DashboardPage() {
  const router = useRouter();

  useLayoutEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }
    const cached = peekMe();
    if (cached) {
      router.replace(cached.must_change_password ? SET_PASSWORD_PATH : homePathFor(cached));
      return;
    }
    let live = true;
    fetchMe()
      .then((res) => {
        if (!live) return;
        router.replace(res.data.must_change_password ? SET_PASSWORD_PATH : homePathFor(res.data));
      })
      .catch(() => {
        if (!live) return;
        clearAccessToken();
        router.replace('/login');
      });
    return () => {
      live = false;
    };
  }, [router]);

  return null;
}
