'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { formatDateTimeDdMmYyyy } from '@/lib/date-display';
import type { ProgressDashboardData } from '@/lib/progress';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

function Bar({ percent, className = 'bg-primary' }: { percent: number; className?: string }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
      <div className={`h-2.5 rounded-full ${className}`} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </div>
  );
}

export default function ProgressPage() {
  const [data, setData] = useState<ProgressDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ data: ProgressDashboardData }>('/evaluation/dashboard')
      .then((res) => setData(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load progress'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    );
  }

  const empty =
    data && data.mcq.submitted === 0 && data.papers.attempted === 0 && data.exam_attempts.total_attempts === 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Progress Dashboard"
        description="Only evaluations you have submitted are counted here."
        backHref="/dashboard"
      />

      {error && <Alert variant="error">{error}</Alert>}

      {data && (
        <div className="grid gap-4 rounded-2xl bg-gradient-to-br from-primary-dark to-primary p-6 text-white sm:grid-cols-3">
          <div>
            <p className="text-3xl font-bold">{data.mcq.submitted}</p>
            <p className="text-sm text-white/80">MCQs answered</p>
          </div>
          <div>
            <p className="text-3xl font-bold">{data.papers.attempted}</p>
            <p className="text-sm text-white/80">Papers started</p>
          </div>
          <div>
            <p className="text-3xl font-bold">{data.mcq.accuracy_percent}%</p>
            <p className="text-sm text-white/80">MCQ accuracy</p>
          </div>
        </div>
      )}

      {empty ? (
        <EmptyState
          title="No progress yet"
          description="Answer MCQs or rate questions in an exam paper to start tracking progress."
          action={
            <Button asChild size="sm">
              <Link href="/papers">Open exam papers</Link>
            </Button>
          }
        />
      ) : (
        data && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted">MCQ results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Bar percent={data.mcq.accuracy_percent} className="bg-emerald-500" />
                  <p className="text-sm">
                    <span className="font-semibold text-emerald-700">{data.mcq.correct} correct</span> ·{' '}
                    <span className="font-semibold text-red-600">{data.mcq.incorrect} incorrect</span>
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted">Paper progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Bar percent={data.papers.average_progress_percent} />
                  <p className="text-sm">
                    {data.papers.rated_questions}/{data.papers.total_questions} questions rated ·{' '}
                    {data.papers.average_progress_percent}% average
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted">MCQ exams</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-3xl font-bold">{data.exam_attempts.total_attempts}</p>
                  <p className="text-sm text-muted">
                    attempts · {data.exam_attempts.papers_passed}/{data.exam_attempts.papers_attempted} papers passed
                  </p>
                </CardContent>
              </Card>
            </div>

            {data.exam_attempts.items.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">MCQ exam results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.exam_attempts.items.map((item) => (
                    <Link
                      key={item.paper_id}
                      href={`/papers/${item.paper_id}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm transition-colors hover:border-primary/30"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.paper_name}</p>
                        <p className="text-muted">
                          Best {item.best_scored_marks}/{item.best_total_marks} · {item.attempts_count} attempt
                          {item.attempts_count === 1 ? '' : 's'} · last {formatDateTimeDdMmYyyy(item.last_submitted_at)}
                        </p>
                      </div>
                      <Badge variant={item.is_pass ? 'success' : 'warning'}>
                        {item.best_percent}% · {item.is_pass ? 'Pass' : 'Fail'}
                      </Badge>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )
      )}
    </div>
  );
}
