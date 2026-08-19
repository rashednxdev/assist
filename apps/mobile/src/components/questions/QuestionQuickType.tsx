import { useState } from 'react';
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
import { updateQuestionType } from '@/lib/question-edit-api';
import { updateCachedQuestionType } from '@/lib/questions-db';
import { notifyQuestionsCacheChanged } from '@/lib/questions-sync';
import type { QuestionType } from '@/types/questions';
import { colors, spacing } from '@/theme';

export function QuestionQuickType({
  questionId,
  typeId,
  typeCode,
  typeName,
  types,
  disabled,
  onChanged,
}: {
  questionId: string;
  typeId: string;
  typeCode: string;
  typeName?: string;
  types: QuestionType[];
  disabled?: boolean;
  onChanged: (next: { id: string; code: string; name: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const label = typeName?.trim() || typeCode;

  async function selectType(next: QuestionType) {
    if (disabled || busy) return;
    if (next.id === typeId) {
      setOpen(false);
      return;
    }
    setBusy(true);
    setOpen(false);
    try {
      const updated = await updateQuestionType(questionId, next.id);
      const code = updated.question_type_code || next.code;
      const name = updated.question_type_name || next.name;
      try {
        updateCachedQuestionType(questionId, code);
        notifyQuestionsCacheChanged();
      } catch {
        // Offline cache is best-effort.
      }
      onChanged({ id: updated.question_type_id || next.id, code, name });
    } catch (err) {
      Alert.alert('Could not change type', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (disabled) {
    return (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{label}</Text>
      </View>
    );
  }

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.chip, (pressed || busy) && styles.chipPressed]}
        onPress={() => setOpen(true)}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`Change question type, currently ${label}`}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="swap-vertical" size={12} color={colors.primary} />
        )}
        <Text style={styles.chipText}>{label}</Text>
        <Ionicons name="chevron-down" size={12} color={colors.primary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Change question type</Text>
            <Text style={styles.modalSub}>Tap a type to apply it to this question</Text>
            <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
              {types.length === 0 ? (
                <Text style={styles.modalEmpty}>No types available.</Text>
              ) : (
                types.map((item) => {
                  const active = item.id === typeId;
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.modalItem, active && styles.modalItemActive]}
                      onPress={() => void selectType(item)}
                    >
                      <View style={styles.modalItemTextWrap}>
                        <Text style={[styles.modalItemText, active && styles.modalItemTextActive]}>
                          {item.name}
                        </Text>
                        <Text style={styles.modalItemCode}>{item.code}</Text>
                      </View>
                      {active ? (
                        <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
            <Pressable style={styles.modalCancel} onPress={() => setOpen(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e8f3fa',
    borderRadius: 999,
    paddingVertical: 4,
    paddingLeft: 8,
    paddingRight: 8,
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipText: {
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
  },
  modalItemActive: {
    backgroundColor: '#e8f3fa',
  },
  modalItemTextWrap: {
    flex: 1,
    gap: 2,
  },
  modalItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  modalItemTextActive: {
    color: colors.primary,
  },
  modalItemCode: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
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
