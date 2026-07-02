'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { serializeExplanationSections, type ExplanationSection } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { QuestionAnswerView } from '@/components/questions/question-answer-view';
import { QuestionEvaluator } from '@/components/evaluation/question-evaluator';
import { RatingIndicator } from '@/components/evaluation/rating-indicator';
import { bookTheme } from '@/lib/book-theme';
import type { QuestionEvalBrief } from '@/lib/evaluation-display';

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
  const [listError, setListError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [question, setQuestion] = useState<QuestionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedId(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !chapterId) return;
    setLoadingList(true);
    setListError('');
    apiFetch<{ data: ChapterQuestionBrief[] }>(`/books/chapters/${chapterId}/questions`)
      .then(async (res) => {
        setQuestions(res.data);
        if (res.data.length === 0) {
          setEvalMap(new Map());
          return;
        }
        const ids = res.data.map((q) => q.id).join(',');
        const evalRes = await apiFetch<{ data: QuestionEvalBrief[] }>(
          `/evaluation/questions/batch?ids=${ids}`,
        );
        const map = new Map<string, QuestionEvalBrief>();
        for (const row of evalRes.data) {
          if (row.progress_index > 0 || row.self_rating || row.is_correct !== undefined) {
            map.set(row.question_id, row);
          }
        }
        setEvalMap(map);
      })
      .catch((err) => {
        setListError(err instanceof Error ? err.message : 'Failed to load questions');
        setQuestions([]);
      })
      .finally(() => setLoadingList(false));
  }, [open, chapterId]);

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
                  <div className="border-t border-amber-900/10 pt-4">
                    <h3 className="mb-2 text-sm font-semibold text-muted">Answer</h3>
                    <QuestionAnswerView
                      body_en={question.body_en}
                      body_bn={question.body_bn}
                      has_options={question.has_options}
                      options={question.options}
                      model_answer_sections={serializeExplanationSections(question.model_answer_sections)}
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
            </ul>
          )}
      </div>
    </aside>
  );
}
