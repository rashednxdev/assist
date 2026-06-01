'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GraduationCap, Plus, Settings } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { fetchMe } from '@/lib/auth';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

interface ExamItem {
  id: string;
  name: string;
  short_name: string;
  authority_name?: string;
  registration_fee: number;
  goal?: string;
}

export default function ExamsPage() {
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    apiFetch<{ data: ExamItem[] }>('/exams/names')
      .then((r) => setExams(r.data))
      .finally(() => setLoading(false));
    fetchMe()
      .then((res) => {
        setIsAdmin(
          res.data.is_super_admin || res.data.user_type === 'system_admin' || res.data.user_type === 'admin',
        );
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Examinations"
        description="SAS, SRAS and other government accounts examinations."
        action={
          isAdmin ? (
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/exams/admin">
                  <Settings className="h-4 w-4" />
                  Exam setup
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/exams/admin">
                  <Plus className="h-4 w-4" />
                  Configure
                </Link>
              </Button>
            </div>
          ) : undefined
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Exam programs</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : exams.length === 0 ? (
            <EmptyState
              title="No exams configured"
              description={
                isAdmin
                  ? 'Use Exam setup to create department → authority → exam hierarchy, or run pnpm seed.'
                  : 'No examination programs are available yet.'
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {exams.map((exam) => (
                <Link
                  key={exam.id}
                  href={`/exams/${exam.id}`}
                  className="group rounded-xl border border-border bg-slate-50/50 p-4 transition-colors hover:border-primary/40 hover:bg-primary-muted/30"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold group-hover:text-primary">{exam.name}</div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant="outline">{exam.short_name}</Badge>
                        {exam.authority_name && <Badge variant="secondary">{exam.authority_name}</Badge>}
                        <Badge variant="outline">৳{exam.registration_fee} fee</Badge>
                      </div>
                      {exam.goal && <p className="mt-2 line-clamp-2 text-sm text-muted">{exam.goal}</p>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
