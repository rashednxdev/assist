import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SELF_RATING_PROGRESS } from '@ibas/shared-constants';
import { RatingIndicator } from '@/components/evaluation/RatingIndicator';
import { formatEvaluationStatusLabel } from '@/lib/evaluation-display';
import {
  fetchQuestionEvaluation,
  upsertQuestionEvaluation,
  type QuestionEvaluationRecord,
  type SelfRatingLevel,
} from '@/lib/evaluation-api';
import { colors, spacing } from '@/theme';

const SELF_LABELS: Record<SelfRatingLevel, string> = {
  overall: 'Overall (50%)',
  understand: 'Understand (75%)',
  confidence: 'Confidence (100%)',
};

/**
 * Self-rating widget for questions with no options (descriptive, differences, etc). MCQ/TF
 * questions use the merged Evaluate panel built directly into ChapterQuestionsPanel instead,
 * so this component only ever renders the self-rating branch.
 */
export function ChapterQuestionEvaluator({
  questionId,
  onUpdated,
}: {
  questionId: string;
  onUpdated?: (record: QuestionEvaluationRecord) => void;
}) {
  const [evaluation, setEvaluation] = useState<QuestionEvaluationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    fetchQuestionEvaluation(questionId)
      .then(setEvaluation)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load evaluation'))
      .finally(() => setLoading(false));
  }, [questionId]);

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

      <View style={styles.block}>
        <Text style={styles.hint}>Your study position on the question and answer</Text>
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
    color: colors.gold,
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
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
