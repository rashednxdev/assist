import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { BookLoading } from '@/components/books/BookStates';
import { BookRichText } from '@/components/books/BookRichText';
import {
  fetchQuestionPracticeStem,
  fetchQuestionEvaluationsBatch,
  submitPaperAttempt,
  type PaperAttemptRecord,
  type QuestionEvalBrief,
  type QuestionPracticeStem,
} from '@/lib/evaluation-api';
import { fetchQuestionDetail } from '@/lib/questions-api';
import { getCachedMcqDetail, getCachedPracticeStem } from '@/lib/questions-db';
import type { PaperQuestionRow } from '@/types/papers';
import { colors, spacing } from '@/theme';

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function optionLabel(option: { option_text_en?: string; option_text_bn?: string }) {
  return option.option_text_en?.trim() || option.option_text_bn?.trim() || '';
}

/**
 * Timed, "real exam" MCQ flow for an MCQ-type paper (mobile only) — all questions on one
 * scrollable screen, single submit, countdown driven by the paper's own duration_minutes
 * (not a per-question estimate like the chapter practice exam). Scoring is entirely
 * server-computed by submitPaperAttempt; this component only re-fetches per-question
 * correctness/correct-option afterward to drive the reveal UI.
 */
export function PaperMcqExam({
  paperId,
  durationMinutes,
  questions,
  onBack,
  onSubmitted,
}: {
  paperId: string;
  durationMinutes: number;
  questions: PaperQuestionRow[];
  onBack: () => void;
  onSubmitted?: (attempt: PaperAttemptRecord) => void;
}) {
  const questionIds = useMemo(
    () => questions.map((q) => q.question_id).filter((id): id is string => Boolean(id)),
    [questions],
  );

  const [stems, setStems] = useState<QuestionPracticeStem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selections, setSelections] = useState<Record<string, string>>({});
  const totalSeconds = Math.max(60, Math.round(durationMinutes * 60));
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [attempt, setAttempt] = useState<PaperAttemptRecord | null>(null);
  const [evalByQuestion, setEvalByQuestion] = useState<Map<string, QuestionEvalBrief>>(new Map());
  const [correctByQuestion, setCorrectByQuestion] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const autoSubmitted = useRef(false);
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    setLoading(true);
    setLoadError('');
    Promise.all(
      questionIds.map((id) => {
        const cached = getCachedPracticeStem(id);
        return cached ? Promise.resolve(cached) : fetchQuestionPracticeStem(id);
      }),
    )
      .then(setStems)
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load questions'))
      .finally(() => setLoading(false));
  }, [questionIds]);

  const submitExam = useCallback(async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const answers = stems
        .map((stem) => ({ question_id: stem.id, selected_option_id: selections[stem.id] }))
        .filter((a): a is { question_id: string; selected_option_id: string } =>
          Boolean(a.selected_option_id),
        );

      const durationSeconds = Math.round((Date.now() - startedAtRef.current) / 1000);
      const result = await submitPaperAttempt(paperId, { answers, duration_seconds: durationSeconds });

      const [evalRows, details] = await Promise.all([
        fetchQuestionEvaluationsBatch(stems.map((s) => s.id)),
        Promise.all(
          stems.map((s) => {
            const cached = getCachedMcqDetail(s.id);
            return cached ? Promise.resolve(cached) : fetchQuestionDetail(s.id);
          }),
        ),
      ]);

      const evalMap = new Map(evalRows.map((r) => [r.question_id, r]));
      const correctMap: Record<string, string> = {};
      for (const detail of details) {
        const correct = detail.options.find((o) => o.is_correct);
        if (correct) correctMap[detail.id] = correct.id;
      }

      setEvalByQuestion(evalMap);
      setCorrectByQuestion(correctMap);
      setAttempt(result);
      setSubmitted(true);
      onSubmitted?.(result);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit exam');
    } finally {
      setSubmitting(false);
    }
  }, [stems, selections, submitting, submitted, paperId, onSubmitted]);

  useEffect(() => {
    if (loading || submitted || stems.length === 0) return;
    if (secondsLeft <= 0) {
      if (!autoSubmitted.current) {
        autoSubmitted.current = true;
        void submitExam();
      }
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, loading, submitted, stems.length, submitExam]);

  const answeredCount = useMemo(
    () => stems.filter((s) => Boolean(selections[s.id])).length,
    [stems, selections],
  );

  if (loading) return <BookLoading />;
  if (loadError) return <Text style={styles.error}>{loadError}</Text>;

  return (
    <View style={styles.root}>
      <View style={styles.examHeader}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </Pressable>
        <View style={styles.statsRow}>
          <View style={[styles.statPill, secondsLeft <= 30 && !submitted && styles.statPillWarn]}>
            <Text style={styles.statLabel}>Time</Text>
            <Text style={[styles.statValue, secondsLeft <= 30 && !submitted && styles.statValueWarn]}>
              {submitted ? '0:00' : formatTime(secondsLeft)}
            </Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statLabel}>MCQs</Text>
            <Text style={styles.statValue}>{stems.length}</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statLabel}>Answered</Text>
            <Text style={styles.statValue}>
              {submitted ? (attempt?.answered_count ?? 0) : answeredCount}/{stems.length}
            </Text>
          </View>
        </View>
        {!submitted ? (
          <Text style={styles.hint}>Answer all questions below. Total time: {formatTime(totalSeconds)}.</Text>
        ) : (
          <Text style={styles.resultBanner}>
            {attempt
              ? `Exam complete — ${attempt.correct_count} correct out of ${attempt.total_questions} · ${attempt.scored_marks}/${attempt.total_marks} marks · ${attempt.is_pass ? 'Pass' : 'Fail'}`
              : 'Exam complete'}
          </Text>
        )}
        {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {stems.map((stem, index) => (
          <View key={stem.id} style={styles.questionCard}>
            <Text style={styles.questionNum}>Q{index + 1}</Text>
            <BookRichText html={stem.body_en || stem.body_bn || ''} style={styles.questionBody} />
            <View style={styles.optionsWrap}>
              {stem.options.map((opt) => {
                const selected = selections[stem.id] === opt.id;
                const evalRow = evalByQuestion.get(stem.id);
                const correctOptionId = correctByQuestion[stem.id];
                const showResult = submitted && Boolean(evalRow);
                const isCorrectAnswer = correctOptionId === opt.id;
                const isWrongPick = showResult && selected && evalRow?.is_correct === false;
                return (
                  <Pressable
                    key={opt.id}
                    style={[
                      styles.optionRow,
                      selected && !submitted && styles.optionRowSelected,
                      showResult && isCorrectAnswer && styles.optionRowCorrect,
                      isWrongPick && styles.optionRowWrong,
                    ]}
                    disabled={submitted}
                    onPress={() => setSelections((prev) => ({ ...prev, [stem.id]: opt.id }))}
                  >
                    <View style={styles.optionContent}>
                      <Text style={styles.optionKey}>{opt.option_key.toUpperCase()}.</Text>
                      <BookRichText html={optionLabel(opt)} style={styles.optionText} />
                    </View>
                    {showResult && isCorrectAnswer ? <Text style={styles.correctBadge}>Correct</Text> : null}
                    {isWrongPick ? <Text style={styles.wrongBadge}>Yours</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {!submitted ? (
        <View style={styles.footer}>
          <Pressable
            style={[styles.submitBtn, (submitting || answeredCount === 0) && styles.submitBtnDisabled]}
            disabled={submitting || answeredCount === 0}
            onPress={() => void submitExam()}
          >
            <Text style={styles.submitBtnText}>
              {submitting ? 'Submitting…' : `Submit exam (${answeredCount}/${stems.length})`}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  examHeader: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.sm,
  },
  backBtn: {
    alignSelf: 'flex-start',
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statPill: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 72,
  },
  statPillWarn: {
    borderColor: colors.warning,
    backgroundColor: '#fffbeb',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  statValueWarn: {
    color: colors.warning,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
  resultBanner: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  questionCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  questionNum: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  questionBody: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    fontWeight: '500',
  },
  optionsWrap: {
    gap: 8,
    marginTop: 4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
    backgroundColor: colors.background,
  },
  optionRowSelected: {
    borderColor: colors.primary,
    backgroundColor: '#eef6ff',
  },
  optionRowCorrect: {
    borderColor: colors.success,
    backgroundColor: '#f0fdf4',
  },
  optionRowWrong: {
    borderColor: colors.error,
    backgroundColor: '#fef2f2',
  },
  optionKey: {
    fontWeight: '700',
    color: colors.textMuted,
    width: 22,
  },
  optionContent: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  correctBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.success,
    textTransform: 'uppercase',
  },
  wrongBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.error,
    textTransform: 'uppercase',
  },
  footer: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
  },
  submitBtnDisabled: {
    opacity: 0.55,
  },
  submitBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  error: {
    fontSize: 14,
    color: colors.error,
  },
});
