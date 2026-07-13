'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import {
  QuestionEditor,
  emptyQuestionForm,
  questionFormToPayload,
  validateQuestionForm,
  type QuestionFormValues,
} from '@/components/questions/question-editor';
import { questionDetailToForm } from '@/lib/question-detail-form';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

interface QuestionType {
  id: string;
  code: string;
  name: string;
  has_options: boolean;
}

export function QuestionEditModal({
  questionId,
  open,
  onClose,
  onSaved,
}: {
  questionId: string | null;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [types, setTypes] = useState<QuestionType[]>([]);
  const [form, setForm] = useState<QuestionFormValues>(emptyQuestionForm);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!open || !questionId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setMessage('');
    Promise.all([
      apiFetch<{ data: Parameters<typeof questionDetailToForm>[0] }>(`/questions/${questionId}`),
      apiFetch<{ data: QuestionType[] }>('/questions/types'),
    ])
      .then(([detailRes, typesRes]) => {
        if (cancelled) return;
        setForm(questionDetailToForm(detailRes.data));
        setTypes(typesRes.data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load question');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, questionId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!questionId) return;
    setError('');
    setMessage('');
    const validationError = validateQuestionForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    try {
      const payload = questionFormToPayload(form, { includeBookLinks: false });
      await apiFetch(`/questions/${questionId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setMessage('Question saved');
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  if (!open || !questionId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center p-0 sm:items-center sm:p-2">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex h-[100dvh] max-h-[100dvh] w-full max-w-[100vw] flex-col overflow-hidden rounded-none border border-border bg-background shadow-xl sm:h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-1rem)] sm:max-w-5xl sm:rounded-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Edit question</h2>
            <p className="text-xs text-muted">Changes save without leaving the question bank.</p>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={onClose} disabled={busy}>
            <X className="h-4 w-4" />
            Close
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {message && <Alert variant="success" className="mb-4">{message}</Alert>}
          {error && <Alert variant="error" className="mb-4">{error}</Alert>}
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <QuestionEditor
              value={form}
              onChange={setForm}
              questionTypes={types}
              excludeQuestionId={questionId}
              questionId={questionId}
              onSubmit={handleSave}
              busy={busy}
              submitLabel="Save changes"
              error={error}
            />
          )}
        </div>
      </div>
    </div>
  );
}
