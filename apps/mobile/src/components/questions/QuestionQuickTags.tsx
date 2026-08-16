import { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  addQuestionBookFirstChapterTag,
  addQuestionSubjectTag,
  removeQuestionBookFirstChapterTag,
  removeQuestionSubjectTag,
  type BookCatalogItem,
} from '@/lib/question-edit-api';
import {
  removeCachedQuestionBookLink,
  upsertCachedQuestionBookLink,
} from '@/lib/questions-db';
import { notifyQuestionsCacheChanged } from '@/lib/questions-sync';
import type { SubjectCatalogItem } from '@/lib/questions-api';
import { colors, spacing } from '@/theme';

export interface QuestionSubjectTag {
  id: string;
  name: string;
  name_bn?: string;
}

export interface QuestionBookTag {
  id: string;
  name: string;
  chapter_id: string;
}

interface QuestionQuickTagsProps {
  questionId: string;
  subjects: QuestionSubjectTag[];
  books: QuestionBookTag[];
  subjectCatalog: SubjectCatalogItem[];
  bookCatalog: BookCatalogItem[];
  disabled?: boolean;
  onSubjectsChange: (subjects: QuestionSubjectTag[]) => void;
  onBooksChange: (books: QuestionBookTag[]) => void;
}

type PickerKind = 'subject' | 'book';

function subjectLabel(s: { name: string; name_bn?: string }) {
  return s.name_bn?.trim() || s.name;
}

