import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { BookLoading } from '@/components/books/BookStates';
import { BookRichText } from '@/components/books/BookRichText';
import {
  fetchQuestionPracticeStem,
  upsertQuestionEvaluation,
  type QuestionEvaluationRecord,
  type QuestionPracticeStem,
} from '@/lib/evaluation-api';
import { fetchQuestionDetail } from '@/lib/questions-api';
import type { ChapterQuestionBrief } from '@/types/books';
import { colors, spacing } from '@/theme';

const SECONDS_PER_MCQ = 60;

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function optionLabel(option: { option_text_en?: string; option_text_bn?: string }) {
  return option.option_text_en?.trim() || option.option_text_bn?.trim() || '';
}

export function ChapterMcqExam({
  questions,
  onBack,
  onComplete,
}: {
  questions: ChapterQuestionBrief[];
  onBack: () => void;
  onComplete?: (results: QuestionEvaluationRecord[]) => void;
}) {
  const [stems, setStems] = useState<QuestionPracticeStem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState(questions.length * SECONDS_PER_MCQ);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<QuestionEvaluationRecord[]>([]);
  const [correctByQuestion, setCorrectByQuestion] = useState<Record<string, string>>({});
  const autoSubmitted = useRef(false);

  const totalSeconds = questions.length * SECONDS_PER_MCQ;

  useEffect(() => {
    setLoading(true);
    setLoadError('');
    Promise.all(questions.map((q) => fetchQuestionPracticeStem(q.id)))
      .then(setStems)
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load questions'))
      .finally(() => setLoading(false));
  }, [questions]);

  const submitExam = useCallback(async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    try {
      const rows: QuestionEvaluationRecord[] = [];
      for (const stem of stems) {
        const selected = selections[stem.id];
        if (!selected) continue;
        const row = await upsertQuestionEvaluation(stem.id, { selected_option_id: selected });
        rows.push(row);
      }
      const details = await Promise.all(stems.map((s) => fetchQuestionDetail(s.id)));
      const correctMap: Record<string, string> = {};
      for (const detail of details) {
        const correct = detail.options.find((o) => o.is_correct);
        if (correct) correctMap[detail.id] = correct.id;
      }
      setCorrectByQuestion(correctMap);
      setResults(rows);
      setSubmitted(true);
      onComplete?.(rows);
    } finally {
      setSubmitting(false);
    }
  }, [stems, selections, submitting, submitted, onComplete]);

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

  const correctCount = useMemo(() => results.filter((r) => r.is_correct).length, [results]);

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
            <Text style={styles.statValue}>{questions.length}</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statLabel}>Answered</Text>
            <Text style={styles.statValue}>
              {submitted ? results.length : answeredCount}/{questions.length}
            </Text>
          </View>
        </View>
        {!submitted ? (
          <Text style={styles.hint}>
            Answer all questions below. Total time: {formatTime(totalSeconds)} ({SECONDS_PER_MCQ}s per MCQ).
          </Text>
        ) : (
          <Text style={styles.resultBanner}>
            Exam complete — {correctCount} correct out of {results.length} submitted
          </Text>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {stems.map((stem, index) => (
          <View key={stem.id} style={styles.questionCard}>
            <Text style={styles.questionNum}>Q{index + 1}</Text>
            <BookRichText html={stem.body_en || stem.body_bn || ''} style={styles.questionBody} />
            <View style={styles.optionsWrap}>
              {stem.options.map((opt) => {
                const selected = selections[stem.id] === opt.id;
                const result = results.find((r) => r.question_id === stem.id);
                const correctOptionId = correctByQuestion[stem.id];
                const showResult = submitted && Boolean(result);
                const isCorrectAnswer = correctOptionId === opt.id;
                const isWrongPick = showResult && selected && result?.is_correct === false;
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
                    onPress={() =>
                      setSelections((prev) => ({
                        ...prev,
                        [stem.id]: opt.id,
                      }))
                    }
                  >
                    <View style={styles.optionContent}>
                      <Text style={styles.optionKey}>{opt.option_key.toUpperCase()}.</Text>
                      <BookRichText html={optionLabel(opt)} style={styles.optionText} />
                    </View>
                    {showResult && isCorrectAnswer ? (
                      <Text style={styles.correctBadge}>Correct</Text>
                    ) : null}
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
              {submitting ? 'Submitting…' : `Submit exam (${answeredCount}/${questions.length})`}
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
