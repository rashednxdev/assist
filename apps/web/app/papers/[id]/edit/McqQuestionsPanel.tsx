'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ReviewStatusBadge, type ReviewStatus } from '@/components/questions/review-status';
import {
  applyComposerBankQuery,
  ComposerBankFilters,
  type ComposerBankSubjectOption,
  type ComposerBankTypeOption,
} from './composer-bank-filters';
import type { PaperQuestionRow } from './page';

interface BankMcqQuestion {
  id: string;
  question_type_code: string;
  body_en: string;
  body_bn?: string;
  marks: number;
  is_published?: boolean;
  review_status?: ReviewStatus;
  book_id?: string;
  book_name?: string;
}

interface BookOption {
  id: string;
  name: string;
  short_name?: string;
}

interface ChapterOption {
  id: string;
  name: string;
  chapter_number?: string;
}

function truncate(text: string, len = 120) {
  return text.length > len ? `${text.slice(0, len)}…` : text;
}

function questionReviewStatus(q?: {
  review_status?: ReviewStatus;
  is_published?: boolean;
}): ReviewStatus {
  if (q?.review_status) return q.review_status;
  return q?.is_published ? 'published' : 'draft';
}

function isPublishedBankQuestion(q: { review_status?: ReviewStatus; is_published?: boolean }) {
  return questionReviewStatus(q) === 'published' || q.is_published === true;
}

/**
 * MCQ-only paper composer view: no sections/composite parts (those don't apply to a straight
 * MCQ paper) — just the flat question list plus batch-add from the question bank, grouped by
 * book so an admin can pick a whole book/chapter's worth of MCQs at once.
 */
