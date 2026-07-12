import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { SELF_RATING_PROGRESS } from '@ibas/shared-constants';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { EvaluationCelebrate } from '@/components/evaluation/EvaluationCelebrate';
import { RatingIndicator } from '@/components/evaluation/RatingIndicator';
import { fetchQuestionDetail } from '@/lib/questions-api';
import { formatEvaluationStatusLabel } from '@/lib/evaluation-display';
import {
  fetchQuestionEvaluation,
  fetchQuestionPracticeStem,
  upsertQuestionEvaluation,
  type QuestionEvaluationRecord,
  type SelfRatingLevel,
} from '@/lib/evaluation-api';
import type { ComparisonTable, ExplanationSection, QuestionDetail, QuestionOption } from '@/types/questions';
import { colors, spacing } from '@/theme';

function renderOptionText(option: QuestionOption) {
  return option.option_text_en?.trim() || option.option_text_bn?.trim() || '';
}

export default function QuestionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const [item, setItem] = useState<QuestionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [evaluation, setEvaluation] = useState<QuestionEvaluationRecord | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [savingEval, setSavingEval] = useState(false);
  const [evalError, setEvalError] = useState('');
  const [evalMessage, setEvalMessage] = useState('');
  const [showCelebrate, setShowCelebrate] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([fetchQuestionDetail(id), fetchQuestionPracticeStem(id), fetchQuestionEvaluation(id)])
      .then(([data, stem, evalRow]) => {
        setItem(data);
        setEvaluation(evalRow);
        setSelectedOptionId(evalRow.selected_option_id ?? '');
        if (!data.has_options && !showAnswer && !stem.has_options) {
          setShowAnswer(true);
        }
      })
      .catch((err) => {
        setItem(null);
        setError(err instanceof Error ? err.message : 'Failed to load question');
      })
      .finally(() => setLoading(false));
  }, [id, navigation]);

  const modelSections = useMemo(
    () => normalizeSections(item?.model_answer_sections),
    [item?.model_answer_sections],
  );
  const explanationSections = useMemo(
    () => normalizeSections(item?.explanation_sections),
    [item?.explanation_sections],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerTitleAlign: 'center',
      headerTitle: () => (
        <View style={headerStyles.evalTitleRow}>
          <RatingIndicator evaluation={evaluation} size={12} />
          <Text style={headerStyles.evalTitle} numberOfLines={1}>
            {formatEvaluationStatusLabel(evaluation, item?.has_options)}
          </Text>
        </View>
      ),
      headerRight: () => (
        <Pressable
          style={headerStyles.answerBtn}
          onPress={() => setShowAnswer((value) => !value)}
          hitSlop={8}
        >
          <Text style={headerStyles.answerBtnText}>
            {showAnswer ? 'Hide answer' : 'Show answer'}
          </Text>
        </Pressable>
      ),
    });
  }, [navigation, showAnswer, evaluation, item?.has_options]);

  async function submitOption() {
    if (!id || !selectedOptionId) return;
    setSavingEval(true);
    setEvalError('');
    setEvalMessage('');
    try {
      const res = await upsertQuestionEvaluation(id, { selected_option_id: selectedOptionId });
      setEvaluation(res);
      setEvalMessage('Answer submitted successfully.');
      setShowAnswer(true);
      if (res.progress_index === 100) setShowCelebrate(true);
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : 'Failed to submit answer');
    } finally {
      setSavingEval(false);
    }
  }

  async function submitSelfRating(level: SelfRatingLevel) {
    if (!id) return;
    setSavingEval(true);
    setEvalError('');
    setEvalMessage('');
    try {
      const res = await upsertQuestionEvaluation(id, { self_rating: level });
      setEvaluation(res);
      setEvalMessage('Self-evaluation submitted successfully.');
      if (res.progress_index === 100) setShowCelebrate(true);
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : 'Failed to submit self-evaluation');
    } finally {
      setSavingEval(false);
    }
  }

  if (loading) return <BookLoading />;
  if (error) return <BookError message={error} />;
  if (!item) return <BookEmpty title="Question not found" />;

  return (
    <>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.panel}>
        <Text style={styles.questionType}>{item.question_type_name ?? item.question_type_code}</Text>
        <Text style={styles.questionText}>{item.body_en}</Text>
        {item.body_bn?.trim() ? <Text style={styles.questionBn}>{item.body_bn}</Text> : null}
      </View>

      {item.options.length > 0 ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Options</Text>
          {item.options.map((opt) => {
            const isCorrect = showAnswer && opt.is_correct;
            return (
              <View key={opt.id} style={[styles.optionRow, isCorrect && styles.optionCorrect]}>
                <Text style={styles.optionKey}>{opt.option_key.toUpperCase()}.</Text>
                <Text style={[styles.optionText, isCorrect && styles.optionTextCorrect]}>
                  {renderOptionText(opt)}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {showAnswer && item.model_answer_comparison?.columns?.length ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Model answer</Text>
          {renderComparisonTable(item.model_answer_comparison)}
        </View>
      ) : null}

      {showAnswer && modelSections.length ? (
        <View style={styles.panel}>
          {modelSections.map((sec, idx) => renderSection(sec, idx, 'model'))}
        </View>
      ) : null}

      {showAnswer && explanationSections.length ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Explanation</Text>
          {explanationSections.map((sec, idx) => renderSection(sec, idx, 'exp'))}
        </View>
      ) : null}

      {showAnswer && item.note?.trim() ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Note</Text>
          <Text style={styles.sectionText}>{item.note}</Text>
        </View>
      ) : null}

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Self evaluation</Text>
        {evalError ? <Text style={styles.errorText}>{evalError}</Text> : null}
        {evalMessage ? <Text style={styles.successText}>{evalMessage}</Text> : null}

        {item.has_options ? (
          <View style={styles.evalWrap}>
            <Text style={styles.evalHint}>Select your answer and submit.</Text>
            <View style={styles.optionSelectWrap}>
              {item.options.map((opt) => {
                const selected = selectedOptionId === opt.id;
                return (
                  <Pressable
                    key={`choose-${opt.id}`}
                    style={[styles.selectOptionRow, selected && styles.selectOptionActive]}
                    onPress={() => setSelectedOptionId(opt.id)}
                  >
                    <Text style={styles.optionKey}>{opt.option_key.toUpperCase()}.</Text>
                    <Text style={styles.optionText}>{renderOptionText(opt)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              style={[styles.submitBtn, (!selectedOptionId || savingEval) && styles.submitBtnDisabled]}
              disabled={!selectedOptionId || savingEval}
              onPress={() => void submitOption()}
            >
              <Text style={styles.submitBtnText}>
                {savingEval ? 'Submitting...' : evaluation?.selected_option_id ? 'Update answer' : 'Submit answer'}
              </Text>
            </Pressable>
            {evaluation?.is_correct !== undefined ? (
              <View style={styles.evalSavedRow}>
                <RatingIndicator evaluation={evaluation} />
                <Text style={[styles.evalResult, evaluation.is_correct ? styles.correct : styles.wrong]}>
                  {evaluation.is_correct ? 'Last result: Correct' : 'Last result: Incorrect'}
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.evalWrap}>
            <Text style={styles.evalHint}>Review the model answer, then submit your self-rating.</Text>
            <View style={styles.ratingWrap}>
              {(
                Object.keys(SELF_RATING_PROGRESS) as Array<
                  keyof typeof SELF_RATING_PROGRESS & SelfRatingLevel
                >
              ).map((level) => (
                <Pressable
                  key={level}
                  style={[styles.ratingBtn, evaluation?.self_rating === level && styles.ratingBtnActive]}
                  disabled={savingEval}
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
              <View style={styles.evalSavedRow}>
                <RatingIndicator evaluation={evaluation} />
                <Text style={styles.evalHint}>{formatEvaluationStatusLabel(evaluation, item?.has_options)} saved</Text>
              </View>
            ) : null}
          </View>
        )}
      </View>
      </ScrollView>
      <EvaluationCelebrate visible={showCelebrate} onClose={() => setShowCelebrate(false)} />
    </>
  );
}

const SELF_LABELS: Record<SelfRatingLevel, string> = {
  overall: 'Overall (50%)',
  understand: 'Understand (75%)',
  confidence: 'Confidence (100%)',
};

function normalizeSections(sections?: ExplanationSection[]) {
  return (sections ?? []).filter(
    (sec) =>
      Boolean(sec.title?.trim() || sec.content?.trim() || sec.details?.trim() || sec.note?.trim()) ||
      (sec.subsections?.length ?? 0) > 0,
  );
}

function renderComparisonTable(table: ComparisonTable) {
  const columns = table.columns ?? [];
  const rows = table.rows ?? [];
  if (columns.length < 2 || rows.length === 0) return null;
  return (
    <View style={styles.tableWrap}>
      <View style={[styles.tableRow, styles.tableHeaderRow]}>
        <Text style={[styles.tableCell, styles.tableHeaderCell, styles.tableFeatureCell]}>
          {table.feature_header?.trim() || 'Feature'}
        </Text>
        {columns.map((col, i) => (
          <Text key={`h-${i}`} style={[styles.tableCell, styles.tableHeaderCell]}>
            {col}
          </Text>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={`r-${ri}`} style={styles.tableRow}>
          <Text style={[styles.tableCell, styles.tableFeatureCell]}>{row.feature}</Text>
          {columns.map((_, ci) => (
            <Text key={`c-${ri}-${ci}`} style={styles.tableCell}>
              {row.values?.[ci] ?? ''}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function renderSection(sec: ExplanationSection, idx: number, keyPrefix: string) {
  return (
    <View key={`${keyPrefix}-${idx}`} style={styles.sectionBlock}>
      {sec.title?.trim() ? <Text style={styles.sectionHeading}>{sec.title}</Text> : null}
      {sec.content?.trim() ? <Text style={styles.sectionText}>{sec.content}</Text> : null}
      {sec.details?.trim() ? <Text style={styles.sectionText}>{sec.details}</Text> : null}
      {sec.note?.trim() ? <Text style={styles.sectionNote}>{sec.note}</Text> : null}
      {sec.subsections?.map((sub, i) => (
        <View key={`${keyPrefix}-${idx}-sub-${i}`} style={styles.subsectionBlock}>
          {sub.subtitle?.trim() ? <Text style={styles.subsectionTitle}>{sub.subtitle}</Text> : null}
          {sub.details?.trim() ? <Text style={styles.sectionText}>{sub.details}</Text> : null}
          {sub.note?.trim() ? <Text style={styles.sectionNote}>{sub.note}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const headerStyles = StyleSheet.create({
  evalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 220,
  },
  evalTitle: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'center',
  },
  answerBtn: {
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  answerBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  questionType: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  questionText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    fontWeight: '600',
  },
  questionBn: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionCorrect: {
    backgroundColor: '#ecfdf3',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  optionKey: {
    fontSize: 14,
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
  optionTextCorrect: {
    color: colors.success,
    fontWeight: '700',
  },
  sectionBlock: {
    gap: 4,
    paddingVertical: 4,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  sectionNote: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  subsectionBlock: {
    marginTop: 4,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    gap: 2,
  },
  subsectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  tableWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tableHeaderRow: {
    backgroundColor: '#f8fafc',
  },
  tableCell: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text,
  },
  tableHeaderCell: {
    fontWeight: '700',
  },
  tableFeatureCell: {
    fontWeight: '600',
  },
  evalWrap: {
    gap: spacing.sm,
  },
  evalSavedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  evalHint: {
    fontSize: 13,
    color: colors.textMuted,
  },
  optionSelectWrap: {
    gap: 8,
  },
  selectOptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
    backgroundColor: colors.background,
  },
  selectOptionActive: {
    borderColor: colors.primary,
    backgroundColor: '#eef6ff',
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  evalResult: {
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
    backgroundColor: colors.background,
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
  errorText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '600',
  },
  successText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '600',
  },
});
