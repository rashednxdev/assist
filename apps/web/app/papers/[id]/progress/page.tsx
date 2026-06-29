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

interface PaperEvaluationData {
  paper: { id: string; name: string; total_marks: number; pass_marks: number };
  overall: ProgressNode;
}

export default function PaperProgressPage() {
  const params = useParams();
  const paperId = params.id as string;
  const [data, setData] = useState<PaperEvaluationData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: PaperEvaluationData }>(`/evaluation/papers/${paperId}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [paperId]);

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
          <Link href={`/papers/${paperId}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to paper
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paper evaluation"
        description={data.paper.name}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={`/papers/${paperId}`}>
              <ArrowLeft className="h-4 w-4" />
              Back to paper
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Overall performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ProgressSummary
            percent={data.overall.progress_percent}
            rated={data.overall.rated_questions}
            total={data.overall.total_questions}
          />
          <p className="text-sm text-muted">
            Pass marks on paper: {data.paper.pass_marks} / {data.paper.total_marks}. Progress index
            is the average mastery across all questions on this paper (including composite sub-parts).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Section / question progress</CardTitle>
        </CardHeader>
        <CardContent>
          <ProgressTree node={data.overall} />
        </CardContent>
      </Card>
    </div>
  );
}
