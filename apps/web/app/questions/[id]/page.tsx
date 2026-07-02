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
import { serializeExplanationSections, type ExplanationSection } from '@ibas/shared-types';
import {
  QuestionEditor,
  emptyQuestionForm,
  questionFormToPayload,
  validateQuestionForm,
  type QuestionBookLinkForm,
  type QuestionFormValues,
} from '@/components/questions/question-editor';
import { QuestionAnswerView } from '@/components/questions/question-answer-view';
import { taggedQuestionLocationHref } from '@/lib/book-links';
import { questionDetailToForm } from '@/lib/question-detail-form';

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
  book_links?: QuestionBookLinkForm[];
  explanation_sections?: ExplanationSection[];
  model_answer_sections?: ExplanationSection[];
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
    return apiFetch<{ data: QuestionDetail }>(`/questions/${id}`).then((r) => {
      setQuestion(r.data);
      setForm(questionDetailToForm(r.data));
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
      const validationError = validateQuestionForm(form);
      if (validationError) {
        setError(validationError);
        return;
      }
      const payload = questionFormToPayload(form, { includeBookLinks: false });
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
  const bookLinks = question.book_links ?? [];

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
        {bookLinks.length > 0 ? (
          <Badge variant="secondary">{bookLinks.length} book link{bookLinks.length !== 1 ? 's' : ''}</Badge>
        ) : link ? (
          <Badge variant="secondary">Linked: {link}</Badge>
        ) : null}
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
          excludeQuestionId={id}
          questionId={id}
          isPublished={question.is_published}
          onBookLinksChange={() => {
            apiFetch<{ data: QuestionDetail }>(`/questions/${id}`)
              .then((r) => {
                setQuestion(r.data);
                setForm((f) => ({ ...f, book_links: r.data.book_links ?? [] }));
              })
              .catch(() => {});
          }}
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
          <CardContent className="space-y-6">
            <QuestionAnswerView
              body_en={question.body_en}
              body_bn={question.body_bn}
              has_options={question.has_options}
              options={question.options}
              model_answer_sections={question.model_answer_sections}
              explanation_sections={question.explanation_sections}
              answer_note={question.note}
              showAnswer={showAnswer}
            />

            {bookLinks.length > 0 && (
              <div className="space-y-2 border-t border-border pt-4">
                <div className="text-sm font-semibold">Tagged locations</div>
                <ul className="space-y-1.5">
                  {bookLinks.map((bl) => {
                    const href = taggedQuestionLocationHref({
                      book_info_id: bl.book_id,
                      book_chapter_id: bl.book_chapter_id,
                      book_topic_id: bl.book_topic_id,
                      book_sub_topic_id: bl.book_sub_topic_id,
                      regulation_id: bl.regulation_id,
                    });
                    return (
                      <li key={bl.id ?? bl.label} className="text-sm">
                        {href ? (
                          <Link href={href} className="text-primary hover:underline">
                            {bl.label || 'Book link'}
                          </Link>
                        ) : (
                          bl.label || 'Book link'
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
