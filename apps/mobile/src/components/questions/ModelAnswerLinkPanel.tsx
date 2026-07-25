import { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchQuestionsForEdit, setMotherQuestion, removeMotherQuestion } from '@/lib/question-edit-api';
import type { QuestionListItem } from '@/types/questions';
import { colors, spacing } from '@/theme';

interface ProtoQuestion {
  id: string;
  label: string;
}

interface ModelAnswerLinkPanelProps {
  questionId: string;
  motherQuestionId?: string;
  motherQuestionLabel?: string;
  prototypeQuestions?: ProtoQuestion[];
  disabled?: boolean;
  onChange: () => void;
}

/** Link this question's model answer to a "mother" question's shared answer, or manage its own prototypes. */
export function ModelAnswerLinkPanel({
  questionId,
  motherQuestionId,
  motherQuestionLabel,
  prototypeQuestions = [],
  disabled,
  onChange,
}: ModelAnswerLinkPanelProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<QuestionListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isPrototype = Boolean(motherQuestionId);
  const isMother = !isPrototype && prototypeQuestions.length > 0;

  async function search() {
    const q = query.trim();
    if (q.length < 2) return;
    setSearching(true);
    setError('');
    try {
      const res = await fetchQuestionsForEdit({ q, limit: 20 });
      setResults(res.items.filter((r) => r.id !== questionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  async function linkTo(motherId: string) {
    setBusy(true);
    setError('');
    try {
      await setMotherQuestion(questionId, motherId);
      setPickerOpen(false);
      setQuery('');
      setResults([]);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link answer');
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    setError('');
    try {
      await removeMotherQuestion(questionId);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink answer');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {isPrototype ? (
        <View style={styles.linkedWrap}>
          <View style={styles.linkedRow}>
            <Ionicons name="link" size={14} color={colors.primary} />
            <Text style={styles.linkedText} numberOfLines={2}>
              Mother question: {motherQuestionLabel || motherQuestionId}
            </Text>
          </View>
          <Pressable style={styles.unlinkBtn} onPress={() => void unlink()} disabled={disabled || busy}>
            <Ionicons name="unlink" size={14} color={colors.error} />
            <Text style={styles.unlinkBtnText}>Remove link</Text>
          </Pressable>
        </View>
      ) : null}

      {prototypeQuestions.length > 0 ? (
        <View style={styles.familyWrap}>
          <Text style={styles.familyTitle}>
            Prototype question{prototypeQuestions.length === 1 ? '' : 's'} ({prototypeQuestions.length}) — share this
            answer:
          </Text>
          {prototypeQuestions.map((p) => (
            <Text key={p.id} style={styles.familyItem} numberOfLines={2}>
              • {p.label}
            </Text>
          ))}
        </View>
      ) : null}

      {!isPrototype && !isMother ? (
        <Pressable style={styles.reuseBtn} onPress={() => setPickerOpen(true)} disabled={disabled}>
          <Ionicons name="link-outline" size={16} color={colors.primary} />
          <Text style={styles.reuseBtnText}>Link answer with another question</Text>
        </Pressable>
      ) : null}

      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Link with another question</Text>
              <Pressable onPress={() => setPickerOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search question text..."
                placeholderTextColor={colors.textMuted}
                returnKeyType="search"
                onSubmitEditing={() => void search()}
              />
              <Pressable style={styles.searchBtn} onPress={() => void search()} disabled={searching}>
                {searching ? <ActivityIndicator color={colors.white} size="small" /> : (
                  <Ionicons name="search" size={16} color={colors.white} />
                )}
              </Pressable>
            </View>
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              style={styles.resultsList}
              ListEmptyComponent={
                !searching && query.trim().length >= 2 ? (
                  <Text style={styles.emptyText}>No questions found.</Text>
                ) : null
              }
              renderItem={({ item }) => (
                <View style={styles.resultRow}>
                  <Text style={styles.resultText} numberOfLines={2}>
                    {item.body_bn || item.body_en}
                  </Text>
                  <Pressable style={styles.useBtn} onPress={() => void linkTo(item.id)} disabled={busy}>
                    <Text style={styles.useBtnText}>Use this</Text>
                  </Pressable>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  reuseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reuseBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  linkedWrap: {
    gap: 6,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    padding: spacing.sm,
    backgroundColor: '#eef6ff',
  },
  linkedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  linkedText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  unlinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  unlinkBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.error,
  },
  familyWrap: {
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
    backgroundColor: '#f8fafc',
  },
  familyTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  familyItem: {
    fontSize: 12,
    color: colors.text,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: spacing.md,
    maxHeight: '80%',
    gap: spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
  },
  searchBtn: {
    width: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  resultsList: {
    maxHeight: 320,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    paddingVertical: spacing.md,
    textAlign: 'center',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: 8,
  },
  resultText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  useBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  useBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
});
