'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ProgressSummary } from '@/components/evaluation/progress-summary';
import { ProgressTree, type ProgressNode } from '@/components/evaluation/progress-tree';
import { bookTheme } from '@/lib/book-theme';

interface BookEvaluationData {
  book: { id: string; name: string; short_name: string };
  overall: ProgressNode;
}

export default function BookProgressPage() {
  const params = useParams();
  const bookId = params.id as string;
  const [data, setData] = useState<BookEvaluationData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: BookEvaluationData }>(`/evaluation/books/${bookId}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [bookId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Alert variant="error">{error || 'Could not load progress.'}</Alert>
        <Button asChild variant="outline">
          <Link href={`/books/${bookId}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to book
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Book progress"
        description={data.book.name}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={`/books/${bookId}`}>
              <ArrowLeft className="h-4 w-4" />
              Back to book
            </Link>
          </Button>
        }
      />

      <Card className={bookTheme.panel}>
        <CardHeader className={bookTheme.divider}>
          <CardTitle className="text-base">Overall performance</CardTitle>
        </CardHeader>
        <CardContent>
          <ProgressSummary
            percent={data.overall.progress_percent}
            rated={data.overall.rated_questions}
            total={data.overall.total_questions}
          />
          <p className="mt-3 text-sm text-muted">
            Each linked question counts equally toward 100%. MCQ/True–False are scored from your
            answers (0% or 100%). Other types use self-rating: Overall 50%, Understand 75%,
            Confidence 100%. Ratings follow the question everywhere it is linked.
          </p>
        </CardContent>
      </Card>

      <Card className={bookTheme.panel}>
        <CardHeader className={bookTheme.divider}>
          <CardTitle className="text-base">Chapter / topic progress</CardTitle>
        </CardHeader>
        <CardContent>
          <ProgressTree node={data.overall} />
        </CardContent>
      </Card>
    </div>
  );
}
