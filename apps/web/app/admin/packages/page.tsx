'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { PackageAdmin } from '@/components/billing/package-admin';
import { PaymentsAdmin } from '@/components/billing/payments-admin';
import { BillingSettingsAdmin } from '@/components/billing/billing-settings-admin';

const TABS = [
  { id: 'exam_prep', label: 'Exam Preparation' },
  { id: 'basic', label: 'Basic Module' },
  { id: 'live', label: 'Live class' },
  { id: 'payments', label: 'Payments' },
  { id: 'settings', label: 'Settings' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function AdminPackagesContent() {
  const params = useSearchParams();
  const raw = params.get('tab');
  const tab: TabId = TABS.some((t) => t.id === raw) ? (raw as TabId) : 'exam_prep';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Packages & payments"
        description="Set package prices and durations, assign live classes, see payments and grant access manually."
      />
      <nav className="flex flex-wrap gap-2 border-b border-border pb-3">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin/packages?tab=${t.id}`}
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
      {tab === 'payments' ? <PaymentsAdmin /> : tab === 'settings' ? <BillingSettingsAdmin /> : <PackageAdmin kind={tab} />}
    </div>
  );
}

export default function AdminPackagesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <AdminPackagesContent />
    </Suspense>
  );
}
