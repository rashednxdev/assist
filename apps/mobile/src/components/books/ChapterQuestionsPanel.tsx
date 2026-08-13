import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { hasComparisonTableContent } from '@ibas/shared-types';
import { BookBadge } from '@/components/books/BookBadge';
import { BookLoading } from '@/components/books/BookStates';
import { BookRichText } from '@/components/books/BookRichText';
import { ChapterMcqExam } from '@/components/books/ChapterMcqExam';
import { ChapterQuestionEvaluator } from '@/components/books/ChapterQuestionEvaluator';
import { RatingIndicator } from '@/components/evaluation/RatingIndicator';
import {
  fetchQuestionEvaluation,
  fetchQuestionEvaluationsBatch,
  upsertQuestionEvaluation,
  type QuestionEvalBrief,
  type QuestionEvaluationRecord,
} from '@/lib/evaluation-api';
import { fetchQuestionDetail } from '@/lib/questions-api';
import {
  getCachedBookQuestions,
  getCachedChapterQuestions,
  getCachedMcqDetail,
  getCachedQuestionSubjectLabel,
} from '@/lib/questions-db';
import { subscribeQuestionsSync } from '@/lib/questions-sync';
import { stripHtml } from '@/lib/book-display';
import { bilingualQuestionText } from '@/lib/question-display';
import type { ChapterQuestionBrief } from '@/types/books';
import { ComparisonTablePreview } from '@/components/questions/ComparisonTablePreview';
import { AnswerDwellRecorder } from '@/components/questions/AnswerDwellRecorder';
import type { ExplanationSection, QuestionDetail } from '@/types/questions';
import { colors, spacing } from '@/theme';

type PanelView = 'list' | 'detail' | 'mcq-exam';

function truncate(text: string, len = 100) {
  const plain = stripHtml(text);
  return plain.length > len ? `${plain.slice(0, len)}…` : plain;
}

function optionLabel(option: { option_text_en?: string; option_text_bn?: string }) {
  return option.option_text_en?.trim() || option.option_text_bn?.trim() || '';
}

function hasSavedEval(evaluation: QuestionEvaluationRecord | null) {
  if (!evaluation || evaluation.progress_index <= 0) return false;
  return evaluation.is_correct !== undefined || Boolean(evaluation.selected_option_id);
}

function sectionHasTable(section: ExplanationSection) {
  return hasComparisonTableContent(section.table);
}

function renderSection(section: ExplanationSection, index: number) {
  return (
    <View key={`sec-${index}`} style={styles.answerSection}>
      {section.title?.trim() ? <Text style={styles.answerSectionTitle}>{section.title}</Text> : null}
      {section.content?.trim() ? (
        <BookRichText html={section.content} style={styles.answerText} />
      ) : null}
      {section.details?.trim() ? (
        <BookRichText html={section.details} style={styles.answerText} />
      ) : null}
      {section.note?.trim() ? <BookRichText html={section.note} style={styles.answerNote} /> : null}
      {sectionHasTable(section) ? (
        <ComparisonTablePreview table={section.table} title={section.title} />
      ) : null}
    </View>
  );
}

