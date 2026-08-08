'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Link2, Unlink, X } from 'lucide-react';
import { BOOK_LANGUAGES, OPTION_KEYS, QUESTION_DIFFICULTIES } from '@ibas/shared-constants';
import type { ComparisonTable, ExplanationSection } from '@ibas/shared-types';
import { emptyComparisonTable } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import {
  QuestionBookLinksEditor,
  type QuestionBookLinkForm,
} from '@/components/questions/question-book-links-editor';
import { ExplanationSectionsEditor } from '@/components/questions/explanation-sections-editor';
import { ComparisonTableEditor } from '@/components/questions/comparison-table-editor';
import { ModelAnswerLinkPanel } from '@/components/questions/model-answer-link';
import { MotherQuestionSearch } from '@/components/questions/mother-question-search';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface SimilarQuestion {
  id: string;
  body_en: string;
  body_bn?: string;
  question_type_code: string;
  is_published: boolean;
  similarity: number;
}

export interface QuestionOptionInput {
  option_key: (typeof OPTION_KEYS)[number];
  option_text_en: string;
  option_text_bn?: string;
}

export interface QuestionFormValues {
  question_type_id: string;
  question_type_code: string;
  has_options: boolean;
  body_en: string;
  body_bn: string;
  difficulty: (typeof QUESTION_DIFFICULTIES)[number];
  marks: number;
  negative_marks: number;
  time_seconds: number;
  language: (typeof BOOK_LANGUAGES)[number];
  options: QuestionOptionInput[];
  correct_option_key: (typeof OPTION_KEYS)[number];
  correct_true_false: 'true' | 'false';
  model_answer_sections: ExplanationSection[];
  model_answer_comparison: ComparisonTable;
  explanation_sections: ExplanationSection[];
  note: string;
  book_links: QuestionBookLinkForm[];
  /** Pending mother-question pick, before the question exists yet (new-question flow only). */
  mother_question_id?: string;
  mother_question_label?: string;
}

export type { QuestionBookLinkForm };

const defaultMcqOptions: QuestionOptionInput[] = [
  { option_key: 'a', option_text_en: '' },
  { option_key: 'b', option_text_en: '' },
  { option_key: 'c', option_text_en: '' },
  { option_key: 'd', option_text_en: '' },
];

export const emptyQuestionForm: QuestionFormValues = {
  question_type_id: '',
  question_type_code: 'MCQ',
  has_options: true,
  body_en: '',
  body_bn: '',
  difficulty: 'medium',
  marks: 1,
  negative_marks: 0,
  time_seconds: 60,
  language: 'both',
  options: defaultMcqOptions,
  correct_option_key: 'a',
  correct_true_false: 'true',
  model_answer_sections: [],
  model_answer_comparison: emptyComparisonTable(2),
  explanation_sections: [],
  note: '',
  book_links: [],
  mother_question_id: undefined,
  mother_question_label: undefined,
};

/** Clear question fields for another entry while keeping the selected type. */
export function resetQuestionFormKeepingType(current: QuestionFormValues): QuestionFormValues {
  const next: QuestionFormValues = {
    ...emptyQuestionForm,
    question_type_id: current.question_type_id,
    question_type_code: current.question_type_code,
    has_options: current.has_options,
  };

  if (current.question_type_code === 'MCQ') {
    next.options = defaultMcqOptions.map((o) => ({ ...o }));
  } else {
    next.options = [];
  }

  return next;
}

interface QuestionTypeItem {
  id: string;
  code: string;
  name: string;
  has_options: boolean;
  note?: string;
}

