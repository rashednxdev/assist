'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { fetchMe } from '@/lib/auth';
import { questionDetailToForm } from '@/lib/question-detail-form';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  QuestionEditor,
  emptyQuestionForm,
  questionFormToPayload,
  validateQuestionForm,
  type QuestionFormValues,
} from '@/components/questions/question-editor';
import { Alert } from '@/components/ui/alert';

interface QuestionType {
  id: string;
  code: string;
  name: string;
  has_options: boolean;
}

interface SavedQuestionMeta {
  id: string;
  is_published: boolean;
}

export default function NewQuestionPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [types, setTypes] = useState<QuestionType[]>([]);
  const [form, setForm] = useState<QuestionFormValues>(emptyQuestionForm);
  const [savedQuestion, setSavedQuestion] = useState<SavedQuestionMeta | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const reloadSaved = useCallback(async (id: string) => {
    const res = await apiFetch<{ data: SavedQuestionMeta & Parameters<typeof questionDetailToForm>[0] }>(
      `/questions/${id}`,
    );
    setSavedQuestion({ id: res.data.id, is_published: res.data.is_published });
    setForm(questionDetailToForm(res.data));
    return res.data;
  }, []);

  useEffect(() => {
    fetchMe()
      .then((res) => {
        const admin =
          res.data.is_super_admin || res.data.user_type === 'system_admin' || res.data.user_type === 'admin';
        setAllowed(admin);
        if (!admin) {
          router.replace('/questions');
          return;
        }
        return apiFetch<{ data: QuestionType[] }>('/questions/types').then((r) => {
          setTypes(r.data);
          const mcq = r.data.find((t) => t.code === 'MCQ') ?? r.data[0];
          if (mcq) {
            setForm((f) => ({
              ...f,
              question_type_id: mcq.id,
              question_type_code: mcq.code,
              has_options: mcq.has_options,
            }));
          }
        });
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      const validationError = validateQuestionForm(form);
      if (validationError) {
        setError(validationError);
        return;
      }
      const payload = questionFormToPayload(form);
      if (savedQuestion?.id) {
        await apiFetch(`/questions/${savedQuestion.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        await reloadSaved(savedQuestion.id);
        setSuccess('Question updated.');
      } else {
        const res = await apiFetch<{ data: SavedQuestionMeta & Parameters<typeof questionDetailToForm>[0] }>(
          '/questions',
          {
            method: 'POST',
            body: JSON.stringify(payload),
          },
        );
        setSavedQuestion({ id: res.data.id, is_published: res.data.is_published });
        setForm(questionDetailToForm(res.data));
        setSuccess(
          'Question saved. Add book links below, then publish so it appears under Tag questions on the chapter reader.',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save question');
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish() {
    if (!savedQuestion?.id) return;
    setBusy(true);
    setError('');
    try {
      const path = savedQuestion.is_published
        ? `/questions/${savedQuestion.id}/unpublish`
        : `/questions/${savedQuestion.id}/publish`;
      await apiFetch(path, { method: 'POST' });
      await reloadSaved(savedQuestion.id);
      setSuccess(savedQuestion.is_published ? 'Unpublished' : 'Published — visible on chapter Tag questions');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Publish failed');
    } finally {
      setBusy(false);
    }
  }

  if (allowed === null) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={savedQuestion ? 'Edit question' : 'New question'}
        description={
          savedQuestion
            ? 'Update the question, tag book locations below, and publish when ready.'
            : 'Create MCQ, true/false, descriptive, or short-note questions linked to chapters, rules, or sub-rules.'
        }
        action={
          <div className="flex flex-wrap gap-2">
            {savedQuestion && (
              <>
                <Badge variant={savedQuestion.is_published ? 'default' : 'outline'}>
                  {savedQuestion.is_published ? 'Published' : 'Draft'}
                </Badge>
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={togglePublish}>
                  <Upload className="h-4 w-4" />
                  {savedQuestion.is_published ? 'Unpublish' : 'Publish'}
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/questions/${savedQuestion.id}`}>Open detail</Link>
                </Button>
              </>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href="/questions">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            </Button>
          </div>
        }
      />
      {success && <Alert variant="success">{success}</Alert>}
      {savedQuestion && form.book_links.length > 0 && !savedQuestion.is_published && (
        <Alert variant="warning">
          This question is linked to {form.book_links.length} book location
          {form.book_links.length !== 1 ? 's' : ''} but is still a draft. Publish it to show under Tag questions on
          the chapter reader.
        </Alert>
      )}
      <QuestionEditor
        value={form}
        onChange={setForm}
        onSubmit={handleSubmit}
        questionTypes={types}
        busy={busy}
        error={error}
        submitLabel={savedQuestion ? 'Save changes' : 'Save question'}
        questionId={savedQuestion?.id}
        isPublished={savedQuestion?.is_published}
        onBookLinksChange={() => {
          if (savedQuestion?.id) reloadSaved(savedQuestion.id).catch(() => {});
        }}
      />
    </div>
  );
}
