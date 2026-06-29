'use client';

import { useEffect, useState } from 'react';
import { SELF_RATING_PROGRESS, type SelfRatingLevel } from '@ibas/shared-constants';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { ProgressSummary } from './progress-summary';

interface PracticeStem {
  id: string;
  body_en: string;
  body_bn?: string;
  question_type_code: string;
  has_options: boolean;
  options: {
    id: string;
    option_key: string;
    option_text_en: string;
    option_text_bn?: string;
  }[];
}

interface EvaluationRecord {
  question_id: string;
  progress_index: number;
  is_correct?: boolean;
  self_rating?: SelfRatingLevel;
  selected_option_id?: string;
}

const SELF_LABELS: Record<SelfRatingLevel, string> = {
  overall: 'Overall (50%)',
  understand: 'Understand (75%)',
  confidence: 'Confidence (100%)',
};

interface QuestionEvaluatorProps {
  questionId: string;
  onUpdated?: (record: EvaluationRecord) => void;
}

export function QuestionEvaluator({ questionId, onUpdated }: QuestionEvaluatorProps) {
  const [stem, setStem] = useState<PracticeStem | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationRecord | null>(null);
  const [selectedOption, setSelectedOption] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      apiFetch<{ data: PracticeStem }>(`/evaluation/questions/${questionId}/practice`),
      apiFetch<{ data: EvaluationRecord }>(`/evaluation/questions/${questionId}`),
    ])
      .then(([stemRes, evalRes]) => {
        setStem(stemRes.data);
        setEvaluation(evalRes.data);
        setSelectedOption(evalRes.data.selected_option_id ?? '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [questionId]);

  async function save(body: Record<string, string>) {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await apiFetch<{ data: EvaluationRecord }>(`/evaluation/questions/${questionId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      setEvaluation(res.data);
      setMessage('Your rating has been saved. It applies everywhere this question is linked.');
      onUpdated?.(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted">Loading evaluation…</p>;
  if (!stem) return null;

  const rated = (evaluation?.progress_index ?? 0) > 0;

  return (
    <div className="space-y-4 rounded-lg border border-border bg-slate-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">Your progress on this question</h3>
        {rated && evaluation && (
          <ProgressSummary
            percent={evaluation.progress_index}
            rated={1}
            total={1}
            size="sm"
          />
        )}
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      {stem.has_options ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">Select your answer (MCQ / True–False):</p>
          <div className="space-y-2">
            {stem.options.map((opt) => (
              <label
                key={opt.id}
                className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                  selectedOption === opt.id ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <input
                  type="radio"
                  name={`eval-${questionId}`}
                  checked={selectedOption === opt.id}
                  onChange={() => setSelectedOption(opt.id)}
                  className="mt-1"
                />
                <span>
                  <strong className="uppercase">{opt.option_key}.</strong> {opt.option_text_en}
                </span>
              </label>
            ))}
          </div>
          <Button
            size="sm"
            disabled={!selectedOption || saving}
            onClick={() => save({ selected_option_id: selectedOption })}
          >
            {saving ? 'Saving…' : rated ? 'Update answer' : 'Submit answer'}
          </Button>
          {evaluation?.is_correct !== undefined && (
            <p className="text-sm">
              Last result:{' '}
              <span className={evaluation.is_correct ? 'text-green-700' : 'text-red-700'}>
                {evaluation.is_correct ? 'Correct (100%)' : 'Incorrect (0%)'}
              </span>
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Rate yourself after reviewing the model answer. This rating applies in all books and papers
            where this question appears.
          </p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(SELF_RATING_PROGRESS) as SelfRatingLevel[]).map((level) => (
              <Button
                key={level}
                size="sm"
                variant={evaluation?.self_rating === level ? 'default' : 'outline'}
                disabled={saving}
                onClick={() => save({ self_rating: level })}
              >
                {SELF_LABELS[level]}
              </Button>
            ))}
          </div>
          {evaluation?.self_rating && (
            <p className="text-sm text-muted">
              Current: {SELF_LABELS[evaluation.self_rating]} → {evaluation.progress_index}%
            </p>
          )}
        </div>
      )}
    </div>
  );
}
