import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BookBadge } from '@/components/books/BookBadge';
import { BookLoading } from '@/components/books/BookStates';
import { ChapterMcqExam } from '@/components/books/ChapterMcqExam';
import { ChapterQuestionEvaluator } from '@/components/books/ChapterQuestionEvaluator';
import { RatingIndicator } from '@/components/evaluation/RatingIndicator';
import { fetchChapterQuestions } from '@/lib/books-api';
import { fetchQuestionEvaluationsBatch, type QuestionEvalBrief } from '@/lib/evaluation-api';
import { fetchQuestionDetail } from '@/lib/questions-api';
import { stripHtml } from '@/lib/book-display';
import { bilingualQuestionText } from '@/lib/question-display';
import type { ChapterQuestionBrief } from '@/types/books';
import { ComparisonTableAnswer } from '@/components/questions/ComparisonTableAnswer';
import { useDifferencesLandscape } from '@/hooks/useDifferencesLandscape';
import type { ExplanationSection, QuestionDetail } from '@/types/questions';
import { colors, spacing } from '@/theme';

type PanelView = 'list' | 'detail' | 'mcq-exam';

function truncate(text: string, len = 100) {
  const plain = stripHtml(text);
  return plain.length > len ? `${plain.slice(0, len)}…` : plain;
}

function renderSection(section: ExplanationSection, index: number) {
  return (
    <View key={`sec-${index}`} style={styles.answerSection}>
      {section.title?.trim() ? <Text style={styles.answerSectionTitle}>{section.title}</Text> : null}
      {section.content?.trim() ? <Text style={styles.answerText}>{stripHtml(section.content)}</Text> : null}
      {section.details?.trim() ? <Text style={styles.answerText}>{stripHtml(section.details)}</Text> : null}
      {section.note?.trim() ? <Text style={styles.answerNote}>{stripHtml(section.note)}</Text> : null}
    </View>
  );
}

export function ChapterQuestionsButton({
  active,
  onPress,
}: {
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.tagBtn, active && styles.tagBtnActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="View tagged questions"
    >
      <Ionicons
        name="help-circle-outline"
        size={16}
        color={active ? colors.white : colors.primary}
      />
      <Text style={[styles.tagBtnText, active && styles.tagBtnTextActive]}>Questions</Text>
    </Pressable>
  );
}

export function ChapterQuestionsPanel({
  chapterId,
  chapterTitle,
  open,
  onClose,
}: {
  chapterId: string;
  chapterTitle?: string;
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

  const hasComparison =
    Boolean(question?.model_answer_comparison?.columns && question.model_answer_comparison.columns.length >= 2) &&
    Boolean(question?.model_answer_comparison?.rows && question.model_answer_comparison.rows.length > 0);

  const questionStem = question
    ? bilingualQuestionText(question.body_en, question.body_bn)
    : null;

  const showDifferencesAnswer = Boolean(
    open &&
      panelView === 'detail' &&
      question &&
      (question.question_type_code === 'DIFFERENCES' || hasComparison) &&
      hasComparison,
  );

  useDifferencesLandscape(showDifferencesAnswer);

  useEffect(() => {
    if (!open) {
      setPanelView('list');
      setSelectedId(null);
      setTypeFilter('ALL');
      return;
    }
    setLoadingList(true);
    setListError('');
    fetchChapterQuestions(chapterId)
      .then(async (rows) => {
        setQuestions(rows);
        if (rows.length === 0) {
          setEvalMap(new Map());
          return;
        }
        const evals = await fetchQuestionEvaluationsBatch(rows.map((q) => q.id));
        const map = new Map<string, QuestionEvalBrief>();
        for (const row of evals) {
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
    if (!selectedId || panelView !== 'detail') {
      setQuestion(null);
      return;
    }
    setLoadingDetail(true);
    fetchQuestionDetail(selectedId)
      .then(setQuestion)
      .catch(() => setQuestion(null))
      .finally(() => setLoadingDetail(false));
  }, [selectedId, panelView]);

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
        : 'Tagged questions';

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalRoot}>
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
            <Text style={styles.modalTitle} numberOfLines={1}>
              {headerTitle}
            </Text>
            {panelView === 'list' && chapterTitle ? (
              <Text style={styles.modalSubtitle} numberOfLines={1}>
                {chapterTitle}
              </Text>
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
                      <Text style={styles.questionBody}>{questionStem.primary}</Text>
                      {questionStem.secondary ? (
                        <Text style={styles.questionBn}>{questionStem.secondary}</Text>
                      ) : null}
                    </>
                  ) : null}

                  {question.options.length > 0 ? (
                    <View style={styles.optionsWrap}>
                      <Text style={styles.sectionLabel}>Options</Text>
                      {question.options.map((opt) => (
                        <View
                          key={opt.id}
                          style={[styles.optionRow, opt.is_correct && styles.optionCorrect]}
                        >
                          <Text style={styles.optionKey}>{opt.option_key.toUpperCase()}.</Text>
                          <Text style={styles.optionText}>
                            {opt.option_text_en?.trim() || opt.option_text_bn?.trim()}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <View style={styles.answerWrap}>
                    {hasComparison ? (
                      <ComparisonTableAnswer table={question.model_answer_comparison} />
                    ) : question.question_type_code === 'DIFFERENCES' ? (
                      <>
                        <Text style={styles.sectionLabel}>Answer</Text>
                        <Text style={styles.muted}>
                          No comparison table is available for this question yet.
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.sectionLabel}>Answer</Text>
                        {(question.model_answer_sections ?? []).map(renderSection)}
                      </>
                    )}
                    {(question.explanation_sections ?? []).map(renderSection)}
                    {question.note?.trim() ? (
                      <Text style={styles.answerNote}>{question.note}</Text>
                    ) : null}
                  </View>

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

                  <ChapterQuestionEvaluator
                    questionId={question.id}
                    onUpdated={handleEvalUpdated}
                  />
                </View>
              )
            ) : loadingList ? (
              <BookLoading />
            ) : listError ? (
              <Text style={styles.error}>{listError}</Text>
            ) : questions.length === 0 ? (
              <Text style={styles.muted}>
                No published questions are tagged to this chapter yet.
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
      </SafeAreaView>
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
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 72,
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
  modalSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    minWidth: 72,
    alignItems: 'flex-end',
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
  optionRow: {
    flexDirection: 'row',
    gap: 8,
    padding: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
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
