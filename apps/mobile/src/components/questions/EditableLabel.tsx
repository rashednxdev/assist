import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TextField } from '@/components/ui/TextField';
import { colors, spacing } from '@/theme';

interface EditableLabelProps {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onRemove: () => void;
  removeLabel: string;
  editable?: boolean;
  disabled?: boolean;
}

/**
 * A title/subtitle shown as plain text with a pencil icon — tap to reveal an inline text input
 * with Done/Remove actions, instead of an always-visible input cluttering the screen.
 */
export function EditableLabel({
  value,
  placeholder,
  onChange,
  onRemove,
  removeLabel,
  editable = true,
  disabled = false,
}: EditableLabelProps) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <Pressable
        style={styles.displayRow}
        onPress={() => editable && setEditing(true)}
        disabled={!editable || disabled}
      >
        <Text style={[styles.displayText, !value && styles.displayPlaceholder]} numberOfLines={2}>
          {value || placeholder}
        </Text>
        {editable ? <Ionicons name="pencil-outline" size={16} color={colors.textMuted} /> : null}
      </Pressable>
    );
  }

  return (
    <View style={styles.editWrap}>
      <TextField
        label=""
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        editable={!disabled}
        autoFocus
      />
      <View style={styles.editActions}>
        <Pressable style={styles.editActionBtn} onPress={() => setEditing(false)} disabled={disabled}>
          <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
          <Text style={styles.editActionText}>Done</Text>
        </Pressable>
        <Pressable
          style={styles.editActionBtn}
          onPress={() => {
            setEditing(false);
            onRemove();
          }}
          disabled={disabled}
        >
          <Ionicons name="trash-outline" size={18} color={colors.error} />
          <Text style={[styles.editActionText, styles.editActionTextDanger]}>{removeLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  displayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  displayText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  displayPlaceholder: {
    fontWeight: '500',
    color: colors.textMuted,
  },
  editWrap: {
    gap: 6,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  editActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
  },
  editActionTextDanger: {
    color: colors.error,
  },
});
