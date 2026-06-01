'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookMarked } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ExamSubject {
  id: string;
  name: string;
  total_marks: number;
  pass_marks: number;
  exam_type_name?: string;
}

interface ExamPart {
  id: string;
  name: string;
  part_number: number;
  total_marks: number;
  pass_marks: number;
  subjects: ExamSubject[];
}

interface ExamTree {
  exam: {
    id: string;
    name: string;
    short_name: string;
    registration_fee: number;
    authority_name?: string;
  };
  parts: ExamPart[];
  types: { id: string; name: string; code?: string; total_time: number }[];
}

export default function ExamDetailPage() {
  const params = useParams();
  const examId = params.id as string;
  const [tree, setTree] = useState<ExamTree | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    return apiFetch<{ data: ExamTree }>(`/exams/names/${examId}/tree`).then((r) => setTree(r.data));
  }, [examId]);

  useEffect(() => {
    reload()
      .catch(() => setTree(null))
      .finally(() => setLoading(false));
  }, [reload]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!tree) {
    return <p className="text-muted">Exam not found.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={tree.exam.name}
        description={`${tree.exam.short_name} · ${tree.exam.authority_name ?? 'Examination program'}`}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/exams">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">Registration ৳{tree.exam.registration_fee}</Badge>
        {tree.types.map((t) => (
          <Badge key={t.id} variant="secondary">
            {t.name} · {t.total_time} min
          </Badge>
        ))}
      </div>

      {tree.parts.map((part) => (
        <Card key={part.id}>
          <CardHeader>
            <CardTitle className="text-lg">
              Part {part.part_number}: {part.name}
            </CardTitle>
            <p className="text-sm text-muted">
              {part.total_marks} marks total · pass {part.pass_marks}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {part.subjects.length === 0 ? (
              <p className="text-sm text-muted">No subjects yet.</p>
            ) : (
              part.subjects.map((sub) => (
                <div
                  key={sub.id}
                  className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-medium">{sub.name}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {sub.exam_type_name && <Badge variant="outline">{sub.exam_type_name}</Badge>}
                      <Badge variant="secondary">
                        {sub.total_marks} marks · pass {sub.pass_marks}
                      </Badge>
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/exams/subjects/${sub.id}/syllabus`}>
                      <BookMarked className="h-4 w-4" />
                      Syllabus
                    </Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
