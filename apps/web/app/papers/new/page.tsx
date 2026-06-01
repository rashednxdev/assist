'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';

interface PaperType {
  id: string;
  name: string;
  code: string;
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

export default function NewPaperPage() {
  const router = useRouter();
  const [types, setTypes] = useState<PaperType[]>([]);
  const [exams, setExams] = useState<ExamName[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    examId: '',
    exam_subject_id: '',
    paper_type_id: '',
    name: '',
    total_marks: 100,
    pass_marks: 40,
    duration_minutes: 180,
    instructions: '',
  });

  useEffect(() => {
    apiFetch<{ data: PaperType[] }>('/papers/types').then((r) => setTypes(r.data));
    apiFetch<{ data: ExamName[] }>('/exams/names').then((r) => setExams(r.data));
  }, []);

  useEffect(() => {
    if (!form.examId) {
      setSubjects([]);
      return;
    }
    apiFetch<{ data: { parts: { name: string; subjects: { id: string; name: string }[] }[] } }>(
      `/exams/names/${form.examId}/tree`,
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
  }, [form.examId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await apiFetch<{ data: { id: string } }>('/papers', {
        method: 'POST',
        body: JSON.stringify({
          exam_subject_id: form.exam_subject_id,
          paper_type_id: form.paper_type_id,
          name: form.name,
          total_marks: form.total_marks,
          pass_marks: form.pass_marks,
          duration_minutes: form.duration_minutes,
          instructions: form.instructions || undefined,
        }),
      });
      router.push(`/papers/${res.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create paper');
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="New question paper"
        description="Create a draft paper, then add sections and questions in the composer."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/papers">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paper details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Exam program</Label>
              <select
                required
                value={form.examId}
                onChange={(e) => setForm((f) => ({ ...f, examId: e.target.value, exam_subject_id: '' }))}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select exam</option>
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
                required
                value={form.exam_subject_id}
                onChange={(e) => setForm((f) => ({ ...f, exam_subject_id: e.target.value }))}
                disabled={!form.examId}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Paper type</Label>
              <select
                required
                value={form.paper_type_id}
                onChange={(e) => setForm((f) => ({ ...f, paper_type_id: e.target.value }))}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select type</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Paper name</Label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. GFR Practice Paper — Set 1"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label>Total marks</Label>
                <Input
                  type="number"
                  required
                  min={1}
                  value={form.total_marks}
                  onChange={(e) => setForm((f) => ({ ...f, total_marks: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Pass marks</Label>
                <Input
                  type="number"
                  required
                  min={0}
                  value={form.pass_marks}
                  onChange={(e) => setForm((f) => ({ ...f, pass_marks: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  required
                  min={1}
                  value={form.duration_minutes}
                  onChange={(e) => setForm((f) => ({ ...f, duration_minutes: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div>
              <Label>Instructions (optional)</Label>
              <Input
                value={form.instructions}
                onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
                placeholder="Instructions shown to candidates"
              />
            </div>
            <Button type="submit">Create & open composer</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
