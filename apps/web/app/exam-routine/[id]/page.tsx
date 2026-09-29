'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ChevronDown, ChevronUp, Clock } from 'lucide-react';
import type { ExamRoutineDetail } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { daysFromToday, formatDdMmYyyy, parseLocalIsoDate } from '@/lib/date-display';
import { PageHeader } from '@/components/shared/page-header';
import { RichTextView } from '@/components/books/rich-text-view';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

/** "HH:mm" (24h, as stored) -> "h:mm AM/PM". */
function formatTime12h(time: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) return time;
  const hour24 = Number(m[1]);
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${m[2]} ${hour24 >= 12 ? 'PM' : 'AM'}`;
}

export default function ExamRoutineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [routine, setRoutine] = useState<ExamRoutineDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    apiFetch<{ data: ExamRoutineDetail }>(`/exam-routine/names/${id}`)
      .then((res) => setRoutine(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!routine) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <PageHeader title="Exam Routine" backHref="/exam-routine" />
        <Alert variant="error">{error || 'Routine not found'}</Alert>
      </div>
    );
  }

  const days = daysFromToday(routine.start_date);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={routine.exam_name} backHref="/exam-routine" backLabel="All routines" />

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-br from-orange-900 to-orange-700 p-6 text-white">
        <div>
          <p className="text-sm text-orange-100">Starts {formatDdMmYyyy(routine.start_date)}</p>
          {routine.start_date_note?.trim() ? (
            <p className="mt-1 text-sm text-orange-100/90">{routine.start_date_note.trim()}</p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-4xl font-bold leading-none">{Math.abs(days)}</p>
          <p className="text-sm text-orange-100">{days > 0 ? 'days left' : days === 0 ? 'today' : 'days ago'}</p>
        </div>
      </div>

      {routine.entries.length === 0 ? (
        <p className="text-sm text-muted">No subjects added to this routine yet.</p>
      ) : (
        <div className="space-y-2">
          {routine.entries.map((e) => {
            const d = parseLocalIsoDate(e.date);
            const open = expanded === e.id;
            return (
              <div key={e.id} className="rounded-xl border border-border bg-surface shadow-sm">
                <button
                  type="button"
                  disabled={!e.instruction}
                  onClick={() => setExpanded(open ? null : e.id)}
                  className="flex w-full items-center gap-4 p-4 text-left"
                >
                  <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-orange-50 py-1.5 text-orange-900">
                    <span className="text-[10px] font-bold uppercase">
                      {d?.toLocaleDateString('en-GB', { weekday: 'short' })}
                    </span>
                    <span className="text-xl font-bold leading-tight">{e.date.slice(8, 10)}</span>
                    <span className="text-[10px] font-semibold uppercase">
                      {d?.toLocaleDateString('en-GB', { month: 'short' })}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{e.subject_name}</p>
                    <p className="text-sm text-muted">
                      {d?.toLocaleDateString('en-GB', { weekday: 'long' })}, {formatDdMmYyyy(e.date)}
                    </p>
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-900">
                      <Clock className="h-3 w-3" />
                      {formatTime12h(e.time)}
                    </span>
                  </div>
                  {e.instruction ? (
                    open ? (
                      <ChevronUp className="h-5 w-5 text-muted" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted" />
                    )
                  ) : null}
                </button>
                {open && e.instruction ? (
                  <div className="border-t border-border px-4 py-3">
                    <RichTextView html={e.instruction} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
