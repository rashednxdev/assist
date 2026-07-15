import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
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
  type QuestionPracticeStem,
  type SelfRatingLevel,
} from '@/lib/evaluation-api';
import type { ExplanationSection, QuestionDetail, QuestionOption } from '@/types/questions';
import { ComparisonTableAnswer } from '@/components/questions/ComparisonTableAnswer';
import { BookRichText } from '@/components/books/BookRichText';
import { useDifferencesLandscape } from '@/hooks/useDifferencesLandscape';
import { bilingualQuestionText } from '@/lib/question-display';
import {
  loadQuestionBankLastQuestion,
  saveQuestionBankLastQuestion,
} from '@/lib/question-bank-progress';
import { getQuestionBankNextId } from '@/lib/question-bank-order';
import { questionDetailHref } from '@/lib/question-routes';
import { colors, spacing } from '@/theme';

function optionText(option: QuestionOption) {
  return option.option_text_en?.trim() || option.option_text_bn?.trim() || '';
}

export default function QuestionDetailScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const fromSaved = from === 'saved';
  const router = useRouter();
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
  const [nextId, setNextId] = useState<string | undefined>();
  const [nextStem, setNextStem] = useState<QuestionPracticeStem | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setShowAnswer(false);
    setNextStem(null);
    setEvalError('');
    setEvalMessage('');

    const sessionNext = getQuestionBankNextId(id);
    void loadQuestionBankLastQuestion().then((pos) => {
      const fromStore = pos?.id === id ? pos.nextId : undefined;
      setNextId(sessionNext || fromStore);
    });

    Promise.all([fetchQuestionDetail(id), fetchQuestionPracticeStem(id), fetchQuestionEvaluation(id)])
      .then(([data, stem, evalRow]) => {
        setItem(data);
        setEvaluation(evalRow);
        setSelectedOptionId(evalRow.selected_option_id ?? '');
        if (!data.has_options && !stem.has_options) {
          setShowAnswer(true);
        }
      })
      .catch((err) => {
        setItem(null);
        setError(err instanceof Error ? err.message : 'Failed to load question');
      })
      .finally(() => setLoading(false));
  }, [id, navigation]);

  useEffect(() => {
    if (!showAnswer || !nextId) {
      setNextStem(null);
      return;
    }
    let cancelled = false;
    void fetchQuestionPracticeStem(nextId)
      .then((stem) => {
        if (!cancelled) setNextStem(stem);
      })
      .catch(() => {
        if (!cancelled) setNextStem(null);
      });
    return () => {
      cancelled = true;
    };
  }, [showAnswer, nextId]);

  const modelSections = useMemo(
    () => normalizeSections(item?.model_answer_sections),
    [item?.model_answer_sections],
  );
  const explanationSections = useMemo(
    () => normalizeSections(item?.explanation_sections),
    [item?.explanation_sections],
  );

  const isDifferences =
    item?.question_type_code === 'DIFFERENCES' ||
    Boolean(item?.model_answer_comparison?.columns?.length);
  const comparisonTable = item?.model_answer_comparison;
  const hasComparison =
    Boolean(comparisonTable?.columns && comparisonTable.columns.length >= 2) &&
    Boolean(comparisonTable?.rows && comparisonTable.rows.length > 0);
  const showDifferencesAnswer = Boolean(showAnswer && isDifferences && hasComparison);

  useDifferencesLandscape(showDifferencesAnswer);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerTitleAlign: 'center',
      headerBackTitle: fromSaved ? 'Questions' : undefined,
      headerLeft: fromSaved
        ? () => (
            <Pressable
              onPress={() => router.replace('/(app)/saved/questions' as Href)}
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, gap: 2 }}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={28} color={colors.white} />
              <Text style={{ color: colors.white, fontSize: 17 }}>Questions</Text>
            </Pressable>
          )
        : undefined,
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
  }, [navigation, evaluation, showAnswer, item?.has_options, fromSaved, router]);

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

  function openNextQuestion() {
    if (!nextId) return;
    const followingId = getQuestionBankNextId(nextId);
    void saveQuestionBankLastQuestion({
      id: nextId,
      nextId: followingId,
    });
    router.replace(questionDetailHref(nextId));
  }

  if (loading) return <BookLoading />;
  if (error) return <BookError message={error} />;
  if (!item) return <BookEmpty title="Question not found" />;

  const stem = bilingualQuestionText(item.body_en, item.body_bn);
  const nextText = nextStem
    ? bilingualQuestionText(nextStem.body_en, nextStem.body_bn)
    : null;
  const showNextQuestion = Boolean(showAnswer && nextId && nextStem && nextText?.primary);

  return (
    <>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.panel}>
        <Text style={styles.questionType}>{item.question_type_name ?? item.question_type_code}</Text>
        <BookRichText html={stem.primary} style={styles.questionText} />
        {stem.secondary ? <BookRichText html={stem.secondary} style={styles.questionBn} /> : null}
      </View>

      {item.options.length > 0 ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Options</Text>
          {item.options.map((opt) => {
            const isCorrect = showAnswer && opt.is_correct;
            return (
              <View key={opt.id} style={[styles.optionRow, isCorrect && styles.optionCorrect]}>
                <Text style={styles.optionKey}>{opt.option_key.toUpperCase()}.</Text>
                <BookRichText
                  html={optionText(opt)}
                  style={[styles.optionText, isCorrect && styles.optionTextCorrect]}
                />
              </View>
            );
          })}
        </View>
      ) : null}

      {showAnswer && hasComparison ? (
        <View style={[styles.panel, styles.differencesPanel]}>
          <ComparisonTableAnswer table={comparisonTable} />
        </View>
      ) : null}

      {showAnswer && isDifferences && !hasComparison ? (
        <View style={styles.panel}>
          <Text style={styles.sectionText}>
            No comparison table is available for this question yet.
          </Text>
        </View>
      ) : null}

      {showAnswer && !hasComparison && modelSections.length ? (
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
          <BookRichText html={item.note} style={styles.sectionText} />
        </View>
      ) : null}

      <View style={styles.panel}>
        <Text style={[styles.sectionTitle, styles.selfEvalTitle]}>Self evaluation</Text>
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
                    <BookRichText html={optionText(opt)} style={styles.optionText} />
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
            <Text style={styles.evalHint}>Your study position on the question and answer</Text>
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

      {showNextQuestion ? (
        <Pressable
          style={({ pressed }) => [styles.nextPanel, pressed && styles.nextPanelPressed]}
          onPress={openNextQuestion}
          accessibilityRole="button"
          accessibilityLabel="Open next question"
        >
          <Text style={styles.nextLabel}>Next question</Text>
          <BookRichText html={nextText!.primary} style={styles.nextText} />
          {nextText!.secondary ? (
            <BookRichText html={nextText!.secondary} style={styles.nextTextSecondary} />
          ) : null}
          <Text style={styles.nextHint}>Tap to open</Text>
        </Pressable>
      ) : null}
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