export function McqQuestionsPanel({
  paperId,
  questions,
  readOnly,
  onReload,
  onError,
  onMessage,
}: {
  paperId: string;
  questions: PaperQuestionRow[];
  readOnly: boolean;
  onReload: () => Promise<void>;
  onError: (msg: string) => void;
  onMessage: (msg: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [bank, setBank] = useState<BankMcqQuestion[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankError, setBankError] = useState('');
  const [bankFetched, setBankFetched] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [books, setBooks] = useState<BookOption[]>([]);
  const [filterBookId, setFilterBookId] = useState('');
  const [filterChapters, setFilterChapters] = useState<ChapterOption[]>([]);
  const [filterChapterId, setFilterChapterId] = useState('');
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterTypeCodes, setFilterTypeCodes] = useState<string[]>(['MCQ']);
  const [filterSubjectIds, setFilterSubjectIds] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<ComposerBankSubjectOption[]>([]);
  const [types, setTypes] = useState<ComposerBankTypeOption[]>([]);

  const existingQuestionIds = useMemo(
    () => new Set(questions.map((q) => q.question_id).filter((id): id is string => Boolean(id))),
    [questions],
  );

  useEffect(() => {
    if (!pickerOpen || books.length > 0) return;
    apiFetch<{ data: BookOption[] }>('/books')
      .then((r) => setBooks(r.data))
      .catch(() => setBooks([]));
  }, [pickerOpen, books.length]);

  useEffect(() => {
    if (!pickerOpen || subjects.length > 0) return;
    apiFetch<{ data: ComposerBankSubjectOption[] }>('/questions/subject-catalog')
      .then((r) => setSubjects(r.data))
      .catch(() => setSubjects([]));
  }, [pickerOpen, subjects.length]);

  useEffect(() => {
    if (!pickerOpen || types.length > 0) return;
    apiFetch<{ data: ComposerBankTypeOption[] }>('/questions/types')
      .then((r) => setTypes(r.data))
      .catch(() => setTypes([]));
  }, [pickerOpen, types.length]);

  useEffect(() => {
    if (!filterBookId) {
      setFilterChapters([]);
      setFilterChapterId('');
      return;
    }
    apiFetch<{ data: ChapterOption[] }>(`/books/${filterBookId}/chapters`)
      .then((r) => {
        setFilterChapters(r.data);
        setFilterChapterId('');
      })
      .catch(() => setFilterChapters([]));
  }, [filterBookId]);

  useEffect(() => {
    if (!pickerOpen) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setBankLoading(true);
        setBankError('');
        try {
          const baseParams = new URLSearchParams();
          applyComposerBankQuery(baseParams, {
            q: search,
            reviewStatuses: filterStatuses,
            typeCodes: filterTypeCodes.length ? filterTypeCodes : ['MCQ'],
            subjectIds: filterSubjectIds,
          });
          if (filterChapterId) baseParams.set('book_chapter_id', filterChapterId);
          else if (filterBookId) baseParams.set('book_info_id', filterBookId);

          // The question-bank endpoint caps `limit` at 100 per request, so pull every page —
          // the composer is meant to offer the full MCQ bank (hundreds of questions) to select
          // from in one go, not just the first page.
          const pageSize = 100;
          const all: BankMcqQuestion[] = [];
          let offset = 0;
          for (;;) {
            if (cancelled) return;
            const params = new URLSearchParams(baseParams);
            params.set('limit', String(pageSize));
            params.set('offset', String(offset));
            const r = await apiFetch<{ data: BankMcqQuestion[]; meta?: { has_more?: boolean } }>(
              `/questions?${params.toString()}`,
            );
            all.push(...r.data);
            if (!r.meta?.has_more) break;
            offset += pageSize;
          }
          if (!cancelled) setBank(all);
        } catch (err) {
          if (!cancelled) {
            setBank([]);
            setBankError(err instanceof Error ? err.message : 'Failed to load question bank');
          }
        } finally {
          if (!cancelled) {
            setBankLoading(false);
            setBankFetched(true);
          }
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pickerOpen, search, filterBookId, filterChapterId, filterStatuses, filterTypeCodes, filterSubjectIds]);

  const groupedByBook = useMemo(() => {
    const available = bank.filter((q) => !existingQuestionIds.has(q.id));
    const groups = new Map<string, { label: string; items: BankMcqQuestion[] }>();
    for (const q of available) {
      const key = q.book_id ?? '__none__';
      const label = q.book_name ?? 'Not linked to a book';
      if (!groups.has(key)) groups.set(key, { label, items: [] });
      groups.get(key)!.items.push(q);
    }
    return [...groups.values()]
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((g) => ({ ...g, items: g.items.sort((a, b) => a.body_en.localeCompare(b.body_en)) }));
  }, [bank, existingQuestionIds]);

  function toggleSelected(id: string, allowed: boolean) {
    if (!allowed) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function closePicker() {
    setPickerOpen(false);
    setSearch('');
    setSelected(new Set());
    setFilterBookId('');
    setFilterChapterId('');
    setFilterStatuses([]);
    setFilterTypeCodes(['MCQ']);
    setFilterSubjectIds([]);
  }

  async function addSelected() {
    if (selected.size === 0) return;
    setAdding(true);
    onError('');
    try {
      const res = await apiFetch<{
        data: { added_count: number; skipped_count: number };
      }>(`/papers/${paperId}/questions/batch`, {
        method: 'POST',
        body: JSON.stringify({ question_ids: [...selected] }),
      });
      onMessage(
        res.data.skipped_count > 0
          ? `Added ${res.data.added_count} questions (${res.data.skipped_count} skipped — already on paper or not eligible)`
          : `Added ${res.data.added_count} questions`,
      );
      closePicker();
      await onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to add questions');
    } finally {
      setAdding(false);
    }
  }

  async function deleteQuestion(pq: PaperQuestionRow) {
    if (!confirm(`Remove question ${pq.question_number}?`)) return;
    onError('');
    try {
      await apiFetch(`/papers/questions/${pq.id}`, { method: 'DELETE' });
      onMessage('Question removed');
      await onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  const sortedQuestions = [...questions].sort((a, b) => a.question_number - b.question_number);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">Questions ({sortedQuestions.length})</CardTitle>
        {!readOnly && !pickerOpen && (
          <Button type="button" size="sm" onClick={() => setPickerOpen(true)}>
            <Plus className="h-4 w-4" />
            Add questions
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {!readOnly && pickerOpen && (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">Add from question bank</p>
              <Button type="button" size="sm" variant="ghost" onClick={closePicker}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ComposerBankFilters
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search MCQ question bank..."
              reviewStatuses={filterStatuses}
              onReviewStatusesChange={setFilterStatuses}
              typeCodes={filterTypeCodes}
              onTypeCodesChange={setFilterTypeCodes}
              types={types}
              subjectIds={filterSubjectIds}
              onSubjectIdsChange={setFilterSubjectIds}
              subjects={subjects}
            />
            <p className="text-xs text-muted">
              Draft and quality-check questions are listed for tracing. Only published MCQ
              questions can be added to this paper.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="mcq-filter-book">Book / Tool</Label>
                <select
                  id="mcq-filter-book"
                  value={filterBookId}
                  onChange={(e) => setFilterBookId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">All books</option>
                  {books.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mcq-filter-chapter">Chapter</Label>
                <select
                  id="mcq-filter-chapter"
                  value={filterChapterId}
                  disabled={!filterBookId || filterChapters.length === 0}
                  onChange={(e) => setFilterChapterId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">{filterBookId ? 'All chapters' : 'Select a book first'}</option>
                  {filterChapters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.chapter_number ? `${c.chapter_number}: ` : ''}
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {bankError ? (
              <p className="text-sm text-destructive">{bankError}</p>
            ) : bankLoading ? (
              <p className="text-sm text-muted">Loading question bank…</p>
            ) : bankFetched && bank.length === 0 ? (
              <p className="text-sm text-muted">
                No questions matched these filters.
              </p>
            ) : groupedByBook.length === 0 ? (
              <p className="text-sm text-muted">
                Found {bank.length} matching question{bank.length === 1 ? '' : 's'}, but all of
                them are already on this paper.
              </p>
            ) : (
              <div className="max-h-96 space-y-4 overflow-y-auto">
                {groupedByBook.map((group) => (
                  <div key={group.label}>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                      {group.label}
                    </div>
                    <div className="space-y-1">
                      {group.items.map((q) => {
                        const canAdd = isPublishedBankQuestion(q) && q.question_type_code === 'MCQ';
                        return (
                        <label
                          key={q.id}
                          className={`flex items-start gap-2 rounded-md border border-border p-2 text-sm ${
                            canAdd ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default opacity-80'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={selected.has(q.id)}
                            disabled={!canAdd}
                            onChange={() => toggleSelected(q.id, canAdd)}
                          />
                          <span className="min-w-0 flex-1">
                            <Badge variant="secondary" className="mr-1.5">
                              {q.question_type_code}
                            </Badge>
                            <ReviewStatusBadge status={questionReviewStatus(q)} />
                            <span className="ml-1.5">{truncate(q.body_en || q.body_bn || '')}</span>
                          </span>
                        </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted">{selected.size} selected</span>
              <Button type="button" size="sm" disabled={selected.size === 0 || adding} onClick={() => void addSelected()}>
                {adding ? 'Adding...' : `Add ${selected.size || ''} question${selected.size === 1 ? '' : 's'}`}
              </Button>
            </div>
          </div>
        )}

        {sortedQuestions.length === 0 ? (
          <p className="text-sm text-muted">No questions on this paper yet.</p>
        ) : (
          <div className="space-y-2">
            {sortedQuestions.map((pq) => (
              <div
                key={pq.id}
                className="flex items-start justify-between gap-2 rounded-md border border-border bg-slate-50/80 p-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
                    <span className="shrink-0 font-semibold">{pq.question_number}.</span>
                    <span>{truncate(pq.question?.body_en ?? '')}</span>
                    {pq.question?.question_type_code && (
                      <Badge variant="secondary">{pq.question.question_type_code}</Badge>
                    )}
                    {pq.question ? (
                      <ReviewStatusBadge status={questionReviewStatus(pq.question)} />
                    ) : null}
                  </div>
                </div>
                {!readOnly && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 shrink-0 px-2"
                    onClick={() => void deleteQuestion(pq)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
