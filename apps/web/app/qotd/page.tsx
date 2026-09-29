'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronRight } from 'lucide-react';
import type { QotdDateSummary } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { daysFromToday, formatLongDate, parseLocalIsoDate } from '@/lib/date-display';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

type Bucket = 'today' | 'yesterday' | 'week' | 'earlier';
const BUCKET_ORDER: Bucket[] = ['today', 'yesterday', 'week', 'earlier'];
const BUCKET_LABEL: Record<Bucket, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'This week',
  earlier: 'Earlier',
};

function bucketFor(iso: string): Bucket {
  const days = daysFromToday(iso);
  if (days >= 0) return 'today';
  if (days === -1) return 'yesterday';
  if (days >= -6) return 'week';
  return 'earlier';
}

export default function QotdDatesPage() {
  const [dates, setDates] = useState<QotdDateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ data: QotdDateSummary[] }>('/qotd/dates')
      .then((res) => setDates(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dates'))
      .finally(() => setLoading(false));
  }, []);

  const groups = useMemo(() => {
    const map = new Map<Bucket, QotdDateSummary[]>();
    for (const row of dates) {
      const key = bucketFor(row.date);
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return BUCKET_ORDER.filter((k) => map.has(k)).map((k) => ({ key: k, items: map.get(k)! }));
  }, [dates]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Questions of the Day"
        description="Daily subject-wise questions. Open a date to read its questions and answers."
        backHref="/dashboard"
      />

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : dates.length === 0 ? (
        <EmptyState title="No questions published yet" description="Check back tomorrow for new questions." />
      ) : (
        groups.map((group) => (
          <section key={group.key} className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-700">{BUCKET_LABEL[group.key]}</h2>
            {group.items.map((row) => {
              const d = parseLocalIsoDate(row.date);
              return (
                <Link
                  key={row.date}
                  href={`/qotd/${row.date}`}
                  className="flex items-center gap-4 rounded-xl border border-emerald-100 bg-surface p-3 shadow-sm transition-all hover:border-emerald-300 hover:shadow-md"
                >
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-emerald-600 text-white">
                    {d ? (
                      <>
                        <span className="text-lg font-bold leading-none">{d.getDate()}</span>
                        <span className="text-[10px] uppercase">
                          {d.toLocaleDateString('en-GB', { month: 'short' })}
                        </span>
                      </>
                    ) : (
                      <CalendarDays className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{formatLongDate(row.date)}</p>
                    <p className="text-sm text-muted">
                      {row.subject_count} subject{row.subject_count === 1 ? '' : 's'} · {row.question_count} question
                      {row.question_count === 1 ? '' : 's'}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted" />
                </Link>
              );
            })}
          </section>
        ))
      )}
    </div>
  );
}
