'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BOOK_LANGUAGES,
  OPTION_KEYS,
  QUESTION_DIFFICULTIES,
  QUESTION_LINK_LEVELS,
  type QuestionLinkLevel,
} from '@ibas/shared-constants';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

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
  model_answer: string;
  explanation: string;
  note: string;
  link_level: QuestionLinkLevel | '';
  book_id: string;
  book_chapter_id: string;
  book_topic_id: string;
  book_sub_topic_id: string;
  regulation_id: string;
}

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
  model_answer: '',
  explanation: '',
  note: '',
  link_level: '',
  book_id: '',
  book_chapter_id: '',
  book_topic_id: '',
  book_sub_topic_id: '',
  regulation_id: '',
};

interface QuestionTypeItem {
  id: string;
  code: string;
  name: string;
  has_options: boolean;
  note?: string;
}

interface BookItem {
  id: string;
  name: string;
  short_name: string;
}

interface ChapterItem {
  id: string;
  name: string;
  chapter_number?: string;
}

interface TopicItem {
  id: string;
  name: string;
  rule_number?: string;
}

interface SubTopicItem {
  id: string;
  name: string;
  rule_number?: string;
}

interface RegulationItem {
  id: string;
  regulation_no: string;
  title: string;
}

interface QuestionEditorProps {
  value: QuestionFormValues;
  onChange: (value: QuestionFormValues) => void;
  onSubmit: (e: React.FormEvent) => void;
  questionTypes: QuestionTypeItem[];
  busy?: boolean;
  error?: string;
  submitLabel?: string;
}

