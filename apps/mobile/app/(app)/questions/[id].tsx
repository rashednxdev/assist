import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SELF_RATING_PROGRESS } from '@ibas/shared-constants';
import {
  hasComparisonTableContent,
  hasProcessContent,
  mergeComparisonIntoModelAnswerSections,
  type ComparisonTable as SharedComparisonTable,
  type ExplanationSection as SharedExplanationSection,
} from '@ibas/shared-types';
import { BookEmpty, BookError } from '@/components/books/BookStates';
import { BlockingLoader } from '@/components/ui/BlockingLoader';
import { EvaluationCelebrate } from '@/components/evaluation/EvaluationCelebrate';
import { RatingIndicator } from '@/components/evaluation/RatingIndicator';
import { fetchQuestionDetail } from '@/lib/questions-api';
import { getCachedMcqDetail, getCachedQuestionSubjectLabel } from '@/lib/questions-db';
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
import { ComparisonTablePreview } from '@/components/questions/ComparisonTablePreview';
import { AnswerDwellRecorder } from '@/components/questions/AnswerDwellRecorder';
import { ProcessFlowPreview } from '@/components/books/ProcessFlowPreview';
import { BookRichText } from '@/components/books/BookRichText';
import { AnswerPdfDownloadSheet } from '@/components/questions/AnswerPdfDownloadSheet';
import { bilingualQuestionText } from '@/lib/question-display';
import { useAuth } from '@/lib/auth-context';
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
  const { canAccess } = useAuth();
  const canDownloadPdf = canAccess('ANSWER_PDF');
  const [pdfOpen, setPdfOpen] = useState(false);
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
  const [showPreviousEval, setShowPreviousEval] = useState(false);
  const [nextId, setNextId] = useState<string | undefined>();
  const [nextStem, setNextStem] = useState<QuestionPracticeStem | null>(null);
  const [questionContentHeight, setQuestionContentHeight] = useState(0);
  const { height: windowHeight } = useWindowDimensions();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setShowAnswer(false);
    setNextStem(null);
    setQuestionContentHeight(0);
    setEvalError('');
    setEvalMessage('');
    setShowPreviousEval(false);
    setSelectedOptionId('');

    const sessionNext = getQuestionBankNextId(id);
    void loadQuestionBankLastQuestion().then((pos) => {
      const fromStore = pos?.id === id ? pos.nextId : undefined;
      setNextId(sessionNext || fromStore);
    });

    // MCQ body/options/explanation render instantly from the local cache with no network call;
    // practice-stem/evaluation (and everything for non-MCQ types) still require the API.
    const cached = getCachedMcqDetail(id);
    if (cached) {
      setItem(cached);
      setLoading(false);
    }

    Promise.all([
      cached ? Promise.resolve(cached) : fetchQuestionDetail(id),
      fetchQuestionPracticeStem(id),
      fetchQuestionEvaluation(id),
    ])
      .then(([data, stem, evalRow]) => {
        setItem(data);
        setEvaluation(evalRow);
        // Do not prefill previous answer — user starts fresh unless they reveal it.
        setSelectedOptionId('');
        if (!data.has_options && !stem.has_options) {
          setShowAnswer(true);
        }
      })
      .catch((err) => {
        if (cached) return; // offline: keep showing the cached answer, just without eval state
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
    () =>
      normalizeSections(
        mergeComparisonIntoModelAnswerSections(
          item?.model_answer_sections as SharedExplanationSection[] | undefined,
          item?.model_answer_comparison as SharedComparisonTable | undefined,
        ),
      ),
    [item?.model_answer_sections, item?.model_answer_comparison],
  );
  const explanationSections = useMemo(
    () => normalizeSections(item?.explanation_sections),
    [item?.explanation_sections],
  );
  // Collected from the raw (unfiltered) section lists — a section whose only content is a
  // process would otherwise be dropped by normalizeSections before we get a chance to see it.
  const allProcesses = useMemo(
    () => [...collectProcesses(item?.model_answer_sections), ...collectProcesses(item?.explanation_sections)],
    [item?.model_answer_sections, item?.explanation_sections],
  );

  const hasNestedComparison = modelSections.some(sectionHasTable);
  const comparisonTable = item?.model_answer_comparison;
  const hasLegacyComparison =
    hasComparisonTableContent(comparisonTable) && !hasNestedComparison;
  useLayoutEffect(() => {
    const headerEval = showPreviousEval ? evaluation : null;
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
      headerTitle: () =>
        headerEval ? (
          <View style={headerStyles.evalTitleRow}>
            <RatingIndicator evaluation={headerEval} size={12} />
            <Text style={headerStyles.evalTitle} numberOfLines={1}>
              {formatEvaluationStatusLabel(headerEval, item?.has_options)}
            </Text>
          </View>
        ) : (
          <View style={headerStyles.bookChapterWrap}>
            {item?.book_name ? (
              <Text style={headerStyles.headerBookText} numberOfLines={1}>
                {item.book_name}
              </Text>
            ) : null}
            {item?.chapter_name ? (
              <Text style={headerStyles.headerChapterText} numberOfLines={1}>
                {item.chapter_number ? `${item.chapter_number}: ${item.chapter_name}` : item.chapter_name}
              </Text>
            ) : null}
            {!item?.book_name && !item?.chapter_name ? (
              <Text style={headerStyles.evalTitle} numberOfLines={1}>
                Question
              </Text>
            ) : null}
          </View>
        ),
      headerRight: () => (
        <View style={headerStyles.headerRightRow}>
          {canDownloadPdf && id ? (
            <Pressable
              style={headerStyles.pdfBtn}
              onPress={() => setPdfOpen(true)}
              hitSlop={8}
              accessibilityLabel="Download answer PDF"
            >
              <Ionicons name="download-outline" size={18} color={colors.white} />
            </Pressable>
          ) : null}
          <Pressable
            style={headerStyles.answerBtn}
            onPress={() => setShowAnswer((value) => !value)}
            hitSlop={8}
          >
            <Text style={headerStyles.answerBtnText}>
              {showAnswer ? 'Hide answer' : 'Show answer'}
            </Text>
          </Pressable>
        </View>
      ),
    });
  }, [
    navigation,
    evaluation,
    showPreviousEval,
    showAnswer,
    item?.has_options,
    item?.book_name,
    item?.chapter_number,
    item?.chapter_name,
    fromSaved,
    router,
    canDownloadPdf,
    id,
  ]);

  async function submitOption() {
    if (!id || !selectedOptionId) return;
    setSavingEval(true);
    setEvalError('');
    setEvalMessage('');
    try {
      const res = await upsertQuestionEvaluation(id, { selected_option_id: selectedOptionId });
      setEvaluation(res);
      setShowPreviousEval(true);
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
      setShowPreviousEval(true);
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

  if (loading) {
    return (
      <View style={styles.root}>
        <BlockingLoader label="Loading Question Answer…" />
      </View>
    );
  }
  if (error) return <BookError message={error} />;
  if (!item) return <BookEmpty title="Question not found" />;

  const stem = bilingualQuestionText(item.body_en, item.body_bn);
  const nextText = nextStem
    ? bilingualQuestionText(nextStem.body_en, nextStem.body_bn)
    : null;
  const showNextQuestion = Boolean(showAnswer && nextId && nextStem && nextText?.primary);
  const halfScreen = windowHeight / 2;
  const scrollQuestion = questionContentHeight > halfScreen;

  return (
    <View style={styles.root}>
      {/* Fixed under the nav header so the user always sees which question they're reading.
          If the stem is taller than half the screen, this block scrolls in place. */}
      <View
        style={[
          styles.panel,
          styles.stickyQuestionPanel,
          scrollQuestion ? { maxHeight: halfScreen } : null,
        ]}
      >
        <ScrollView
          style={scrollQuestion ? { maxHeight: halfScreen } : undefined}
          contentContainerStyle={styles.stickyQuestionContent}
          scrollEnabled={scrollQuestion}
          nestedScrollEnabled
          showsVerticalScrollIndicator={scrollQuestion}
          onContentSizeChange={(_w, h) => setQuestionContentHeight(h)}
        >
          <BookRichText html={stem.primary} style={styles.questionText} />
          {stem.secondary ? <BookRichText html={stem.secondary} style={styles.questionBn} /> : null}
        </ScrollView>
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.content}>
      {showAnswer && !item.has_options ? (
        <AnswerDwellRecorder
          id={item.id}
          bodyEn={item.body_en}
          bodyBn={item.body_bn}
          subtitle={item.book_name}
          subject={getCachedQuestionSubjectLabel(item.id)}
        />
      ) : null}
      {item.has_options ? (
        <View style={styles.panel}>
          <Text style={[styles.sectionTitle, styles.selfEvalTitle]}>Evaluate</Text>
          {evalError ? <Text style={styles.errorText}>{evalError}</Text> : null}
          {evalMessage ? <Text style={styles.successText}>{evalMessage}</Text> : null}

          <View style={styles.optionSelectWrap}>
            {(item.options ?? []).map((opt) => {
              const selected = selectedOptionId === opt.id;
              const revealCorrect = showAnswer && opt.is_correct;
              return (
                <Pressable
                  key={opt.id}
                  style={[
                    styles.selectOptionRow,
                    selected && styles.selectOptionActive,
                    revealCorrect && styles.optionCorrect,
                  ]}
                  onPress={() => setSelectedOptionId(opt.id)}
                >
                  <Text style={styles.optionKey}>{opt.option_key.toUpperCase()}.</Text>
                  <BookRichText
                    html={optionText(opt)}
                    style={[styles.optionText, revealCorrect && styles.optionTextCorrect]}
                  />
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
              {savingEval ? 'Submitting...' : 'Submit answer'}
            </Text>
          </Pressable>

          {hasSavedEval(evaluation, true) ? (
            <Pressable
              style={styles.prevEvalBtn}
              onPress={() => {
                setShowPreviousEval((v) => {
                  const next = !v;
                  if (next && evaluation?.selected_option_id) {
                    setSelectedOptionId(evaluation.selected_option_id);
                  }
                  return next;
                });
              }}
            >
              <Text style={styles.prevEvalBtnText}>
                {showPreviousEval ? 'Hide previous result' : 'Show previous result'}
              </Text>
            </Pressable>
          ) : null}

          {showPreviousEval && evaluation?.is_correct !== undefined ? (
            <View style={styles.evalSavedRow}>
              <RatingIndicator evaluation={evaluation} />
              <Text style={[styles.evalResult, evaluation.is_correct ? styles.correct : styles.wrong]}>
                {evaluation.is_correct ? 'Previous: Correct' : 'Previous: Incorrect'}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {showAnswer && hasLegacyComparison ? (
        <View style={[styles.panel, styles.differencesPanel]}>
          <ComparisonTablePreview table={comparisonTable} />
        </View>
      ) : null}

      {showAnswer && modelSections.length ? (
        <View style={styles.panel}>
          {modelSections.map((sec, idx) => renderSection(sec, idx, 'model'))}
        </View>
      ) : null}

      {showAnswer && explanationSections.length ? (
        <View style={styles.panel}>
          {explanationSections.map((sec, idx) => renderSection(sec, idx, 'exp'))}
        </View>
      ) : null}

      {showAnswer && item.note?.trim() ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Note</Text>
          <BookRichText html={item.note} style={styles.sectionText} />
        </View>
      ) : null}

      {showAnswer && allProcesses.length > 0 ? (
        <View style={styles.panel}>
          {allProcesses.map((proc, idx) => (
            <View key={idx} style={styles.processGroupBlock}>
              {proc.title?.trim() && proc.title.trim().toLowerCase() !== 'process' ? (
                <Text style={styles.subsectionTitle}>{proc.title}</Text>
              ) : null}
              {proc.details?.trim() ? (
                <BookRichText html={proc.details} style={styles.sectionText} />
              ) : null}
              <ProcessFlowPreview steps={proc.steps ?? []} />
            </View>
          ))}
        </View>
      ) : null}

      {!item.has_options ? (
        <View style={styles.panel}>
          <Text style={[styles.sectionTitle, styles.selfEvalTitle]}>Self evaluation</Text>
          {evalError ? <Text style={styles.errorText}>{evalError}</Text> : null}
          {evalMessage ? <Text style={styles.successText}>{evalMessage}</Text> : null}
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
                  style={[
                    styles.ratingBtn,
                    showPreviousEval && evaluation?.self_rating === level && styles.ratingBtnActive,
                  ]}
                  disabled={savingEval}
                  onPress={() => void submitSelfRating(level)}
                >
                  <Text
                    style={[
                      styles.ratingBtnText,
                      showPreviousEval &&
                        evaluation?.self_rating === level &&
                        styles.ratingBtnTextActive,
                    ]}
                  >
                    {SELF_LABELS[level]}
                  </Text>
                </Pressable>
              ))}
            </View>

            {hasSavedEval(evaluation, false) ? (
              <Pressable
                style={styles.prevEvalBtn}
                onPress={() => setShowPreviousEval((v) => !v)}
              >
                <Text style={styles.prevEvalBtnText}>
                  {showPreviousEval ? 'Hide previous result' : 'Show previous result'}
                </Text>
              </Pressable>
            ) : null}

            {showPreviousEval && evaluation?.self_rating ? (
              <View style={styles.evalSavedRow}>
                <RatingIndicator evaluation={evaluation} />
                <Text style={styles.evalHint}>
                  {formatEvaluationStatusLabel(evaluation, false)} saved
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

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
      {canDownloadPdf && id ? (
        <AnswerPdfDownloadSheet
          visible={pdfOpen}
          questionIds={[id]}
          scopeLabel="This question"
          onClose={() => setPdfOpen(false)}
        />
      ) : null}
    </View>
  );
}

const SELF_LABELS: Record<SelfRatingLevel, string> = {
  overall: 'Overall (50%)',
  understand: 'Understand (75%)',
  confidence: 'Confidence (100%)',
};

function hasSavedEval(evaluation: QuestionEvaluationRecord | null, isMcq: boolean) {
  if (!evaluation || evaluation.progress_index <= 0) return false;
  if (isMcq) return evaluation.is_correct !== undefined || !!evaluation.selected_option_id;
  return !!evaluation.self_rating;
}

function sectionHasTable(sec: ExplanationSection) {
  return hasComparisonTableContent(sec.table);
}

function sectionHasProcessContent(process?: ExplanationSection['process']) {
  return hasProcessContent(process);
}

/** Every process across a list of sections — used to show all of a question's processes together
 * in one dedicated panel at the end of the answer, rather than scattered inline per section. */
function collectProcesses(sections?: ExplanationSection[]) {
  return (sections ?? [])
    .map((sec) => sec.process)
    .filter((process): process is NonNullable<ExplanationSection['process']> =>
      sectionHasProcessContent(process),
    );
}

function normalizeSections(sections?: ExplanationSection[]) {
  return (sections ?? []).filter(
    (sec) =>
      Boolean(sec.title?.trim() || sec.content?.trim() || sec.details?.trim() || sec.note?.trim()) ||
      sectionHasTable(sec) ||
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
      {sectionHasTable(sec) ? <ComparisonTablePreview table={sec.table} title={sec.title} /> : null}
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
  bookChapterWrap: {
    maxWidth: 220,
    alignItems: 'center',
  },
  headerBookText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerChapterText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 1,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pdfBtn: {
    width: 34,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
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
  scrollArea: {
    flex: 1,
  },
  stickyQuestionPanel: {
    margin: spacing.md,
    marginBottom: 0,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  stickyQuestionContent: {
    gap: spacing.sm,
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
  processGroupBlock: {
    marginTop: 4,
    gap: 4,
    paddingBottom: 8,
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
  prevEvalBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  prevEvalBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
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