/** Pick a mother question before the new question has been saved — stores the pick locally, links it on create. */
function PendingMotherQuestionPicker({
  motherQuestionId,
  motherQuestionLabel,
  onPick,
  onRemove,
  disabled,
}: {
  motherQuestionId?: string;
  motherQuestionLabel?: string;
  onPick: (question: { id: string; label: string }) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  if (motherQuestionId) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary-muted/20 px-2.5 py-2 text-sm">
        <span className="min-w-0 flex-1">
          Will link to mother question:{' '}
          <a
            href={`/questions/${motherQuestionId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {motherQuestionLabel || motherQuestionId}
          </a>
        </span>
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={onRemove}>
          <Unlink className="h-3.5 w-3.5" />
          Remove
        </Button>
      </div>
    );
  }

  return !pickerOpen ? (
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
      <MotherQuestionSearch
        onPick={(q) => {
          onPick(q);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

interface QuestionEditorProps {
  value: QuestionFormValues;
  onChange: (value: QuestionFormValues) => void;
  onSubmit: (e: React.FormEvent) => void;
  questionTypes: QuestionTypeItem[];
  busy?: boolean;
  error?: string;
  submitLabel?: string;
  /** When editing, exclude the current question from duplicate hints. */
  excludeQuestionId?: string;
  /** Existing question id — enables immediate book-link add/remove. */
  questionId?: string;
  onBookLinksChange?: () => void;
  isPublished?: boolean;
  /** Mother/prototype model-answer sharing — only meaningful once the question exists (questionId set). */
  motherQuestionId?: string;
  motherQuestionLabel?: string;
  prototypeQuestions?: Array<{ id: string; label: string }>;
  onMotherQuestionChange?: () => void;
}

export function QuestionEditor({
  value,
  onChange,
  onSubmit,
  questionTypes,
  busy,
  error,
  submitLabel = 'Save question',
  excludeQuestionId,
  questionId,
  onBookLinksChange,
  isPublished,
  motherQuestionId,
  motherQuestionLabel,
  prototypeQuestions,
  onMotherQuestionChange,
}: QuestionEditorProps) {
  const [similarQuestions, setSimilarQuestions] = useState<SimilarQuestion[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);

  const selectedType = useMemo(
    () => questionTypes.find((t) => t.id === value.question_type_id),
    [questionTypes, value.question_type_id],
  );

  const isMcq = value.question_type_code === 'MCQ';
  const isTf = value.question_type_code === 'TF';
  const isMcqOrTf = isMcq || isTf;
  const isShortNote = value.question_type_code === 'SHORT_NOTE';
  const isDifferences = value.question_type_code === 'DIFFERENCES';
  const isTextAnswer = !value.has_options;
  const questionText = value.body_bn || value.body_en;

  useEffect(() => {
    const text = questionText.trim();
    if (!value.question_type_id || text.length < 8) {
      setSimilarQuestions([]);
      setSimilarLoading(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setSimilarLoading(true);
      const params = new URLSearchParams({
        text,
        threshold: '0.5',
      });
      if (excludeQuestionId) params.set('exclude_id', excludeQuestionId);

      apiFetch<{ data: SimilarQuestion[] }>(`/questions/similar?${params.toString()}`)
        .then((r) => setSimilarQuestions(r.data))
        .catch(() => setSimilarQuestions([]))
        .finally(() => setSimilarLoading(false));
    }, 400);

    return () => window.clearTimeout(timer);
  }, [questionText, value.question_type_id, excludeQuestionId]);

  function patch(partial: Partial<QuestionFormValues>) {
    onChange({ ...value, ...partial });
  }

  function onTypeChange(typeId: string) {
    const t = questionTypes.find((x) => x.id === typeId);
    if (!t) return;
    const next: Partial<QuestionFormValues> = {
      question_type_id: t.id,
      question_type_code: t.code,
      has_options: t.has_options,
    };
    if (t.code === 'TF') {
      next.correct_true_false = value.correct_true_false || 'true';
    } else if (t.has_options && value.options.length < 2) {
      next.options = defaultMcqOptions;
    }
    if (!t.has_options) {
      next.negative_marks = 0;
      next.explanation_sections = [];
      if (t.code === 'DIFFERENCES') {
        next.model_answer_sections = [];
        next.model_answer_comparison = value.model_answer_comparison?.columns?.length
          ? value.model_answer_comparison
          : emptyComparisonTable(2);
      } else {
        next.model_answer_comparison = emptyComparisonTable(2);
      }
    } else {
      next.model_answer_sections = [];
      next.model_answer_comparison = emptyComparisonTable(2);
    }
    onChange({ ...value, ...next });
  }

  function updateOption(key: string, field: 'option_text_en' | 'option_text_bn', text: string) {
    patch({
      options: value.options.map((o) => (o.option_key === key ? { ...o, [field]: text } : o)),
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Question type</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="question_type_id">Type *</Label>
            <select
              id="question_type_id"
              required
              value={value.question_type_id}
              onChange={(e) => onTypeChange(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">— Select type —</option>
              {questionTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          {selectedType?.note && <p className="text-sm text-muted">{selectedType.note}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Question text</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="body_bn">Question *</Label>
            <textarea
              id="body_bn"
              required
              rows={3}
              value={questionText}
              onChange={(e) => {
                const text = e.target.value;
                patch({ body_bn: text, body_en: text });
              }}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            {(similarLoading || similarQuestions.length > 0) && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
                  {similarLoading
                    ? 'Checking for similar questions…'
                    : `Similar questions, any type (${similarQuestions.length} at ≥50% match)`}
                </p>
                {!similarLoading && similarQuestions.length > 0 && (
                  <ul className="mt-2 space-y-2">
                    {similarQuestions.map((q) => (
                      <li
                        key={q.id}
                        className="flex items-start justify-between gap-2 rounded-md border border-amber-100 bg-background px-2.5 py-2 text-sm dark:border-amber-900/40"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2">{q.body_bn || q.body_en}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="text-xs">
                              {q.similarity}% match
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {q.question_type_code}
                            </Badge>
                            <Badge variant={q.is_published ? 'default' : 'secondary'} className="text-xs">
                              {q.is_published ? 'Published' : 'Draft'}
                            </Badge>
                          </div>
                        </div>
                        <Button asChild type="button" size="sm" variant="ghost" className="h-8 shrink-0 px-2">
                          <Link href={`/questions/${q.id}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span className="sr-only">View question</span>
                          </Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="difficulty">Difficulty</Label>
              <select
                id="difficulty"
                value={value.difficulty}
                onChange={(e) => patch({ difficulty: e.target.value as QuestionFormValues['difficulty'] })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {QUESTION_DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            {isMcqOrTf && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="marks">Marks</Label>
                  <Input
                    id="marks"
                    type="number"
                    min={0.25}
                    step={0.25}
                    value={value.marks}
                    onChange={(e) => patch({ marks: Number(e.target.value) })}
                  />
                </div>
                {isMcq && (
                  <div className="space-y-1.5">
                    <Label htmlFor="negative_marks">Negative marks</Label>
                    <Input
                      id="negative_marks"
                      type="number"
                      min={0}
                      step={0.25}
                      value={value.negative_marks}
                      onChange={(e) => patch({ negative_marks: Number(e.target.value) })}
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="time_seconds">Time (seconds)</Label>
                  <Input
                    id="time_seconds"
                    type="number"
                    min={10}
                    value={value.time_seconds}
                    onChange={(e) => patch({ time_seconds: Number(e.target.value) })}
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {isTf && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Correct answer (True / False) *</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="tf"
                checked={value.correct_true_false === 'true'}
                onChange={() => patch({ correct_true_false: 'true' })}
              />
              True
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="tf"
                checked={value.correct_true_false === 'false'}
                onChange={() => patch({ correct_true_false: 'false' })}
              />
              False
            </label>
          </CardContent>
        </Card>
      )}

      {isMcq && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Answer options (MCQ) *</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {value.options.map((opt) => (
              <div key={opt.option_key} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct"
                    checked={value.correct_option_key === opt.option_key}
                    onChange={() => patch({ correct_option_key: opt.option_key })}
                  />
                  <Label className="font-semibold uppercase">{opt.option_key}</Label>
                  {value.correct_option_key === opt.option_key && (
                    <span className="text-xs text-primary">Correct answer</span>
                  )}
                </div>
                <Input
                  placeholder="Option text"
                  value={opt.option_text_en}
                  onChange={(e) => updateOption(opt.option_key, 'option_text_en', e.target.value)}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isTextAnswer && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {isDifferences
                ? 'Model answer — differences table'
                : isShortNote
                  ? 'Model short answer (optional)'
                  : 'Model answer (optional)'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isDifferences ? (
              <>
                <p className="text-xs text-muted">
                  Build a comparison table: Feature column plus columns for each item being compared
                  (e.g. Data vs Information).
                </p>
                <ComparisonTableEditor
                  value={value.model_answer_comparison}
                  onChange={(model_answer_comparison) => patch({ model_answer_comparison })}
                  disabled={busy}
                />
              </>
            ) : (
              <>
                {questionId ? (
                  <ModelAnswerLinkPanel
                    questionId={questionId}
                    motherQuestionId={motherQuestionId}
                    motherQuestionLabel={motherQuestionLabel}
                    prototypeQuestions={prototypeQuestions}
                    disabled={busy}
                    onChange={() => onMotherQuestionChange?.()}
                  />
                ) : (
                  <PendingMotherQuestionPicker
                    motherQuestionId={value.mother_question_id}
                    motherQuestionLabel={value.mother_question_label}
                    disabled={busy}
                    onPick={(q) => patch({ mother_question_id: q.id, mother_question_label: q.label })}
                    onRemove={() => patch({ mother_question_id: undefined, mother_question_label: undefined })}
                  />
                )}
                <p className="text-xs text-muted">
                  Add one or more titles. Under each title you can add sub-titles with their own details and notes.
                </p>
                <ExplanationSectionsEditor
                  sections={value.model_answer_sections}
                  onChange={(model_answer_sections) => patch({ model_answer_sections })}
                  disabled={busy || Boolean(!questionId && value.mother_question_id)}
                />
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {isMcqOrTf ? 'Explanation & book linking' : 'Notes & book linking'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isMcqOrTf && (
            <div className="space-y-2">
              <div>
                <Label>Explanation (optional)</Label>
                <p className="mt-1 text-xs text-muted">
                  Add one or more titles. Under each title you can add sub-titles with their own details and notes.
                </p>
              </div>
              <ExplanationSectionsEditor
                sections={value.explanation_sections}
                onChange={(explanation_sections) => patch({ explanation_sections })}
                disabled={busy}
              />
            </div>
          )}

          <QuestionBookLinksEditor
            links={value.book_links}
            onChange={(book_links) => patch({ book_links })}
            questionId={questionId}
            onRemoteChange={onBookLinksChange}
            isPublished={isPublished}
            disabled={busy}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function validateQuestionForm(form: QuestionFormValues): string | null {
  if (form.question_type_code === 'MCQ') {
    const options = form.options.filter((o) => o.option_text_en.trim());
    if (options.length < 2) return 'MCQ questions need at least two answer options with text';
    if (!options.some((o) => o.option_key === form.correct_option_key)) {
      return 'Select the correct MCQ answer';
    }
  }
  return null;
}

export function questionFormToPayload(
  form: QuestionFormValues,
  options?: { includeBookLinks?: boolean },
) {
  const text = (form.body_bn || form.body_en).trim();
  const isMcqOrTf = form.question_type_code === 'MCQ' || form.question_type_code === 'TF';
  const payload: Record<string, unknown> = {
    question_type_id: form.question_type_id,
    body_en: text,
    body_bn: text || undefined,
    difficulty: form.difficulty,
    marks: isMcqOrTf ? form.marks : 1,
    negative_marks:
      form.question_type_code === 'MCQ' && form.negative_marks ? form.negative_marks : undefined,
    time_seconds: isMcqOrTf ? form.time_seconds : 60,
    language: form.language,
    note: form.note.trim() || undefined,
  };

  if (options?.includeBookLinks) {
    payload.book_links = form.book_links
      .filter((l) => l.link_level && l.book_chapter_id)
      .map((l) => ({
        link_level: l.link_level,
        book_chapter_id: l.book_chapter_id,
        book_topic_id: l.book_topic_id || undefined,
        book_sub_topic_id: l.book_sub_topic_id || undefined,
        regulation_id: l.regulation_id || undefined,
      }));
    // Only meaningful on first create — a pending mother-question pick made before the question exists.
    payload.mother_question_id = form.mother_question_id || undefined;
  }

  if (form.question_type_code === 'TF') {
    payload.correct_true_false = form.correct_true_false;
    payload.explanation_sections = form.explanation_sections;
  } else if (form.question_type_code === 'MCQ') {
    payload.options = form.options
      .filter((o) => o.option_text_en.trim())
      .map((o) => ({
        option_key: o.option_key,
        option_text_en: o.option_text_en.trim(),
        option_text_bn: o.option_text_bn?.trim() || undefined,
      }));
    payload.correct_option_key = form.correct_option_key;
    payload.explanation_sections = form.explanation_sections;
  } else if (form.question_type_code === 'DIFFERENCES') {
    payload.model_answer_comparison = form.model_answer_comparison;
    payload.model_answer_sections = [];
  } else if (!form.has_options) {
    payload.model_answer_sections = form.model_answer_sections;
  }

  return payload;
}

/** @deprecated Use QuestionEditor */
export { QuestionEditor as McqEditor, emptyQuestionForm as emptyMcqForm, questionFormToPayload as mcqFormToPayload };
export type { QuestionFormValues as McqFormValues };