export function QuestionEditor({
  value,
  onChange,
  onSubmit,
  questionTypes,
  busy,
  error,
  submitLabel = 'Save question',
}: QuestionEditorProps) {
  const [books, setBooks] = useState<BookItem[]>([]);
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [subTopics, setSubTopics] = useState<SubTopicItem[]>([]);
  const [regulations, setRegulations] = useState<RegulationItem[]>([]);

  const selectedType = useMemo(
    () => questionTypes.find((t) => t.id === value.question_type_id),
    [questionTypes, value.question_type_id],
  );

  const isTf = value.question_type_code === 'TF';
  const isShortNote = value.question_type_code === 'SHORT_NOTE';
  const isDescriptive = value.question_type_code === 'DESCRIPTIVE';
  const isTextAnswer = isShortNote || isDescriptive;

  useEffect(() => {
    apiFetch<{ data: BookItem[] }>('/books').then((r) => setBooks(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!value.book_id) {
      setChapters([]);
      return;
    }
    apiFetch<{ data: ChapterItem[] }>(`/books/${value.book_id}/chapters`)
      .then((r) => setChapters(r.data))
      .catch(() => setChapters([]));
  }, [value.book_id]);

  useEffect(() => {
    if (!value.book_chapter_id) {
      setTopics([]);
      return;
    }
    apiFetch<{ data: { topics: TopicItem[] } }>(`/books/chapters/${value.book_chapter_id}`)
      .then((r) => setTopics(r.data.topics ?? []))
      .catch(() => setTopics([]));
  }, [value.book_chapter_id]);

  useEffect(() => {
    if (!value.book_topic_id) {
      setSubTopics([]);
      return;
    }
    apiFetch<{ data: { sub_topics: SubTopicItem[] } }>(`/books/topics/${value.book_topic_id}`)
      .then((r) => setSubTopics(r.data.sub_topics ?? []))
      .catch(() => setSubTopics([]));
  }, [value.book_topic_id]);

  useEffect(() => {
    if (!value.book_topic_id) {
      setRegulations([]);
      return;
    }
    apiFetch<{ data: { regulations: RegulationItem[] } }>(`/books/topics/${value.book_topic_id}`)
      .then((r) => setRegulations(r.data.regulations ?? []))
      .catch(() => setRegulations([]));
  }, [value.book_topic_id]);

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
    }
    if (t.code === 'SHORT_NOTE' && value.time_seconds === 60) {
      next.time_seconds = 180;
      next.marks = 3;
    }
    if (t.code === 'DESCRIPTIVE' && value.time_seconds === 60) {
      next.time_seconds = 600;
      next.marks = 10;
    }
    onChange({ ...value, ...next });
  }

  function updateOption(key: string, field: 'option_text_en' | 'option_text_bn', text: string) {
    patch({
      options: value.options.map((o) => (o.option_key === key ? { ...o, [field]: text } : o)),
    });
  }

  function onLinkLevelChange(level: QuestionLinkLevel | '') {
    if (!level) {
      patch({
        link_level: '',
        book_chapter_id: '',
        book_topic_id: '',
        book_sub_topic_id: '',
        regulation_id: '',
      });
      return;
    }
    patch({
      link_level: level,
      book_topic_id: level === 'chapter' ? '' : value.book_topic_id,
      book_sub_topic_id: level === 'sub_rule' ? value.book_sub_topic_id : '',
      regulation_id: level === 'chapter' ? '' : value.regulation_id,
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
            <Label htmlFor="body_en">Question (English) *</Label>
            <textarea
              id="body_en"
              required
              rows={3}
              value={value.body_en}
              onChange={(e) => patch({ body_en: e.target.value })}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="body_bn">Question (Bengali)</Label>
            <textarea
              id="body_bn"
              rows={2}
              value={value.body_bn}
              onChange={(e) => patch({ body_bn: e.target.value })}
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
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
            {value.has_options && (
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
          </div>
        </CardContent>
      </Card>

      {isTf && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Correct answer</CardTitle>
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

      {value.has_options && !isTf && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Answer options (MCQ)</CardTitle>
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
                  required
                  placeholder="Option text (English)"
                  value={opt.option_text_en}
                  onChange={(e) => updateOption(opt.option_key, 'option_text_en', e.target.value)}
                  className="mb-2"
                />
                <Input
                  placeholder="Option text (Bengali, optional)"
                  value={opt.option_text_bn ?? ''}
                  onChange={(e) => updateOption(opt.option_key, 'option_text_bn', e.target.value)}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isTextAnswer && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{isShortNote ? 'Model short answer' : 'Model answer'}</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              required
              rows={isDescriptive ? 6 : 4}
              value={value.model_answer}
              onChange={(e) => patch({ model_answer: e.target.value })}
              placeholder={
                isShortNote
                  ? 'Expected brief answer for examiners (2–5 sentences)'
                  : 'Full model answer for descriptive marking'
              }
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {isTextAnswer ? 'Notes & book linking' : 'Explanation & book linking'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isTextAnswer && (
            <div className="space-y-1.5">
              <Label htmlFor="explanation">Explanation (optional)</Label>
              <textarea
                id="explanation"
                rows={3}
                value={value.explanation}
                onChange={(e) => patch({ explanation: e.target.value })}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="link_level">Attach to book content</Label>
              <select
                id="link_level"
                value={value.link_level}
                onChange={(e) => onLinkLevelChange(e.target.value as QuestionLinkLevel | '')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">— Not linked —</option>
                {QUESTION_LINK_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l === 'chapter' ? 'Chapter' : l === 'rule' ? 'Rule / topic' : 'Sub-rule'}
                  </option>
                ))}
              </select>
            </div>

            {value.link_level && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="book_id">Book *</Label>
                  <select
                    id="book_id"
                    required
                    value={value.book_id}
                    onChange={(e) =>
                      patch({
                        book_id: e.target.value,
                        book_chapter_id: '',
                        book_topic_id: '',
                        book_sub_topic_id: '',
                        regulation_id: '',
                      })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">— Select book —</option>
                    {books.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.short_name} — {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="book_chapter_id">Chapter *</Label>
                  <select
                    id="book_chapter_id"
                    required
                    value={value.book_chapter_id}
                    disabled={!value.book_id}
                    onChange={(e) =>
                      patch({
                        book_chapter_id: e.target.value,
                        book_topic_id: '',
                        book_sub_topic_id: '',
                        regulation_id: '',
                      })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                  >
                    <option value="">— Select chapter —</option>
                    {chapters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.chapter_number ? `Ch. ${c.chapter_number}` : ''} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                {(value.link_level === 'rule' || value.link_level === 'sub_rule') && (
                  <div className="space-y-1.5">
                    <Label htmlFor="book_topic_id">Rule / topic *</Label>
                    <select
                      id="book_topic_id"
                      required
                      value={value.book_topic_id}
                      disabled={!value.book_chapter_id}
                      onChange={(e) =>
                        patch({ book_topic_id: e.target.value, book_sub_topic_id: '', regulation_id: '' })
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                    >
                      <option value="">— Select rule —</option>
                      {topics.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.rule_number ? `Rule ${t.rule_number}` : ''} — {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {value.link_level === 'sub_rule' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="book_sub_topic_id">Sub-rule *</Label>
                    <select
                      id="book_sub_topic_id"
                      required
                      value={value.book_sub_topic_id}
                      disabled={!value.book_topic_id}
                      onChange={(e) => patch({ book_sub_topic_id: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                    >
                      <option value="">— Select sub-rule —</option>
                      {subTopics.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.rule_number ? `${st.rule_number}` : ''} — {st.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {value.link_level !== 'chapter' && value.book_topic_id && (
                  <div className="space-y-1.5">
                    <Label htmlFor="regulation_id">Regulation (optional)</Label>
                    <select
                      id="regulation_id"
                      value={value.regulation_id}
                      onChange={(e) => patch({ regulation_id: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">— Optional —</option>
                      {regulations.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.regulation_no} — {r.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}
          </div>
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

export function questionFormToPayload(form: QuestionFormValues) {
  const payload: Record<string, unknown> = {
    question_type_id: form.question_type_id,
    body_en: form.body_en.trim(),
    body_bn: form.body_bn.trim() || undefined,
    difficulty: form.difficulty,
    marks: form.marks,
    negative_marks: form.has_options && form.negative_marks ? form.negative_marks : undefined,
    time_seconds: form.time_seconds,
    language: form.language,
    note: form.note.trim() || undefined,
    explanation: form.explanation.trim() || undefined,
    regulation_id: form.regulation_id || undefined,
  };

  if (form.link_level) {
    payload.link_level = form.link_level;
    payload.book_chapter_id = form.book_chapter_id || undefined;
    if (form.link_level === 'rule' || form.link_level === 'sub_rule') {
      payload.book_topic_id = form.book_topic_id || undefined;
    }
    if (form.link_level === 'sub_rule') {
      payload.book_sub_topic_id = form.book_sub_topic_id || undefined;
    }
  }

  if (form.question_type_code === 'TF') {
    payload.correct_true_false = form.correct_true_false;
  } else if (form.has_options) {
    payload.options = form.options
      .filter((o) => o.option_text_en.trim())
      .map((o) => ({
        option_key: o.option_key,
        option_text_en: o.option_text_en.trim(),
        option_text_bn: o.option_text_bn?.trim() || undefined,
      }));
    payload.correct_option_key = form.correct_option_key;
  } else {
    payload.model_answer = form.model_answer.trim();
  }

  return payload;
}

/** @deprecated Use QuestionEditor */
export { QuestionEditor as McqEditor, emptyQuestionForm as emptyMcqForm, questionFormToPayload as mcqFormToPayload };
export type { QuestionFormValues as McqFormValues };
