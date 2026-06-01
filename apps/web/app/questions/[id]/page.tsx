'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Eye, Pencil, Trash2, Upload, Download } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { fetchMe } from '@/lib/auth';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';
import {
  QuestionEditor,
  emptyQuestionForm,
  questionFormToPayload,
  type QuestionFormValues,
} from '@/components/questions/question-editor';

interface QuestionType {
  id: string;
  code: string;
  name: string;
  has_options: boolean;
}

interface QuestionDetail {
  id: string;
  body_en: string;
  body_bn?: string;
  difficulty: string;
  marks: number;
  negative_marks?: number;
  time_seconds: number;
  is_published: boolean;
  question_type_id: string;
  question_type_code: string;
  question_type_name?: string;
  has_options: boolean;
  link_level?: 'chapter' | 'rule' | 'sub_rule';
  book_chapter_id?: string;
  book_topic_id?: string;
  book_sub_topic_id?: string;
  regulation_id?: string;
  explanation?: string;
  model_answer?: string;
  note?: string;
  correct_true_false?: 'true' | 'false';
  options: {
    id: string;
    option_key: string;
    option_text_en: string;
    option_text_bn?: string;
    is_correct: boolean;
  }[];
  correct_option_key?: string;
}

function detailToForm(q: QuestionDetail): QuestionFormValues {
  const keys = ['a', 'b', 'c', 'd', 'e'] as const;
  const options = keys.slice(0, Math.max(4, q.options.length)).map((key) => {
    const found = q.options.find((o) => o.option_key === key);
    return {
      option_key: key,
      option_text_en: found?.option_text_en ?? '',
      option_text_bn: found?.option_text_bn,
    };
  });
  return {
    ...emptyQuestionForm,
    question_type_id: q.question_type_id,
    question_type_code: q.question_type_code,
    has_options: q.has_options,
    body_en: q.body_en,
    body_bn: q.body_bn ?? '',
    difficulty: q.difficulty as QuestionFormValues['difficulty'],
    marks: q.marks,
    negative_marks: q.negative_marks ?? 0,
    time_seconds: q.time_seconds,
    options,
    correct_option_key: (q.correct_option_key ?? 'a') as QuestionFormValues['correct_option_key'],
    correct_true_false: q.correct_true_false ?? 'true',
    model_answer: q.model_answer ?? '',
    explanation: q.explanation ?? '',
    note: q.note ?? '',
    link_level: q.link_level ?? '',
    book_chapter_id: q.book_chapter_id ?? '',
    book_topic_id: q.book_topic_id ?? '',
    book_sub_topic_id: q.book_sub_topic_id ?? '',
    regulation_id: q.regulation_id ?? '',
  };
}

function linkLabel(level?: string) {
  if (level === 'chapter') return 'Chapter';
  if (level === 'rule') return 'Rule';
  if (level === 'sub_rule') return 'Sub-rule';
  return null;
}

