'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Upload } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { fetchMe } from '@/lib/auth';
import { applyAiDraftToForm, questionDetailToForm } from '@/lib/question-detail-form';
import { AiGenerateQuestionPanel } from '@/components/questions/ai-generate-question-panel';
import {
  buildPresetBookLink,
  bookLinkPayloadFromContext,
  parseQuestionBookContext,
} from '@/lib/question-book-context';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  QuestionEditor,
  emptyQuestionForm,
  questionFormToPayload,
  resetQuestionFormKeepingType,
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
  const searchParams = useSearchParams();
  const chapterContext = useMemo(() => parseQuestionBookContext(searchParams), [searchParams]);

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [types, setTypes] = useState<QuestionType[]>([]);
  const [form, setForm] = useState<QuestionFormValues>(emptyQuestionForm);
  const [savedQuestion, setSavedQuestion] = useState<SavedQuestionMeta | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddAnotherOffer, setShowAddAnotherOffer] = useState(false);

  const reloadSaved = useCallback(async (id: string) => {
    const res = await apiFetch<{ data: SavedQuestionMeta & Parameters<typeof questionDetailToForm>[0] }>(
      `/questions/${id}`,
    );
    setSavedQuestion({ id: res.data.id, is_published: res.data.is_published });
    setForm(questionDetailToForm(res.data));
    return res.data;
  }, []);

  const ensureChapterLink = useCallback(
    async (questionId: string) => {
      if (!chapterContext.hasPreset) return;
      await apiFetch(`/questions/${questionId}/book-links`, {
        method: 'POST',
        body: JSON.stringify(bookLinkPayloadFromContext(chapterContext)),
      });
    },
    [chapterContext],
  );

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
          const presetLink = chapterContext.hasPreset ? buildPresetBookLink(chapterContext) : null;
          if (mcq) {
            setForm((f) => ({
              ...f,
              question_type_id: mcq.id,
              question_type_code: mcq.code,
              has_options: mcq.has_options,
              book_links: presetLink ? [presetLink] : f.book_links,
            }));
          } else if (presetLink) {
            setForm((f) => ({ ...f, book_links: [presetLink] }));
          }
        });
      })
      .catch(() => router.replace('/login'));
  }, [router, chapterContext]);

  function startAnotherQuestion() {
    const presetLink = chapterContext.hasPreset ? buildPresetBookLink(chapterContext) : null;
    setSavedQuestion(null);
    setSuccess('');
    setError('');
    setShowAddAnotherOffer(false);
    setForm({
      ...resetQuestionFormKeepingType(form),
      book_links: presetLink ? [presetLink] : [],
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setShowAddAnotherOffer(false);
    setBusy(true);
    try {
      const validationError = validateQuestionForm(form);
      if (validationError) {
        setError(validationError);
        return;
      }
      const payload = questionFormToPayload(form, { includeBookLinks: !savedQuestion?.id });
      if (savedQuestion?.id) {
        await apiFetch(`/questions/${savedQuestion.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        await reloadSaved(savedQuestion.id);
        setSuccess('Question updated.');
        if (chapterContext.hasPreset) setShowAddAnotherOffer(true);
      } else {
        const res = await apiFetch<{ data: SavedQuestionMeta & Parameters<typeof questionDetailToForm>[0] }>(
          '/questions',
          {
            method: 'POST',
            body: JSON.stringify(payload),
          },
        );
        let detail = res.data;
        if (chapterContext.hasPreset && (detail.book_links?.length ?? 0) === 0) {
          await ensureChapterLink(detail.id);
          detail = await reloadSaved(detail.id);
        } else {
          setSavedQuestion({ id: detail.id, is_published: detail.is_published });
          setForm(questionDetailToForm(detail));
        }
        setSuccess(
          chapterContext.hasPreset
            ? 'Question saved and linked to this chapter. Publish it, or add another question below.'
            : 'Question saved. Add book links below, then publish so it appears under Tag questions on the chapter reader.',
        );
        if (chapterContext.hasPreset) setShowAddAnotherOffer(true);
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

  const backToBookHref = chapterContext.bookId ? `/books/${chapterContext.bookId}` : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={savedQuestion ? 'Edit question' : 'New question'}
        description={
          chapterContext.hasPreset
            ? 'Create questions for this chapter. After each save you can add another for the same chapter.'
            : savedQuestion
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
            {backToBookHref && (
              <Button asChild variant="outline" size="sm">
                <Link href={backToBookHref}>
                  <ArrowLeft className="h-4 w-4" />
                  Back to book
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href="/questions">
                <ArrowLeft className="h-4 w-4" />
                Question bank
              </Link>
            </Button>
          </div>
        }
      />

      {success && <Alert variant="success">{success}</Alert>}

      {(showAddAnotherOffer || (savedQuestion && chapterContext.hasPreset)) && chapterContext.hasPreset && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/20 bg-primary-muted/30 px-4 py-3">
          <p className="min-w-0 flex-1 text-sm">
            {savedQuestion?.is_published
              ? 'Question is published for this chapter.'
              : 'Publish this question so learners see it under Tag questions.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {!savedQuestion?.is_published && savedQuestion && (
              <Button type="button" size="sm" disabled={busy} onClick={togglePublish}>
                <Upload className="h-4 w-4" />
                Publish
              </Button>
            )}
            <Button type="button" size="sm" variant="default" disabled={busy} onClick={startAnotherQuestion}>
              <Plus className="h-4 w-4" />
              Add another for this chapter
            </Button>
            {backToBookHref && (
              <Button asChild type="button" size="sm" variant="outline">
                <Link href={backToBookHref}>Back to book</Link>
              </Button>
            )}
          </div>
        </div>
      )}

      {savedQuestion && form.book_links.length > 0 && !savedQuestion.is_published && (
        <Alert variant="warning">
          This question is linked to {form.book_links.length} book location
          {form.book_links.length !== 1 ? 's' : ''} but is still a draft. Publish it to show under Tag questions on
          the chapter reader.
        </Alert>
      )}

      {chapterContext.hasPreset && !savedQuestion && form.question_type_id && (
        <AiGenerateQuestionPanel
          questionTypeId={form.question_type_id}
          bookChapterId={chapterContext.chapterId}
          bookTopicId={chapterContext.topicId || undefined}
          bookSubTopicId={chapterContext.subTopicId || undefined}
          disabled={busy}
          onGenerated={(draft) => setForm((f) => applyAiDraftToForm(f, draft))}
        />
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
          if (!savedQuestion?.id) return;
          apiFetch<{ data: SavedQuestionMeta & Parameters<typeof questionDetailToForm>[0] }>(
            `/questions/${savedQuestion.id}`,
          )
            .then((res) => {
              setSavedQuestion({ id: res.data.id, is_published: res.data.is_published });
              setForm((f) => ({ ...f, book_links: res.data.book_links ?? [] }));
            })
            .catch(() => {});
        }}
      />
    </div>
  );
}
