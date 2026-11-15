'use client';

import { useLayoutEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearAccessToken, fetchMe, getAccessToken, peekMe, SET_PASSWORD_PATH, type MeUser } from '@/lib/auth';

/** Opens a signed-in page immediately when this browser already knows who is signed in. */
export function useCachedSession(): { ready: boolean; me: MeUser | null } {
  const router = useRouter();
  const [me, setMe] = useState<MeUser | null>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    let live = true;
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }
    const cached = peekMe();
    if (cached) {
      setMe(cached);
      setReady(true);
    }
    fetchMe()
      .then((res) => {
        if (!live) return;
        if (res.data.must_change_password) {
          router.replace(SET_PASSWORD_PATH);
          return;
        }
        setMe(res.data);
        setReady(true);
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

  return { ready, me };
}
