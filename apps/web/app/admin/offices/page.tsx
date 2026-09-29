'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { OfficesAdmin } from '@/components/org/offices-admin';
import { DesignationsAdmin } from '@/components/org/designations-admin';
import { OfficeTypesAdmin } from '@/components/org/office-types-admin';

const TABS = [
  { id: 'offices', label: 'Offices' },
  { id: 'designations', label: 'Designations' },
  { id: 'types', label: 'Office types' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function AdminOfficesContent() {
  const params = useSearchParams();
  const raw = params.get('tab');
  const tab: TabId = TABS.some((t) => t.id === raw) ? (raw as TabId) : 'offices';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offices & designations"
        description="Manage offices and sub-offices, office types, and designations. Users pick their office and designation in their profile."
      />
      <nav className="flex flex-wrap gap-2 border-b border-border pb-3">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin/offices?tab=${t.id}`}
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
      {tab === 'designations' ? <DesignationsAdmin /> : tab === 'types' ? <OfficeTypesAdmin /> : <OfficesAdmin />}
    </div>
  );
}

export default function AdminOfficesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <AdminOfficesContent />
    </Suspense>
  );
}