export default function QuestionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [question, setQuestion] = useState<QuestionDetail | null>(null);
  const [types, setTypes] = useState<QuestionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<QuestionFormValues>(emptyQuestionForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);

  const reload = useCallback(() => {
    return apiFetch<{ data: QuestionDetail }>(`/questions/${id}`).then(async (r) => {
      setQuestion(r.data);
      let bookId = '';
      if (r.data.book_chapter_id) {
        try {
          const ch = await apiFetch<{ data: { book_info_id: string } }>(
            `/books/chapters/${r.data.book_chapter_id}`,
          );
          bookId = ch.data.book_info_id;
        } catch {
          /* optional */
        }
      }
      setForm({ ...detailToForm(r.data), book_id: bookId });
    });
  }, [id]);

  useEffect(() => {
    Promise.all([
      reload().catch(() => setQuestion(null)),
      apiFetch<{ data: QuestionType[] }>('/questions/types').then((r) => setTypes(r.data)),
    ]).finally(() => setLoading(false));
    fetchMe()
      .then((res) => {
        setIsAdmin(
          res.data.is_super_admin || res.data.user_type === 'system_admin' || res.data.user_type === 'admin',
        );
      })
      .catch(() => {});
  }, [reload]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = questionFormToPayload(form);
      await apiFetch(`/questions/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      setMessage('Question saved');
      setEditMode(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish() {
    if (!question) return;
    setBusy(true);
    setError('');
    try {
      const path = question.is_published ? `/questions/${id}/unpublish` : `/questions/${id}/publish`;
      await apiFetch(path, { method: 'POST' });
      await reload();
      setMessage(question.is_published ? 'Unpublished' : 'Published');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this question?')) return;
    setBusy(true);
    try {
      await apiFetch(`/questions/${id}`, { method: 'DELETE' });
      router.push('/questions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!question) {
    return <Alert variant="error">Question not found.</Alert>;
  }

  const link = linkLabel(question.link_level);

  return (
    <div className="space-y-6">
      <PageHeader
        title={question.question_type_name ?? question.question_type_code}
        description={question.body_en.slice(0, 120) + (question.body_en.length > 120 ? '…' : '')}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/questions">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            </Button>
            {isAdmin && !editMode && (
              <>
                <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                <Button size="sm" variant="outline" onClick={togglePublish} disabled={busy}>
                  {question.is_published ? (
                    <>
                      <Download className="h-4 w-4" />
                      Unpublish
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Publish
                    </>
                  )}
                </Button>
                <Button size="sm" variant="outline" onClick={handleDelete} disabled={busy}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </>
            )}
          </div>
        }
      />

      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{question.question_type_code}</Badge>
        {link && <Badge variant="secondary">Linked: {link}</Badge>}
        <Badge variant="secondary">{question.difficulty}</Badge>
        <Badge variant="outline">{question.marks} marks</Badge>
        {question.negative_marks ? <Badge variant="outline">−{question.negative_marks} wrong</Badge> : null}
        <Badge variant={question.is_published ? 'default' : 'outline'}>
          {question.is_published ? 'Published' : 'Draft'}
        </Badge>
      </div>

      {editMode && isAdmin ? (
        <QuestionEditor
          value={form}
          onChange={setForm}
          onSubmit={handleSave}
          questionTypes={types}
          busy={busy}
          error={error}
          submitLabel="Save changes"
        />
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Preview</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowAnswer((v) => !v)}>
              <Eye className="h-4 w-4" />
              {showAnswer ? 'Hide answer' : 'Show answer'}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="font-medium">{question.body_en}</p>
            {question.body_bn && <p className="text-muted">{question.body_bn}</p>}

            {question.has_options && question.options.length > 0 && (
              <div className="space-y-2">
                {question.options.map((opt) => {
                  const isCorrect = showAnswer && opt.is_correct;
                  return (
                    <div
                      key={opt.id}
                      className={`rounded-lg border p-3 ${
                        isCorrect ? 'border-primary bg-primary-muted/40' : 'border-border'
                      }`}
                    >
                      <span className="mr-2 font-semibold uppercase">{opt.option_key}.</span>
                      {opt.option_text_en}
                      {opt.option_text_bn && <div className="mt-1 text-sm text-muted">{opt.option_text_bn}</div>}
                    </div>
                  );
                })}
              </div>
            )}

            {!question.has_options && showAnswer && question.model_answer && (
              <div className="rounded-lg border border-primary/40 bg-primary-muted/30 p-4">
                <div className="text-sm font-semibold">Model answer</div>
                <p className="mt-1 text-sm">{question.model_answer}</p>
              </div>
            )}

            {showAnswer && question.explanation && question.has_options && (
              <div className="rounded-lg border border-border bg-slate-50/80 p-4">
                <div className="text-sm font-semibold">Explanation</div>
                <p className="mt-1 text-sm text-muted">{question.explanation}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
