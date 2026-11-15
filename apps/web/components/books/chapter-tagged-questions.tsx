'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { serializeExplanationSections, type ComparisonTable, type ExplanationSection } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { QuestionAnswerView } from '@/components/questions/question-answer-view';
import { QuestionEvaluator } from '@/components/evaluation/question-evaluator';
import { RatingIndicator } from '@/components/evaluation/rating-indicator';
import { bookTheme } from '@/lib/book-theme';
import type { QuestionEvalBrief } from '@/lib/evaluation-display';
import { useAnswerRead } from '@/lib/use-answer-read';

interface ChapterQuestionBrief {
  id: string;
  question_type_code: string;
  question_type_name?: string;
  body_en: string;
  body_bn?: string;
  marks: number;
  difficulty: string;
}

interface QuestionDetail {
  id: string;
  body_en: string;
  body_bn?: string;
  marks: number;
  question_type_code: string;
  question_type_name?: string;
  has_options: boolean;
  model_answer_sections?: ExplanationSection[];
  model_answer_comparison?: ComparisonTable;
  explanation_sections?: ExplanationSection[];
  note?: string;
  options: {
    id: string;
    option_key: string;
    option_text_en: string;
    option_text_bn?: string;
    is_correct: boolean;
  }[];
}

function truncate(text: string, len = 100) {
  const plain = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return plain.length > len ? `${plain.slice(0, len)}…` : plain;
}

export function ChapterTaggedQuestions({
  chapterId,
  open,
  onOpenChange,
}: {
  chapterId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [questions, setQuestions] = useState<ChapterQuestionBrief[]>([]);
  const [evalMap, setEvalMap] = useState<Map<string, QuestionEvalBrief>>(new Map());
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [listError, setListError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [question, setQuestion] = useState<QuestionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  useAnswerRead(selectedId ?? undefined, Boolean(question));

  useEffect(() => {
    if (!open) {
      setSelectedId(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !chapterId) return;
    let cancelled = false;
    setLoadingList(true);
    setListError('');
    setQuestions([]);
    apiFetch<{ data: ChapterQuestionBrief[]; meta: { has_more: boolean } }>(
      `/books/chapters/${chapterId}/questions?limit=20&offset=0`,
    )
      .then(async (res) => {
        if (cancelled) return;
        setQuestions(res.data);
        setHasMore(res.meta.has_more);
        if (res.data.length === 0) {
          setEvalMap(new Map());
          return;
        }
        const evalRes = await apiFetch<{ data: QuestionEvalBrief[] }>(
          `/evaluation/questions/batch?ids=${res.data.map((q) => q.id).join(',')}`,
        );
        if (cancelled) return;
        const map = new Map<string, QuestionEvalBrief>();
        for (const row of evalRes.data) {
          if (row.progress_index > 0 || row.self_rating || row.is_correct !== undefined || (row.read_count ?? 0) > 0) {
            map.set(row.question_id, row);
          }
        }
        setEvalMap(map);
      })
      .catch((err) => {
        if (cancelled) return;
        setListError(err instanceof Error ? err.message : 'Failed to load questions');
        setQuestions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, chapterId]);

  useEffect(() => {
    if (!open || !hasMore || loadingList || loadingMore) return;
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      setLoadingMore(true);
      apiFetch<{ data: ChapterQuestionBrief[]; meta: { has_more: boolean } }>(
        `/books/chapters/${chapterId}/questions?limit=20&offset=${questions.length}`,
      )
        .then(async (res) => {
          setQuestions((prev) => {
            const seen = new Set(prev.map((q) => q.id));
            return [...prev, ...res.data.filter((q) => !seen.has(q.id))];
          });
          setHasMore(res.meta.has_more);
          if (res.data.length === 0) return;
          const evalRes = await apiFetch<{ data: QuestionEvalBrief[] }>(
            `/evaluation/questions/batch?ids=${res.data.map((q) => q.id).join(',')}`,
          );
          setEvalMap((prev) => {
            const next = new Map(prev);
            for (const row of evalRes.data) next.set(row.question_id, row);
            return next;
          });
        })
        .catch(() => setHasMore(false))
        .finally(() => setLoadingMore(false));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [open, hasMore, loadingList, loadingMore, questions.length, chapterId]);

  useEffect(() => {
    if (!selectedId) {
      setQuestion(null);
      return;
    }
    setLoadingDetail(true);
    apiFetch<{ data: QuestionDetail }>(`/questions/${selectedId}`)
      .then((res) => setQuestion(res.data))
      .catch(() => setQuestion(null))
      .finally(() => setLoadingDetail(false));
  }, [selectedId]);

  function handleEvalUpdated(record: QuestionEvalBrief) {
    setEvalMap((prev) => {
      const next = new Map(prev);
      next.set(record.question_id, record);
      return next;
    });
  }

  if (!open) return null;

  return (
    <aside className={`lg:sticky lg:top-4 lg:self-start ${bookTheme.panel}`}>
      <div className={`flex items-center justify-between gap-2 border-b px-4 py-3 ${bookTheme.divider}`}>
        <h2 className="text-sm font-semibold">Tagged questions</h2>
        <Button type="button" size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </div>

      <div className="max-h-[70vh] overflow-y-auto p-4">
          {selectedId ? (
            <div className="space-y-4">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2"
                onClick={() => setSelectedId(null)}
              >
                <ChevronLeft className="h-4 w-4" />
                Back to list
              </Button>

              {loadingDetail ? (
                <div className="space-y-2">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : !question ? (
                <p className="text-sm text-muted">Question not found.</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{question.question_type_code}</Badge>
                    <Badge variant="secondary">{question.marks} marks</Badge>
                  </div>
                  <p className="text-sm leading-relaxed">{question.body_en}</p>
                  <QuestionEvaluator questionId={selectedId} onUpdated={handleEvalUpdated} />
                  <div className="border-t border-[#e2e8f0] pt-4">
                    <h3 className="mb-2 text-sm font-semibold text-muted">Answer</h3>
                    <QuestionAnswerView
                      body_en={question.body_en}
                      body_bn={question.body_bn}
                      has_options={question.has_options}
                      options={question.options}
                      model_answer_sections={serializeExplanationSections(question.model_answer_sections)}
                      model_answer_comparison={question.model_answer_comparison}
                      explanation_sections={serializeExplanationSections(question.explanation_sections)}
                      answer_note={question.note}
                      showAnswer
                    />
                  </div>
                </>
              )}
            </div>
          ) : loadingList ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : listError ? (
            <p className="text-sm text-destructive">{listError}</p>
          ) : questions.length === 0 ? (
            <p className="text-sm text-muted">
              No published questions are tagged to this chapter yet. Link questions in Question Bank and publish them
              to appear here.
            </p>
          ) : (
            <ul className="space-y-2">
              {questions.map((q) => (
                <li key={q.id}>
                  <button
                    type="button"
                    className={`w-full text-left px-3 py-2 text-sm ${bookTheme.listItem}`}
                    onClick={() => setSelectedId(q.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-[10px]">
                            {q.question_type_code}
                          </Badge>
                          <span className="text-xs text-muted">{q.marks}m</span>
                        </div>
                        <span className="line-clamp-2">{truncate(q.body_en)}</span>
                      </div>
                      <RatingIndicator evaluation={evalMap.get(q.id)} className="mt-1" />
                    </div>
                  </button>
                </li>
              ))}
              <div ref={sentinel} className="h-4" />
              {loadingMore ? <p className="text-center text-xs text-muted">Loading more…</p> : null}
            </ul>
          )}
      </div>
    </aside>
  );
}
