'use client';

import { useState } from 'react';
import { Link2, Unlink, X } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { MotherQuestionSearch } from '@/components/questions/mother-question-search';

interface ProtoQuestion {
  id: string;
  label: string;
}

export function ModelAnswerLinkPanel({
  questionId,
  motherQuestionId,
  motherQuestionLabel,
  prototypeQuestions = [],
  disabled,
  onChange,
}: {
  questionId: string;
  motherQuestionId?: string;
  motherQuestionLabel?: string;
  prototypeQuestions?: ProtoQuestion[];
  disabled?: boolean;
  onChange: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isPrototype = Boolean(motherQuestionId);
  const isMother = !isPrototype && prototypeQuestions.length > 0;

  async function linkTo(motherId: string) {
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/questions/${questionId}/mother-question`, {
        method: 'POST',
        body: JSON.stringify({ mother_question_id: motherId }),
      });
      setPickerOpen(false);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link answer');
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/questions/${questionId}/mother-question`, { method: 'DELETE' });
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink answer');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {error && <Alert variant="error">{error}</Alert>}

      {isPrototype && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary-muted/20 px-2.5 py-2 text-sm">
          <span className="min-w-0 flex-1">
            Mother question:{' '}
            <a
              href={`/questions/${motherQuestionId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {motherQuestionLabel || motherQuestionId}
            </a>
          </span>
          <Button type="button" size="sm" variant="outline" disabled={disabled || busy} onClick={() => void unlink()}>
            <Unlink className="h-3.5 w-3.5" />
            Remove link
          </Button>
        </div>
      )}

      {prototypeQuestions.length > 0 && (
        <div className="space-y-1.5 rounded-md border border-border bg-slate-50/60 p-2.5 text-sm">
          <p className="text-xs font-medium text-muted">
            Prototype question{prototypeQuestions.length === 1 ? '' : 's'} ({prototypeQuestions.length}) — these
            share this answer:
          </p>
          <ul className="space-y-1">
            {prototypeQuestions.map((p) => (
              <li key={p.id}>
                <a href={`/questions/${p.id}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {p.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isPrototype && !isMother && (
        <>
          {!pickerOpen ? (
            <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => setPickerOpen(true)}>
              <Link2 className="h-3.5 w-3.5" />
              Link answer with another question
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-end">
                <Button type="button" size="sm" variant="ghost" onClick={() => setPickerOpen(false)}>
                  <X className="h-3.5 w-3.5" />
                  Close
                </Button>
              </div>
              <MotherQuestionSearch excludeQuestionId={questionId} busy={busy} onPick={(q) => void linkTo(q.id)} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
