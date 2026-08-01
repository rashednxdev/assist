'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { fetchMe } from '@/lib/auth';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/shared/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

interface PaperItem {
  id: string;
  name: string;
  session_year?: string;
  exam_session_id?: string;
  exam_subject_id: string;
  paper_type_id: string;
  total_marks: number;
  pass_marks: number;
  duration_minutes: number;
  instructions?: string;
  is_published: boolean;
  is_exam_of_week: boolean;
  exam_subject_name?: string;
  exam_short_name?: string;
  exam_name_id?: string;
  session_label_en?: string;
  session_label_bn?: string;
  paper_type_name?: string;
  question_count: number;
}

interface ExamName {
  id: string;
  short_name: string;
  name: string;
}

interface SessionOption {
  id: string;
  label_en: string;
  label_bn?: string;
}

interface SubjectOption {
  id: string;
  label: string;
}

interface PaperType {
  id: string;
  name: string;
  code: string;
}

const emptyEditForm = {
  examId: '',
  exam_session_id: '',
  exam_subject_id: '',
  paper_type_id: '',
  name: '',
  total_marks: 100,
  pass_marks: 40,
  duration_minutes: 180,
  instructions: '',
};

export default function PapersPage() {
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [exams, setExams] = useState<ExamName[]>([]);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [filterSessions, setFilterSessions] = useState<SessionOption[]>([]);
  const [filterSubjects, setFilterSubjects] = useState<SubjectOption[]>([]);
  const [editSubjects, setEditSubjects] = useState<SubjectOption[]>([]);
  const [types, setTypes] = useState<PaperType[]>([]);
  const [examId, setExamId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [published, setPublished] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [editBusy, setEditBusy] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [editError, setEditError] = useState('');
  const [editMessage, setEditMessage] = useState('');

  function load(sub?: string, sess?: string, pub?: string, admin = isAdmin) {
    setLoading(true);
    const params = new URLSearchParams();
    if (sub) params.set('exam_subject_id', sub);
    if (sess) params.set('exam_session_id', sess);
    if (admin && (pub === 'true' || pub === 'false')) params.set('is_published', pub);
    const qs = params.toString() ? `?${params.toString()}` : '';
    apiFetch<{ data: PaperItem[] }>(`/papers${qs}`)
      .then((r) => setPapers(r.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    apiFetch<{ data: ExamName[] }>('/exams/names').then((r) => setExams(r.data));
    apiFetch<{ data: PaperType[] }>('/papers/types').then((r) => setTypes(r.data));
    fetchMe()
      .then((res) => {
        const admin =
          res.data.is_super_admin || res.data.user_type === 'system_admin' || res.data.user_type === 'admin';
        setIsAdmin(admin);
        load(undefined, undefined, published, admin);
      })
      .catch(() => load());
  }, []);

  useEffect(() => {
    if (!examId) {
      setFilterSessions([]);
      setFilterSubjects([]);
      return;
    }
    apiFetch<{ data: SessionOption[] }>(`/exams/names/${examId}/sessions`)
      .then((r) => setFilterSessions(r.data))
      .catch(() => setFilterSessions([]));
    apiFetch<{
      data: { parts: { name: string; subjects: { id: string; name: string }[] }[] };
    }>(`/exams/names/${examId}/tree`)
      .then((r) => {
        const opts: SubjectOption[] = [];
        for (const part of r.data.parts) {
          for (const s of part.subjects) {
            opts.push({ id: s.id, label: `${part.name} → ${s.name}` });
          }
        }
        setFilterSubjects(opts);
      })
      .catch(() => setFilterSubjects([]));
  }, [examId]);

  useEffect(() => {
    if (!editForm.examId) {
      setSessions([]);
      return;
    }
    apiFetch<{ data: SessionOption[] }>(`/exams/names/${editForm.examId}/sessions`)
      .then((r) => setSessions(r.data))
      .catch(() => setSessions([]));
  }, [editForm.examId]);

  useEffect(() => {
    if (!editForm.examId) {
      setEditSubjects([]);
      return;
    }
    apiFetch<{
      data: { parts: { name: string; subjects: { id: string; name: string }[] }[] };
    }>(`/exams/names/${editForm.examId}/tree`)
      .then((r) => {
        const opts: SubjectOption[] = [];
        for (const part of r.data.parts) {
          for (const s of part.subjects) {
            opts.push({ id: s.id, label: `${part.name} → ${s.name}` });
          }
        }
        setEditSubjects(opts);
      })
      .catch(() => setEditSubjects([]));
  }, [editForm.examId]);

  async function openEdit(paper: PaperItem) {
    setEditError('');
    setEditMessage('');
    setEditingId(paper.id);
    let resolvedExamId = paper.exam_name_id ?? '';
    if (!resolvedExamId && paper.exam_subject_id) {
      try {
        const sub = await apiFetch<{ data: { exam_name_id?: string } }>(`/exams/subjects/${paper.exam_subject_id}`);
        resolvedExamId = sub.data.exam_name_id ?? '';
      } catch {
        resolvedExamId = '';
      }
    }
    setEditForm({
      examId: resolvedExamId,
      exam_session_id: paper.exam_session_id ?? '',
      exam_subject_id: paper.exam_subject_id,
      paper_type_id: paper.paper_type_id,
      name: paper.name,
      total_marks: paper.total_marks,
      pass_marks: paper.pass_marks,
      duration_minutes: paper.duration_minutes,
      instructions: paper.instructions ?? '',
    });
  }

  function closeEdit() {
    setEditingId('');
    setEditForm(emptyEditForm);
    setEditError('');
    setEditMessage('');
  }

  async function removePaper(paper: PaperItem) {
    if (
      !confirm(
        `Delete "${paper.name}"? This removes the paper and all its sections and questions.`,
      )
    ) {
      return;
    }
    setDeletingId(paper.id);
    setDeleteError('');
    try {
      await apiFetch(`/papers/${paper.id}`, { method: 'DELETE' });
      if (editingId === paper.id) closeEdit();
      load(subjectId || undefined, sessionId || undefined, published);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingId('');
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditBusy(true);
    setEditError('');
    setEditMessage('');
    try {
      await apiFetch(`/papers/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          exam_subject_id: editForm.exam_subject_id,
          exam_session_id: editForm.exam_session_id,
          paper_type_id: editForm.paper_type_id,
          name: editForm.name,
          total_marks: editForm.total_marks,
          pass_marks: editForm.pass_marks,
          duration_minutes: editForm.duration_minutes,
          instructions: editForm.instructions || undefined,
        }),
      });
      setEditMessage('Paper updated');
      closeEdit();
      load(subjectId || undefined, sessionId || undefined, published);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setEditBusy(false);
    }
  }

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

      {isAdmin && editingId && (
        <Card className="border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Edit paper details</CardTitle>
            <Button type="button" size="sm" variant="ghost" onClick={closeEdit}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {editError && <Alert variant="error" className="mb-4">{editError}</Alert>}
            {editMessage && <Alert variant="success" className="mb-4">{editMessage}</Alert>}
            <form onSubmit={saveEdit} className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Exam program</Label>
                <select
                  required
                  value={editForm.examId}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      examId: e.target.value,
                      exam_session_id: '',
                      exam_subject_id: '',
                    }))
                  }
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select exam</option>
                  {exams.map((e) => (
                    <option key={e.id} value={e.id}>{e.short_name} — {e.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Session / Year / Training</Label>
                <select
                  required
                  value={editForm.exam_session_id}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      exam_session_id: e.target.value,
                      exam_subject_id: '',
                    }))
                  }
                  disabled={!editForm.examId}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select session</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label_en}{s.label_bn ? ` (${s.label_bn})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Subject</Label>
                <select
                  required
                  value={editForm.exam_subject_id}
                  onChange={(e) => setEditForm((f) => ({ ...f, exam_subject_id: e.target.value }))}
                  disabled={!editForm.examId}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select subject</option>
                  {editSubjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Paper type</Label>
                <select
                  required
                  value={editForm.paper_type_id}
                  onChange={(e) => setEditForm((f) => ({ ...f, paper_type_id: e.target.value }))}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select type</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <Label>Paper name</Label>
                <Input
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Total marks</Label>
                <Input
                  type="number"
                  required
                  min={1}
                  value={editForm.total_marks}
                  onChange={(e) => setEditForm((f) => ({ ...f, total_marks: Number(e.target.value) }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Pass marks</Label>
                <Input
                  type="number"
                  required
                  min={0}
                  value={editForm.pass_marks}
                  onChange={(e) => setEditForm((f) => ({ ...f, pass_marks: Number(e.target.value) }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  required
                  min={1}
                  value={editForm.duration_minutes}
                  onChange={(e) => setEditForm((f) => ({ ...f, duration_minutes: Number(e.target.value) }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Instructions (optional)</Label>
                <Input
                  value={editForm.instructions}
                  onChange={(e) => setEditForm((f) => ({ ...f, instructions: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button type="submit" disabled={editBusy}>
                  {editBusy ? 'Saving…' : 'Save changes'}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href={`/papers/${editingId}/edit`}>Open composer</Link>
                </Button>
                <Button type="button" variant="outline" onClick={closeEdit}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label>Exam program</Label>
            <select
              value={examId}
              onChange={(e) => {
                setExamId(e.target.value);
                setSessionId('');
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
            <Label>Session / Year</Label>
            <select
              value={sessionId}
              onChange={(e) => {
                setSessionId(e.target.value);
                setSubjectId('');
              }}
              disabled={!examId}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All sessions</option>
              {filterSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label_en}{s.label_bn ? ` (${s.label_bn})` : ''}
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
              {filterSubjects.map((s) => (
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
          <div className="flex items-end">
            <Button onClick={() => load(subjectId || undefined, sessionId || undefined, published)} className="w-full">
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {deleteError && <Alert variant="error">{deleteError}</Alert>}

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
                    {(p.session_label_en || p.session_year) && ` · ${p.session_label_en ?? p.session_year}`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={p.is_published ? 'default' : 'outline'}>
                    {p.is_published ? 'Published' : 'Draft'}
                  </Badge>
                  {p.is_exam_of_week && <Badge className="bg-red-600 text-white">Exam of the Week</Badge>}
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => openEdit(p)}>
                        <Pencil className="h-3 w-3" /> Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        disabled={deletingId === p.id}
                        onClick={() => removePaper(p)}
                      >
                        <Trash2 className="h-3 w-3" /> {deletingId === p.id ? 'Deleting…' : 'Delete'}
                      </Button>
                    </div>
                  )}
                </div>
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
