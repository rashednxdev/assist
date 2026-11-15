'use client';

import { useLayoutEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { fetchMe, peekMe, type MeUser } from '@/lib/auth';
import { isPlatformAdmin } from '@/lib/capabilities';
import { Skeleton } from '@/components/ui/skeleton';

export default function RegulationsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    let live = true;
    const allow = (user: MeUser) => {
      const isRegulationSearch = pathname === '/books/regulations';
      if (isRegulationSearch && !isPlatformAdmin(user)) {
        router.replace('/books');
        return;
      }
      if (live) setReady(true);
    };
    const cached = peekMe();
    if (cached) allow(cached);
    fetchMe()
      .then((res) => {
        if (live) allow(res.data);
      })
      .catch(() => {
        if (live) router.replace('/login');
      });
    return () => {
      live = false;
    };
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return children;
}