/** Inline subject + book tags on Question Update list rows. New book tags link to first chapter. */
export function QuestionQuickTags({
  questionId,
  subjects,
  books,
  subjectCatalog,
  bookCatalog,
  disabled,
  onSubjectsChange,
  onBooksChange,
}: QuestionQuickTagsProps) {
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<PickerKind | null>(null);

  const taggedSubjectIds = useMemo(() => new Set(subjects.map((s) => s.id)), [subjects]);
  const taggedBookIds = useMemo(() => new Set(books.map((b) => b.id)), [books]);
  const availableSubjects = subjectCatalog.filter((c) => !taggedSubjectIds.has(c.id));
  const availableBooks = bookCatalog.filter((c) => !taggedBookIds.has(c.id));

  async function addSubject(examSubjectId: string) {
    if (!examSubjectId || busy || disabled) return;
    setBusy(true);
    setPicker(null);
    try {
      const res = await addQuestionSubjectTag(questionId, examSubjectId);
      const next = [
        ...subjects.filter((s) => s.id !== res.exam_subject_id),
        { id: res.exam_subject_id, name: res.name, name_bn: res.name_bn },
      ];
      onSubjectsChange(next);
    } catch (err) {
      Alert.alert('Could not add subject', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function removeSubject(examSubjectId: string) {
    if (busy || disabled) return;
    setBusy(true);
    try {
      await removeQuestionSubjectTag(questionId, examSubjectId);
      onSubjectsChange(subjects.filter((s) => s.id !== examSubjectId));
    } catch (err) {
      Alert.alert('Could not remove subject', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function addBook(bookInfoId: string) {
    if (!bookInfoId || busy || disabled) return;
    setBusy(true);
    setPicker(null);
    try {
      const res = await addQuestionBookFirstChapterTag(questionId, bookInfoId);
      const next = [
        ...books.filter((b) => b.id !== res.id),
        { id: res.id, name: res.name, chapter_id: res.chapter_id },
      ];
      onBooksChange(next);
      try {
        upsertCachedQuestionBookLink(questionId, res.id, res.chapter_id);
        notifyQuestionsCacheChanged();
      } catch {
        // Local cache optional — server tag already saved.
      }
    } catch (err) {
      Alert.alert('Could not add book', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function removeBook(bookInfoId: string) {
    if (busy || disabled) return;
    setBusy(true);
    try {
      await removeQuestionBookFirstChapterTag(questionId, bookInfoId);
      onBooksChange(books.filter((b) => b.id !== bookInfoId));
      try {
        removeCachedQuestionBookLink(questionId, bookInfoId);
        notifyQuestionsCacheChanged();
      } catch {
        // Local cache optional — server untag already saved.
      }
    } catch (err) {
      Alert.alert('Could not remove book', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  const pickerTitle = picker === 'subject' ? 'Add subject' : 'Add book';
  const pickerItems =
    picker === 'subject'
      ? availableSubjects.map((s) => ({ id: s.id, label: s.label }))
      : availableBooks.map((b) => ({ id: b.id, label: b.label }));

  return (
    <View style={styles.wrap} onStartShouldSetResponder={() => true}>
      {subjects.map((s) => (
        <View key={`s-${s.id}`} style={[styles.chip, styles.subjectChip]}>
          <Text style={styles.chipText} numberOfLines={1}>
            {subjectLabel(s)}
          </Text>
          {!disabled ? (
            <Pressable
              hitSlop={8}
              disabled={busy}
              onPress={() => void removeSubject(s.id)}
              accessibilityLabel={`Remove ${subjectLabel(s)}`}
            >
              <Ionicons name="close" size={12} color={colors.primary} />
            </Pressable>
          ) : null}
        </View>
      ))}
      {books.map((b) => (
        <View key={`b-${b.id}`} style={[styles.chip, styles.bookChip]}>
          <Text style={styles.bookChipText} numberOfLines={1}>
            {b.name}
          </Text>
          {!disabled ? (
            <Pressable
              hitSlop={8}
              disabled={busy}
              onPress={() => void removeBook(b.id)}
              accessibilityLabel={`Remove book ${b.name}`}
            >
              <Ionicons name="close" size={12} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      ))}
      {!disabled && availableSubjects.length > 0 ? (
        <Pressable
          style={[styles.addChip, busy && styles.addChipDisabled]}
          disabled={busy}
          onPress={() => setPicker('subject')}
        >
          <Text style={styles.addChipText}>+ Subject</Text>
        </Pressable>
      ) : null}
      {!disabled && availableBooks.length > 0 ? (
        <Pressable
          style={[styles.addChip, busy && styles.addChipDisabled]}
          disabled={busy}
          onPress={() => setPicker('book')}
        >
          <Text style={styles.addChipText}>+ Book</Text>
        </Pressable>
      ) : null}
      {busy ? <ActivityIndicator size="small" color={colors.primary} /> : null}

      <Modal
        visible={picker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setPicker(null)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{pickerTitle}</Text>
            <Text style={styles.modalSub}>
              {picker === 'book'
                ? "Links this question to the book's first chapter"
                : 'Tag this question with an exam subject'}
            </Text>
            <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
              {pickerItems.length === 0 ? (
                <Text style={styles.modalEmpty}>Nothing left to add.</Text>
              ) : (
                pickerItems.map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.modalItem}
                    onPress={() =>
                      picker === 'subject' ? void addSubject(item.id) : void addBook(item.id)
                    }
                  >
                    <Text style={styles.modalItemText}>{item.label}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
            <Pressable style={styles.modalCancel} onPress={() => setPicker(null)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  chip: {
    maxWidth: '92%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingVertical: 5,
    paddingLeft: 10,
    paddingRight: 6,
  },
  subjectChip: {
    backgroundColor: '#e8f3fa',
  },
  bookChip: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  bookChipText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  addChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.surface,
  },
  addChipDisabled: {
    opacity: 0.5,
  },
  addChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  modalSheet: {
    maxHeight: '70%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    paddingHorizontal: spacing.md,
  },
  modalSub: {
    fontSize: 12,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    paddingTop: 4,
    paddingBottom: spacing.sm,
  },
  modalList: {
    paddingHorizontal: spacing.sm,
  },
  modalEmpty: {
    padding: spacing.md,
    fontSize: 13,
    color: colors.textMuted,
  },
  modalItem: {
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
  },
  modalItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  modalCancel: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.md,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
});
