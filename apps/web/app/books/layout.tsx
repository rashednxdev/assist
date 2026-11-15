'use client';

import { usePathname } from 'next/navigation';
import { isPlatformAdmin } from '@/lib/capabilities';
import { AppShell } from '@/components/layout/app-shell';
import { CopyGuard } from '@/components/content/copy-guard';
import { Skeleton } from '@/components/ui/skeleton';
import { useCachedSession } from '@/lib/use-cached-session';

export default function BooksLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready, me } = useCachedSession();
  const admin = isPlatformAdmin(me);

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

  const protect = !admin && !pathname.startsWith('/books/admin');
  return (
    <AppShell>
      {protect ? (
        <CopyGuard>
          <div className="learner-app -mx-4 bg-[#f4f7fb] px-4 py-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            {children}
          </div>
        </CopyGuard>
      ) : (
        children
      )}
    </AppShell>
  );
}
