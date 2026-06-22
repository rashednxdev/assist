'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { fetchMe } from '@/lib/auth';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/shared/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

interface PaperItem {
  id: string;
  name: string;
  session_year?: string;
  total_marks: number;
  pass_marks: number;
  duration_minutes: number;
  is_published: boolean;
  exam_subject_name?: string;
  exam_short_name?: string;
  paper_type_name?: string;
  question_count: number;
}

interface ExamName {
  id: string;
  short_name: string;
  name: string;
}

interface SubjectOption {
  id: string;
  label: string;
}

export default function PapersPage() {
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [exams, setExams] = useState<ExamName[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [examId, setExamId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [published, setPublished] = useState('');

  function load(sub?: string, pub?: string, admin = isAdmin) {
    setLoading(true);
    const params = new URLSearchParams();
    if (sub) params.set('exam_subject_id', sub);
    if (admin && (pub === 'true' || pub === 'false')) params.set('is_published', pub);
    const qs = params.toString() ? `?${params.toString()}` : '';
    apiFetch<{ data: PaperItem[] }>(`/papers${qs}`)
      .then((r) => setPapers(r.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    apiFetch<{ data: ExamName[] }>('/exams/names').then((r) => setExams(r.data));
    fetchMe()
      .then((res) => {
        const admin =
          res.data.is_super_admin || res.data.user_type === 'system_admin' || res.data.user_type === 'admin';
        setIsAdmin(admin);
        load(undefined, published, admin);
      })
      .catch(() => load());
  }, []);

  useEffect(() => {
    if (!examId) {
      setSubjects([]);
      return;
    }
    apiFetch<{ data: { parts: { name: string; subjects: { id: string; name: string }[] }[] } }>(
      `/exams/names/${examId}/tree`,
    )
      .then((r) => {
        const opts: SubjectOption[] = [];
        for (const part of r.data.parts) {
          for (const s of part.subjects) {
            opts.push({ id: s.id, label: `${part.name} → ${s.name}` });
          }
        }
        setSubjects(opts);
      })
      .catch(() => setSubjects([]));
  }, [examId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Question papers"
        description={
          isAdmin
            ? 'Compose, section, and publish practice and exam papers.'
            : 'Browse published practice and exam papers.'
        }
        action={
          isAdmin ? (
            <Button asChild size="sm">
              <Link href="/papers/new">
                <Plus className="h-4 w-4" />
                New paper
              </Link>
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Exam program</Label>
            <select
              value={examId}
              onChange={(e) => {
                setExamId(e.target.value);
                setSubjectId('');
              }}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All exams</option>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.short_name} — {e.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Subject</Label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              disabled={!examId}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {isAdmin && (
            <div>
              <Label>Status</Label>
              <select
                value={published}
                onChange={(e) => setPublished(e.target.value)}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">All</option>
                <option value="true">Published</option>
                <option value="false">Draft</option>
              </select>
            </div>
          )}
          <div className={`flex items-end ${isAdmin ? '' : 'sm:col-span-2 lg:col-span-1'}`}>
            <Button onClick={() => load(subjectId || undefined, published)} className="w-full">
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : papers.length === 0 ? (
        <EmptyState
          title={isAdmin ? 'No papers yet' : 'No published papers'}
          description={
            isAdmin
              ? 'Create a paper and add published questions from the question bank.'
              : 'Published papers will appear here when they are available.'
          }
          action={
            isAdmin ? (
              <Button asChild>
                <Link href="/papers/new">Create paper</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {papers.map((p) => (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">
                    <Link
                      href={isAdmin && !p.is_published ? `/papers/${p.id}/edit` : `/papers/${p.id}`}
                      className="hover:underline"
                    >
                      {p.name}
                    </Link>
                  </CardTitle>
                      <p className="mt-1 text-sm text-muted">
                        {p.exam_short_name && `${p.exam_short_name} · `}
                        {p.exam_subject_name}
                        {p.session_year ? ` · ${p.session_year}` : ''}
                      </p>
                </div>
                <Badge variant={p.is_published ? 'default' : 'outline'}>
                  {p.is_published ? 'Published' : 'Draft'}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 text-sm text-muted">
                <Badge variant="secondary">{p.paper_type_name ?? 'Paper'}</Badge>
                <span>{p.total_marks} marks</span>
                <span>{p.duration_minutes} min</span>
                <span>{p.question_count} questions</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
