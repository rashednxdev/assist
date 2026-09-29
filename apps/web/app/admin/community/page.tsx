'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { MessagesSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CommunityCategoriesAdmin, CommunityReportsAdmin } from '@/components/community/community-admin';

const TABS = [
  { id: 'reports', label: 'Reports' },
  { id: 'categories', label: 'Categories' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function AdminCommunityContent() {
  const params = useSearchParams();
  const raw = params.get('tab');
  const tab: TabId = TABS.some((t) => t.id === raw) ? (raw as TabId) : 'reports';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Community moderation"
        description="Review reported posts and manage discussion categories. Pin, lock or hide a discussion from its own page."
        action={
          <Button asChild variant="outline">
            <Link href="/community">
              <MessagesSquare className="h-4 w-4" /> Open community
            </Link>
          </Button>
        }
      />
      <nav className="flex flex-wrap gap-2 border-b border-border pb-3">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin/community?tab=${t.id}`}
            replace
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              tab === t.id ? 'bg-primary-muted text-primary-dark' : 'text-muted hover:bg-slate-100 hover:text-foreground',
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === 'categories' ? <CommunityCategoriesAdmin /> : <CommunityReportsAdmin />}
    </div>
  );
}

export default function AdminCommunityPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <AdminCommunityContent />
    </Suspense>
  );
}
