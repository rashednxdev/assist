'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { SalaryUsageStatsRecord } from '@ibas/shared-types';

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function SalaryStatsAdminPage() {
  const [stats, setStats] = useState<SalaryUsageStatsRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ data: SalaryUsageStatsRecord }>('/salary/admin/stats')
      .then((r) => setStats(r.data))
      .catch(() => setError('Could not load salary calculator stats.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Salary calculator usage"
        description="Public /salary tool — counts are visible to admins only."
      />

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Calculate all phases</CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {loading ? <Skeleton className="h-9 w-20" /> : stats?.calculate_all_phases_count ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted">
              Last pressed: {loading ? '…' : formatWhen(stats?.last_calculate_at ?? null)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>PDF downloads</CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {loading ? <Skeleton className="h-9 w-20" /> : stats?.pdf_download_count ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted">
              Last download: {loading ? '…' : formatWhen(stats?.last_pdf_at ?? null)}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
