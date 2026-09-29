'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Trophy } from 'lucide-react';
import type { ExamWeekSummary } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { daysFromToday, formatDdMmYyyy } from '@/lib/date-display';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function ExamWeeksPage() {
  const [weeks, setWeeks] = useState<ExamWeekSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ data: ExamWeekSummary[] }>('/papers/exam-week/weeks')
      .then((res) => setWeeks(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load weeks'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Exams of the Week"
        description="Featured exam papers, grouped by week."
        backHref="/dashboard"
      />

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : weeks.length === 0 ? (
        !error && <EmptyState title="No featured weeks yet" description="Featured exam papers appear here each week." />
      ) : (
        <div className="space-y-2">
          {weeks.map((w) => {
            const current = daysFromToday(w.week_start) <= 0 && daysFromToday(w.week_end) >= 0;
            return (
              <Link
                key={w.week_start}
                href={`/exam-week/${w.week_start}`}
                className="flex items-center gap-4 rounded-xl border border-violet-100 bg-surface p-4 shadow-sm transition-all hover:border-violet-300 hover:shadow-md"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white">
                  <Trophy className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">
                      {formatDdMmYyyy(w.week_start)} – {formatDdMmYyyy(w.week_end)}
                    </p>
                    {current && <Badge variant="success">This week</Badge>}
                  </div>
                  <p className="text-sm text-muted">
                    {w.paper_count} paper{w.paper_count === 1 ? '' : 's'}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
