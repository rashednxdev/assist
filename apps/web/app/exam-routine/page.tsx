'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Timer } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { daysFromToday, formatDdMmYyyy } from '@/lib/date-display';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

interface RoutineListItem {
  exam_name_id: string;
  exam_name: string;
  start_date: string;
  start_date_note?: string;
}

function countdownLabel(days: number): string {
  if (days > 0) return `${days} day${days === 1 ? '' : 's'} left`;
  if (days === 0) return 'Today';
  return `${Math.abs(days)} day${days === -1 ? '' : 's'} ago`;
}

export default function ExamRoutineListPage() {
  const [items, setItems] = useState<RoutineListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ data: RoutineListItem[] }>('/exam-routine/list')
      .then((res) => setItems(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load routines'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Exam Routine"
        description="Exam schedules, countdowns, and subject-wise instructions."
        backHref="/dashboard"
      />

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="No exam routines yet" description="Routines appear here once they are published." />
      ) : (
        <div className="space-y-2">
          {items.map((r) => {
            const days = daysFromToday(r.start_date);
            return (
              <Link
                key={r.exam_name_id}
                href={`/exam-routine/${r.exam_name_id}`}
                className="flex items-center gap-4 rounded-xl border border-orange-100 bg-surface p-4 shadow-sm transition-all hover:border-orange-300 hover:shadow-md"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-orange-900 text-white">
                  <Timer className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{r.exam_name}</p>
                  <p className="text-sm text-muted">
                    Starts {formatDdMmYyyy(r.start_date)}
                    {r.start_date_note?.trim() ? ` · ${r.start_date_note.trim()}` : ''}
                  </p>
                </div>
                <span
                  className={
                    days >= 0
                      ? 'shrink-0 rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-900'
                      : 'shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600'
                  }
                >
                  {countdownLabel(days)}
                </span>
                <ChevronRight className="h-5 w-5 text-muted" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
