'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { fetchMe } from '@/lib/auth';
import { isPlatformAdmin } from '@/lib/capabilities';
import { Skeleton } from '@/components/ui/skeleton';

export default function RegulationsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetchMe()
      .then((res) => {
        const isRegulationSearch = pathname === '/books/regulations';
        if (isRegulationSearch && !isPlatformAdmin(res.data)) {
          router.replace('/books');
          return;
        }
        setReady(true);
      })
      .catch(() => router.replace('/login'));
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
