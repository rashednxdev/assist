import { useEffect, useState } from 'react';
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
import { fetchChapterQuestions } from '@/lib/books-api';
import { fetchQuestionDetail } from '@/lib/questions-api';
import { stripHtml } from '@/lib/book-display';
import type { ChapterQuestionBrief } from '@/types/books';
import type { ExplanationSection, QuestionDetail } from '@/types/questions';
import { colors, spacing } from '@/theme';

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
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [question, setQuestion] = useState<QuestionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      return;
    }
    setLoadingList(true);
    setListError('');
    fetchChapterQuestions(chapterId)
      .then(setQuestions)
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
    fetchQuestionDetail(selectedId)
      .then(setQuestion)
      .catch(() => setQuestion(null))
      .finally(() => setLoadingDetail(false));
  }, [selectedId]);

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalRoot}>
        <View style={styles.modalHeader}>
          {selectedId ? (
            <Pressable style={styles.headerBtn} onPress={() => setSelectedId(null)}>
              <Ionicons name="chevron-back" size={20} color={colors.primary} />
              <Text style={styles.headerBtnText}>Back</Text>
            </Pressable>
          ) : (
            <View style={styles.headerSpacer} />
          )}
          <View style={styles.headerTitleWrap}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {selectedId ? 'Question' : 'Tagged questions'}
            </Text>
            {!selectedId && chapterTitle ? (
              <Text style={styles.modalSubtitle} numberOfLines={1}>
                {chapterTitle}
              </Text>
            ) : null}
          </View>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
          {selectedId ? (
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
                <Text style={styles.questionBody}>{question.body_en}</Text>
                {question.body_bn?.trim() ? (
                  <Text style={styles.questionBn}>{question.body_bn}</Text>
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
                  <Text style={styles.sectionLabel}>Answer</Text>
                  {(question.model_answer_sections ?? []).map(renderSection)}
                  {(question.explanation_sections ?? []).map(renderSection)}
                  {question.note?.trim() ? (
                    <Text style={styles.answerNote}>{question.note}</Text>
                  ) : null}
                </View>
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
            questions.map((q) => (
              <Pressable
                key={q.id}
                style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}
                onPress={() => setSelectedId(q.id)}
              >
                <View style={styles.listBadges}>
                  <BookBadge label={q.question_type_code} variant="muted" />
                </View>
                <Text style={styles.listBody} numberOfLines={2}>
                  {truncate(q.body_en || q.body_bn)}
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
  },
  modalBodyContent: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  listRow: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 6,
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
