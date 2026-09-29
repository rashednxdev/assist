'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronRight, FileText } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { formatDdMmYyyy } from '@/lib/date-display';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface ExamWeekPaper {
  id: string;
  name: string;
  session_year?: string;
  total_marks: number;
  pass_marks: number;
  duration_minutes: number;
  exam_subject_name?: string;
  exam_short_name?: string;
  paper_type_name?: string;
  question_count: number;
}

export default function ExamWeekPapersPage() {
  const { weekStart } = useParams<{ weekStart: string }>();
  const [papers, setPapers] = useState<ExamWeekPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!weekStart) return;
    apiFetch<{ data: ExamWeekPaper[] }>(`/papers/exam-week/weeks/${weekStart}`)
      .then((res) => setPapers(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load papers'))
      .finally(() => setLoading(false));
  }, [weekStart]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={`Week of ${weekStart ? formatDdMmYyyy(weekStart) : ''}`}
        description="Featured exam papers for this week."
        backHref="/exam-week"
        backLabel="All weeks"
      />

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : papers.length === 0 ? (
        !error && <EmptyState title="No papers for this week" />
      ) : (
        <div className="space-y-2">
          {papers.map((p) => (
            <Link
              key={p.id}
              href={`/papers/${p.id}`}
              className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm transition-all hover:border-violet-300 hover:shadow-md"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-semibold">{p.name}</p>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  {p.exam_short_name && <Badge variant="secondary">{p.exam_short_name}</Badge>}
                  {p.paper_type_name && <Badge variant="outline">{p.paper_type_name}</Badge>}
                  {p.exam_subject_name && <span>{p.exam_subject_name}</span>}
                  {p.session_year && <span>· {p.session_year}</span>}
                </div>
                <p className="text-xs text-muted">
                  {p.question_count} question{p.question_count === 1 ? '' : 's'} · {p.total_marks} marks · pass{' '}
                  {p.pass_marks} · {p.duration_minutes} min
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