export function ChapterQuestionsButton({
  active,
  fullWidth,
  onPress,
}: {
  active?: boolean;
  /** Book detail screen's single aggregate button: full-width and always highlighted. */
  fullWidth?: boolean;
  onPress: () => void;
}) {
  const highlighted = active || fullWidth;
  return (
    <Pressable
      style={[styles.tagBtn, fullWidth && styles.tagBtnFullWidth, highlighted && styles.tagBtnActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="View tagged questions"
    >
      <Ionicons
        name="list-outline"
        size={16}
        color={highlighted ? colors.white : colors.primary}
      />
      <Text style={[styles.tagBtnText, highlighted && styles.tagBtnTextActive]}>Questions</Text>
    </Pressable>
  );
}

export function ChapterQuestionsPanel({
  chapterId,
  bookId,
  chapterTitle,
  bookName,
  open,
  onClose,
}: {
  /** Provide exactly one of chapterId (single chapter) or bookId (every chapter of the book). */
  chapterId?: string;
  bookId?: string;
  chapterTitle?: string;
  bookName?: string;
  open: boolean;
  onClose: () => void;
}) {
  const [questions, setQuestions] = useState<ChapterQuestionBrief[]>([]);
  const [evalMap, setEvalMap] = useState<Map<string, QuestionEvalBrief>>(new Map());
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState('');
  const [panelView, setPanelView] = useState<PanelView>('list');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [question, setQuestion] = useState<QuestionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [evaluation, setEvaluation] = useState<QuestionEvaluationRecord | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [savingEval, setSavingEval] = useState(false);
  const [evalError, setEvalError] = useState('');
  const [evalMessage, setEvalMessage] = useState('');
  const [showPreviousEval, setShowPreviousEval] = useState(false);
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    0,
    Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0) - 6,
  );

  const typeOptions = useMemo(() => {
    const types = [...new Set(questions.map((q) => q.question_type_code))].sort();
    return ['ALL', ...types];
  }, [questions]);

  const displayedQuestions = useMemo(() => {
    let list = questions;
    if (typeFilter !== 'ALL') {
      list = list.filter((q) => q.question_type_code === typeFilter);
    }
    return [...list].sort(
      (a, b) =>
        a.question_type_code.localeCompare(b.question_type_code) ||
        (a.body_en || a.body_bn).localeCompare(b.body_en || b.body_bn),
    );
  }, [questions, typeFilter]);

  const mcqQuestions = useMemo(
    () => questions.filter((q) => q.question_type_code === 'MCQ'),
    [questions],
  );

  const selectedIndex = useMemo(
    () => (selectedId ? displayedQuestions.findIndex((q) => q.id === selectedId) : -1),
    [displayedQuestions, selectedId],
  );

  const hasComparison = hasComparisonTableContent(question?.model_answer_comparison);

  const questionStem = question
    ? bilingualQuestionText(question.body_en, question.body_bn)
    : null;

  useEffect(() => {
    if (!open) {
      setPanelView('list');
      setSelectedId(null);
      setTypeFilter('ALL');
      return;
    }

    // Tagged questions come from the same local cache as Question Bank/Marathon — instant, no
    // network call. Only the evaluation progress badges still need the API.
    const loadFromCache = () => {
      setListError('');
      try {
        setQuestions(bookId ? getCachedBookQuestions(bookId) : getCachedChapterQuestions(chapterId!));
      } catch (err) {
        setListError(err instanceof Error ? err.message : 'Failed to load questions');
        setQuestions([]);
      } finally {
        setLoadingList(false);
      }
    };

    setLoadingList(true);
    loadFromCache();
    return subscribeQuestionsSync(loadFromCache);
  }, [open, chapterId, bookId]);

  useEffect(() => {
    if (questions.length === 0) {
      setEvalMap(new Map());
      return;
    }
    let cancelled = false;
    fetchQuestionEvaluationsBatch(questions.map((q) => q.id))
      .then((evals) => {
        if (cancelled) return;
        const map = new Map<string, QuestionEvalBrief>();
        for (const row of evals) {
          if (row.progress_index > 0 || row.self_rating || row.is_correct !== undefined) {
            map.set(row.question_id, row);
          }
        }
        setEvalMap(map);
      })
      .catch(() => {
        // Non-fatal — progress badges just stay blank when offline.
      });
    return () => {
      cancelled = true;
    };
  }, [questions]);

  useEffect(() => {
    if (!selectedId || panelView !== 'detail') {
      setQuestion(null);
      return;
    }
    setLoadingDetail(true);
    setShowAnswer(false);
    setSelectedOptionId('');
    setShowPreviousEval(false);
    setEvalError('');
    setEvalMessage('');
    setEvaluation(null);

    const cached = getCachedMcqDetail(selectedId);
    if (cached) setQuestion(cached);

    Promise.all([
      cached ? Promise.resolve(cached) : fetchQuestionDetail(selectedId),
      fetchQuestionEvaluation(selectedId),
    ])
      .then(([data, evalRow]) => {
        setQuestion(data);
        setEvaluation(evalRow);
        if (!data.has_options) setShowAnswer(true);
      })
      .catch(() => {
        if (!cached) setQuestion(null);
      })
      .finally(() => setLoadingDetail(false));
  }, [selectedId, panelView]);

  async function submitOption() {
    if (!selectedId || !selectedOptionId) return;
    setSavingEval(true);
    setEvalError('');
    setEvalMessage('');
    try {
      const res = await upsertQuestionEvaluation(selectedId, { selected_option_id: selectedOptionId });
      setEvaluation(res);
      setShowPreviousEval(true);
      setEvalMessage('Answer submitted successfully.');
      setShowAnswer(true);
      handleEvalUpdated(res);
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : 'Failed to submit answer');
    } finally {
      setSavingEval(false);
    }
  }

  function openDetail(id: string) {
    setSelectedId(id);
    setPanelView('detail');
  }

  function backToList() {
    setPanelView('list');
    setSelectedId(null);
  }

  function goPrev() {
    if (selectedIndex > 0) {
      setSelectedId(displayedQuestions[selectedIndex - 1].id);
    }
  }

  function goNext() {
    if (selectedIndex >= 0 && selectedIndex < displayedQuestions.length - 1) {
      setSelectedId(displayedQuestions[selectedIndex + 1].id);
    }
  }

  function handleEvalUpdated(record: { question_id: string; progress_index: number; is_correct?: boolean; self_rating?: QuestionEvalBrief['self_rating'] }) {
    setEvalMap((prev) => {
      const next = new Map(prev);
      next.set(record.question_id, record);
      return next;
    });
  }

  function handleMcqExamComplete(results: { question_id: string; progress_index: number; is_correct?: boolean; self_rating?: QuestionEvalBrief['self_rating'] }[]) {
    setEvalMap((prev) => {
      const next = new Map(prev);
      for (const row of results) {
        next.set(row.question_id, row);
      }
      return next;
    });
  }

  const headerTitle =
    panelView === 'mcq-exam'
      ? 'MCQ exam'
      : panelView === 'detail'
        ? `Question ${selectedIndex + 1}/${displayedQuestions.length}`
        : '';

  return (
    <Modal visible={open} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.modalRoot, { paddingTop: topInset, paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <View style={styles.modalHeader}>
          {panelView !== 'list' ? (
            <Pressable
              style={styles.headerBtn}
              onPress={() => (panelView === 'detail' ? backToList() : setPanelView('list'))}
            >
              <Ionicons name="chevron-back" size={20} color={colors.primary} />
              <Text style={styles.headerBtnText}>Back</Text>
            </Pressable>
          ) : (
            <View style={styles.headerSpacer} />
          )}
          <View style={styles.headerTitleWrap}>
            {headerTitle ? (
              <Text style={styles.modalTitle} numberOfLines={1}>
                {headerTitle}
              </Text>
            ) : null}
            {(panelView === 'list' || panelView === 'detail') && (bookName || chapterTitle) ? (
              <>
                {bookName ? (
                  <Text style={styles.modalBookSubtitle} numberOfLines={1}>
                    {bookName}
                  </Text>
                ) : null}
                {chapterTitle ? (
                  <Text style={styles.modalSubtitle} numberOfLines={1}>
                    {chapterTitle}
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </Pressable>
        </View>

        {panelView === 'mcq-exam' ? (
          <View style={styles.modalBody}>
            <ChapterMcqExam
              questions={mcqQuestions}
              onBack={() => setPanelView('list')}
              onComplete={handleMcqExamComplete}
            />
          </View>
        ) : (
          <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
            {panelView === 'detail' ? (
              loadingDetail ? (
                <BookLoading />
              ) : !question ? (
                <Text style={styles.muted}>Question not found.</Text>
              ) : (
                <View style={styles.detailWrap}>
                  <View style={styles.badges}>
                    <BookBadge label={question.question_type_code} variant="muted" />
                    <BookBadge label={`${question.marks} marks`} variant="muted" />
                  </View>
                  {questionStem ? (
                    <>
                      <BookRichText html={questionStem.primary} style={styles.questionBody} />
                      {questionStem.secondary ? (
                        <BookRichText html={questionStem.secondary} style={styles.questionBn} />
                      ) : null}
                    </>
                  ) : null}

                  {question.has_options ? (
                    <View style={styles.evalWrap}>
                      <View style={styles.evalHeaderRow}>
                        <Text style={styles.sectionLabel}>Evaluate</Text>
                        <Pressable onPress={() => setShowAnswer((v) => !v)} hitSlop={8}>
                          <Text style={styles.showAnswerText}>
                            {showAnswer ? 'Hide answer' : 'Show answer'}
                          </Text>
                        </Pressable>
                      </View>
                      {evalError ? <Text style={styles.error}>{evalError}</Text> : null}
                      {evalMessage ? <Text style={styles.success}>{evalMessage}</Text> : null}

                      <View style={styles.optionsWrap}>
                        {question.options.map((opt) => {
                          const selected = selectedOptionId === opt.id;
                          const revealCorrect = showAnswer && opt.is_correct;
                          return (
                            <Pressable
                              key={opt.id}
                              style={[
                                styles.optionRow,
                                selected && styles.optionRowActive,
                                revealCorrect && styles.optionCorrect,
                              ]}
                              onPress={() => setSelectedOptionId(opt.id)}
                            >
                              <Text style={styles.optionKey}>{opt.option_key.toUpperCase()}.</Text>
                              <BookRichText
                                html={optionLabel(opt)}
                                style={[styles.optionText, revealCorrect && styles.optionTextCorrect]}
                              />
                            </Pressable>
                          );
                        })}
                      </View>

                      <Pressable
                        style={[
                          styles.submitBtn,
                          (!selectedOptionId || savingEval) && styles.submitBtnDisabled,
                        ]}
                        disabled={!selectedOptionId || savingEval}
                        onPress={() => void submitOption()}
                      >
                        <Text style={styles.submitBtnText}>
                          {savingEval ? 'Submitting...' : 'Submit answer'}
                        </Text>
                      </Pressable>

                      {hasSavedEval(evaluation) ? (
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
                          <Text
                            style={[
                              styles.evalResult,
                              evaluation.is_correct ? styles.correct : styles.wrong,
                            ]}
                          >
                            {evaluation.is_correct ? 'Previous: Correct' : 'Previous: Incorrect'}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {open && showAnswer && !question.has_options ? (
                    <AnswerDwellRecorder
                      id={question.id}
                      bodyEn={question.body_en}
                      bodyBn={question.body_bn}
                      subtitle={bookName ?? chapterTitle}
                      subject={getCachedQuestionSubjectLabel(question.id)}
                    />
                  ) : null}

                  {showAnswer ? (
                    <View style={styles.answerWrap}>
                      {hasComparison ? (
                        <ComparisonTablePreview table={question.model_answer_comparison} />
                      ) : question.question_type_code === 'DIFFERENCES' ? (
                        <>
                          <Text style={styles.sectionLabel}>Answer</Text>
                          <Text style={styles.muted}>
                            No comparison table is available for this question yet.
                          </Text>
                        </>
                      ) : (question.model_answer_sections ?? []).length > 0 ? (
                        <>
                          <Text style={styles.sectionLabel}>Answer</Text>
                          {(question.model_answer_sections ?? []).map(renderSection)}
                        </>
                      ) : null}
                      {(question.explanation_sections ?? []).map(renderSection)}
                      {question.note?.trim() ? (
                        <BookRichText html={question.note} style={styles.answerNote} />
                      ) : null}
                    </View>
                  ) : null}

                  <View style={styles.navRow}>
                    <Pressable
                      style={[styles.navBtn, selectedIndex <= 0 && styles.navBtnDisabled]}
                      disabled={selectedIndex <= 0}
                      onPress={goPrev}
                    >
                      <Ionicons name="chevron-back" size={18} color={selectedIndex <= 0 ? colors.textMuted : colors.primary} />
                      <Text style={[styles.navBtnText, selectedIndex <= 0 && styles.navBtnTextDisabled]}>
                        Previous
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.navBtn,
                        selectedIndex >= displayedQuestions.length - 1 && styles.navBtnDisabled,
                      ]}
                      disabled={selectedIndex >= displayedQuestions.length - 1}
                      onPress={goNext}
                    >
                      <Text
                        style={[
                          styles.navBtnText,
                          selectedIndex >= displayedQuestions.length - 1 && styles.navBtnTextDisabled,
                        ]}
                      >
                        Next
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={
                          selectedIndex >= displayedQuestions.length - 1 ? colors.textMuted : colors.primary
                        }
                      />
                    </Pressable>
                  </View>

                  {!question.has_options ? (
                    <ChapterQuestionEvaluator
                      questionId={question.id}
                      onUpdated={handleEvalUpdated}
                    />
                  ) : null}
                </View>
              )
            ) : loadingList ? (
              <BookLoading />
            ) : listError ? (
              <Text style={styles.error}>{listError}</Text>
            ) : questions.length === 0 ? (
              <Text style={styles.muted}>
                {bookId
                  ? 'No published questions are tagged to this book yet.'
                  : 'No published questions are tagged to this chapter yet.'}
              </Text>
            ) : (
              <>
                {mcqQuestions.length > 0 ? (
                  <Pressable
                    style={({ pressed }) => [styles.examBtn, pressed && styles.pressed]}
                    onPress={() => setPanelView('mcq-exam')}
                  >
                    <Ionicons name="timer-outline" size={20} color={colors.white} />
                    <View style={styles.examBtnTextWrap}>
                      <Text style={styles.examBtnTitle}>MCQ exam at a glance</Text>
                      <Text style={styles.examBtnSub}>
                        {mcqQuestions.length} MCQ · {mcqQuestions.length * 60}s countdown
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.white} />
                  </Pressable>
                ) : null}

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterRow}
                >
                  {typeOptions.map((code) => {
                    const active = typeFilter === code;
                    const label = code === 'ALL' ? 'All types' : code;
                    return (
                      <Pressable
                        key={code}
                        style={[styles.filterChip, active && styles.filterChipActive]}
                        onPress={() => setTypeFilter(code)}
                      >
                        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {displayedQuestions.length === 0 ? (
                  <Text style={styles.muted}>No questions for this type.</Text>
                ) : (
                  displayedQuestions.map((q) => (
                    <Pressable
                      key={q.id}
                      style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}
                      onPress={() => openDetail(q.id)}
                    >
                      <View style={styles.listRowTop}>
                        <View style={styles.listBadges}>
                          <BookBadge label={q.question_type_code} variant="muted" />
                        </View>
                        <RatingIndicator evaluation={evalMap.get(q.id)} />
                      </View>
                      <Text style={styles.listBody} numberOfLines={2}>
                        {truncate(q.body_en || q.body_bn)}
                      </Text>
                    </Pressable>
                  ))
                )}
              </>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  tagBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tagBtnFullWidth: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  tagBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  tagBtnTextActive: {
    color: colors.white,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: 2,
    paddingBottom: spacing.xs,
    minHeight: 30,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 72,
    minHeight: 30,
    paddingVertical: spacing.xs,
  },
  headerBtnText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
  },
  headerSpacer: {
    minWidth: 72,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  modalBookSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 2,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    minWidth: 72,
    minHeight: 30,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  modalBodyContent: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  examBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  examBtnTextWrap: {
    flex: 1,
    gap: 2,
  },
  examBtnTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  examBtnSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
  },
  filterRow: {
    gap: 8,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  filterChipTextActive: {
    color: colors.white,
  },
  listRow: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 6,
  },
  listRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listBody: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  detailWrap: {
    gap: spacing.md,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  questionBody: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    fontWeight: '500',
  },
  questionBn: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  optionsWrap: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  evalWrap: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  evalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  showAnswerText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 8,
    padding: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionRowActive: {
    borderColor: colors.primary,
    backgroundColor: '#eef6ff',
  },
  optionCorrect: {
    borderColor: colors.success,
    backgroundColor: '#f0fdf4',
  },
  optionKey: {
    fontWeight: '700',
    color: colors.text,
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  optionTextCorrect: {
    color: colors.success,
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
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
    paddingVertical: 4,
  },
  prevEvalBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  evalSavedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  success: {
    fontSize: 13,
    color: colors.success,
    fontWeight: '600',
  },
  answerWrap: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  answerSection: {
    gap: 4,
  },
  answerSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  answerText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
  answerNote: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    minWidth: 120,
    justifyContent: 'center',
  },
  navBtnDisabled: {
    opacity: 0.45,
  },
  navBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  navBtnTextDisabled: {
    color: colors.textMuted,
  },
  muted: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  error: {
    fontSize: 14,
    color: colors.error,
  },
  pressed: {
    opacity: 0.85,
  },
});
