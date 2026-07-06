import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SELF_RATING_PROGRESS } from '@ibas/shared-constants';
import { RatingIndicator } from '@/components/evaluation/RatingIndicator';
import { formatEvaluationStatusLabel } from '@/lib/evaluation-display';
import {
  fetchQuestionEvaluation,
  fetchQuestionPracticeStem,
  upsertQuestionEvaluation,
  type QuestionEvaluationRecord,
  type SelfRatingLevel,
} from '@/lib/evaluation-api';
import { fetchQuestionDetail } from '@/lib/questions-api';
import { colors, spacing } from '@/theme';

const SELF_LABELS: Record<SelfRatingLevel, string> = {
  overall: 'Overall (50%)',
  understand: 'Understand (75%)',
  confidence: 'Confidence (100%)',
};

function renderOptionText(option: { option_text_en?: string; option_text_bn?: string }) {
  return option.option_text_en?.trim() || option.option_text_bn?.trim() || '';
}

export function ChapterQuestionEvaluator({
  questionId,
  onUpdated,
}: {
  questionId: string;
  onUpdated?: (record: QuestionEvaluationRecord) => void;
}) {
  const [hasOptions, setHasOptions] = useState(false);
  const [options, setOptions] = useState<
    { id: string; option_key: string; option_text_en?: string; option_text_bn?: string }[]
  >([]);
  const [evaluation, setEvaluation] = useState<QuestionEvaluationRecord | null>(null);
  const [correctOptionId, setCorrectOptionId] = useState<string | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    setCorrectOptionId(null);
    Promise.all([fetchQuestionPracticeStem(questionId), fetchQuestionEvaluation(questionId)])
      .then(async ([stem, evalRow]) => {
        setHasOptions(stem.has_options);
        setOptions(stem.options);
        setEvaluation(evalRow);
        setSelectedOptionId(evalRow.selected_option_id ?? '');
        if (stem.has_options && evalRow.is_correct === false) {
          const detail = await fetchQuestionDetail(questionId);
          const correct = detail.options.find((o) => o.is_correct);
          setCorrectOptionId(correct?.id ?? null);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load evaluation'))
      .finally(() => setLoading(false));
  }, [questionId]);

  async function loadCorrectOption() {
    const detail = await fetchQuestionDetail(questionId);
    const correct = detail.options.find((o) => o.is_correct);
    setCorrectOptionId(correct?.id ?? null);
  }

  async function submitOption() {
    if (!selectedOptionId) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await upsertQuestionEvaluation(questionId, { selected_option_id: selectedOptionId });
      setEvaluation(res);
      if (res.is_correct === false) {
        await loadCorrectOption();
        setMessage('Incorrect — correct answer shown below.');
      } else {
        setCorrectOptionId(selectedOptionId);
        setMessage('Answer saved.');
      }
      onUpdated?.(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit answer');
    } finally {
      setSaving(false);
    }
  }

  async function submitSelfRating(level: SelfRatingLevel) {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await upsertQuestionEvaluation(questionId, { self_rating: level });
      setEvaluation(res);
      setMessage('Self-rating saved.');
      onUpdated?.(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit rating');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Text style={styles.muted}>Loading evaluation…</Text>;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Self evaluation</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      {hasOptions ? (
        <View style={styles.block}>
          <Text style={styles.hint}>Select your answer:</Text>
          {options.map((opt) => {
            const selected = selectedOptionId === opt.id;
            const showFeedback = evaluation?.is_correct !== undefined;
            const isCorrectAnswer = correctOptionId === opt.id;
            const isWrongPick = showFeedback && selected && evaluation?.is_correct === false;
            return (
              <Pressable
                key={opt.id}
                style={[
                  styles.optionRow,
                  selected && !showFeedback && styles.optionRowActive,
                  showFeedback && isCorrectAnswer && styles.optionRowCorrect,
                  isWrongPick && styles.optionRowWrong,
                ]}
                disabled={showFeedback}
                onPress={() => setSelectedOptionId(opt.id)}
              >
                <View style={styles.optionContent}>
                  <Text style={styles.optionKey}>{opt.option_key.toUpperCase()}.</Text>
                  <Text style={styles.optionText}>{renderOptionText(opt)}</Text>
                </View>
                {showFeedback && isCorrectAnswer ? (
                  <Text style={styles.correctBadge}>Correct</Text>
                ) : null}
                {isWrongPick ? <Text style={styles.wrongBadge}>Your answer</Text> : null}
              </Pressable>
            );
          })}
          <Pressable
            style={[styles.submitBtn, (!selectedOptionId || saving) && styles.submitBtnDisabled]}
            disabled={!selectedOptionId || saving}
            onPress={() => void submitOption()}
          >
            <Text style={styles.submitBtnText}>
              {saving ? 'Saving…' : evaluation?.selected_option_id ? 'Update answer' : 'Submit answer'}
            </Text>
          </Pressable>
          {evaluation?.is_correct !== undefined ? (
            <View style={styles.savedRow}>
              <RatingIndicator evaluation={evaluation} />
              <Text style={[styles.result, evaluation.is_correct ? styles.correct : styles.wrong]}>
                {evaluation.is_correct ? 'Correct' : 'Incorrect'}
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.block}>
          <Text style={styles.hint}>Rate yourself after reviewing the answer:</Text>
          <View style={styles.ratingWrap}>
            {(
              Object.keys(SELF_RATING_PROGRESS) as Array<keyof typeof SELF_RATING_PROGRESS & SelfRatingLevel>
            ).map((level) => (
              <Pressable
                key={level}
                style={[styles.ratingBtn, evaluation?.self_rating === level && styles.ratingBtnActive]}
                disabled={saving}
                onPress={() => void submitSelfRating(level)}
              >
                <Text
                  style={[
                    styles.ratingBtnText,
                    evaluation?.self_rating === level && styles.ratingBtnTextActive,
                  ]}
                >
                  {SELF_LABELS[level]}
                </Text>
              </Pressable>
            ))}
          </View>
          {evaluation?.self_rating ? (
            <View style={styles.savedRow}>
              <RatingIndicator evaluation={evaluation} />
              <Text style={styles.hint}>{formatEvaluationStatusLabel(evaluation, false)} saved</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  block: {
    gap: spacing.sm,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
    backgroundColor: colors.surface,
  },
  optionRowActive: {
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
  optionContent: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  optionKey: {
    fontWeight: '700',
    color: colors.textMuted,
    width: 22,
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
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  submitBtnDisabled: {
    opacity: 0.55,
  },
  submitBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  result: {
    fontSize: 13,
    fontWeight: '600',
  },
  correct: {
    color: colors.success,
  },
  wrong: {
    color: colors.error,
  },
  ratingWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ratingBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  ratingBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  ratingBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  ratingBtnTextActive: {
    color: colors.white,
  },
  muted: {
    fontSize: 13,
    color: colors.textMuted,
  },
  error: {
    fontSize: 13,
    color: colors.error,
    fontWeight: '600',
  },
  success: {
    fontSize: 13,
    color: colors.success,
    fontWeight: '600',
  },
});