function renderSection(sec: ExplanationSection, idx: number, keyPrefix: string) {
  return (
    <View key={`${keyPrefix}-${idx}`} style={styles.sectionBlock}>
      {sec.title?.trim() ? <Text style={styles.sectionHeading}>{sec.title}</Text> : null}
      {sec.content?.trim() ? <BookRichText html={sec.content} style={styles.sectionText} /> : null}
      {sec.details?.trim() ? <BookRichText html={sec.details} style={styles.sectionText} /> : null}
      {sec.note?.trim() ? <BookRichText html={sec.note} style={styles.sectionNote} /> : null}
      {sec.subsections?.map((sub, i) => (
        <View key={`${keyPrefix}-${idx}-sub-${i}`} style={styles.subsectionBlock}>
          {sub.subtitle?.trim() ? <Text style={styles.subsectionTitle}>{sub.subtitle}</Text> : null}
          {sub.details?.trim() ? <BookRichText html={sub.details} style={styles.sectionText} /> : null}
          {sub.note?.trim() ? <BookRichText html={sub.note} style={styles.sectionNote} /> : null}
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
  differencesPanel: {
    paddingVertical: spacing.md,
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
  selfEvalTitle: {
    color: colors.gold,
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
  nextPanel: {
    backgroundColor: '#f3f6f9',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d7dee6',
    borderStyle: 'dashed',
    padding: spacing.md,
    gap: spacing.sm,
  },
  nextPanelPressed: {
    opacity: 0.88,
  },
  nextLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  nextText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#6b7280',
    fontWeight: '500',
  },
  nextTextSecondary: {
    fontSize: 14,
    lineHeight: 20,
    color: '#9ca3af',
  },
  nextHint: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
});
