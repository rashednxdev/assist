'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import type { QotdDateDetail } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { daysFromToday, formatLongDate } from '@/lib/date-display';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

function truncate(text: string, len = 180) {
  return text.length > len ? `${text.slice(0, len)}…` : text;
}

export default function QotdDatePage() {
  const { date } = useParams<{ date: string }>();
  const [detail, setDetail] = useState<QotdDateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!date) return;
    apiFetch<{ data: QotdDateDetail }>(`/qotd/dates/${date}`)
      .then((res) => setDetail(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [date]);

  const total = detail?.groups.reduce((sum, g) => sum + g.questions.length, 0) ?? 0;
  const kicker = date && daysFromToday(date) === 0 ? 'Today' : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={date ? formatLongDate(date) : 'Questions of the Day'}
        description={
          detail
            ? `${kicker ? `${kicker} · ` : ''}${detail.groups.length} subject${detail.groups.length === 1 ? '' : 's'} · ${total} question${total === 1 ? '' : 's'}`
            : undefined
        }
        backHref="/qotd"
        backLabel="All dates"
      />

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !detail || detail.groups.length === 0 ? (
        !error && <EmptyState title="No questions for this date" />
      ) : (
        detail.groups.map((group) => (
          <section key={group.entry_id} className="space-y-2">
            <div className="flex items-center justify-between gap-2 border-b border-emerald-100 pb-2">
              <h2 className="font-semibold text-emerald-800">{group.subject_name}</h2>
              <span className="text-xs text-muted">
                {group.questions.length} question{group.questions.length === 1 ? '' : 's'}
              </span>
            </div>
            {group.questions.map((q, i) => (
              <Link
                key={q.id}
                href={`/questions/${q.id}`}
                className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm transition-all hover:border-emerald-300 hover:shadow-md"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium leading-relaxed">{truncate(q.body_en || q.body_bn || '')}</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <Badge variant="secondary">{q.question_type_code}</Badge>
                    {q.marks ? <span>{q.marks} marks</span> : null}
                    {q.book_name ? <span>· {q.book_name}</span> : null}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
              </Link>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
