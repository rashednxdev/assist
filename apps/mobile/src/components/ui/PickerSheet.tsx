import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/theme';

export interface PickerOption {
  value: string;
  label: string;
  hint?: string;
  badge?: string;
}

interface PickerSheetProps {
  visible: boolean;
  title: string;
  options: PickerOption[];
  value?: string | null;
  onSelect: (option: PickerOption) => void;
  onClose: () => void;
  /** Filter the given options locally when true. */
  searchable?: boolean;
  /** Remote search: called (debounced) with the query; options are supplied by the caller. */
  onSearch?: (q: string) => void;
  loading?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Adds a first row that selects "" (e.g. "Not set" / "All"). */
  clearLabel?: string;
}

/** Bottom sheet list picker with optional local or remote search. */
export function PickerSheet({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
  searchable,
  onSearch,
  loading,
  searchPlaceholder = 'Search…',
  emptyText = 'Nothing to choose from yet.',
  clearLabel,
}: PickerSheetProps) {
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!visible) setQ('');
  }, [visible]);

  useEffect(() => {
    if (!visible || !onSearch) return;
    const t = setTimeout(() => onSearch(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q, visible, onSearch]);

  const shown = useMemo(() => {
    const list = clearLabel ? [{ value: '', label: clearLabel }, ...options] : options;
    if (!searchable || onSearch) return list;
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((o) => `${o.label} ${o.hint ?? ''} ${o.badge ?? ''}`.toLowerCase().includes(needle));
  }, [options, q, searchable, onSearch, clearLabel]);

  const showSearch = searchable || !!onSearch;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>
        </View>
        {showSearch ? (
          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          </View>
        ) : null}
        <FlatList
          data={shown}
          keyExtractor={(o) => o.value || '__clear'}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          ListEmptyComponent={
            loading ? null : <Text style={styles.empty}>{emptyText}</Text>
          }
          renderItem={({ item }) => {
            const active = (value ?? '') === item.value;
            return (
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
              >
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, active && styles.rowLabelActive]} numberOfLines={2}>
                    {item.label}
                    {item.badge ? <Text style={styles.badge}>{`  ${item.badge}`}</Text> : null}
                  </Text>
                  {item.hint ? (
                    <Text style={styles.rowHint} numberOfLines={1}>
                      {item.hint}
                    </Text>
                  ) : null}
                </View>
                {active ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

interface SelectFieldProps {
  label: string;
  /** Text shown for the current choice; empty shows the placeholder. */
  display: string;
  placeholder?: string;
  onPress: () => void;
  hint?: string;
  error?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  required?: boolean;
}

/** Looks like a text field; opens a picker when tapped. */
export function SelectField({
  label,
  display,
  placeholder = 'Select',
  onPress,
  hint,
  error,
  icon = 'chevron-down',
  disabled,
  required,
}: SelectFieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <Pressable
        style={[styles.field, error ? styles.fieldError : null, disabled && styles.fieldDisabled]}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={[styles.fieldValue, !display && styles.placeholder]} numberOfLines={2}>
          {display || placeholder}
        </Text>
        <Ionicons name={icon} size={18} color={colors.textMuted} />
      </Pressable>
      {hint && !error ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      {error ? <Text style={styles.fieldErrorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: 260,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm + 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.background,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 8,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowPressed: {
    backgroundColor: colors.background,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  rowLabelActive: {
    color: colors.primary,
  },
  rowHint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  empty: {
    padding: spacing.lg,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 14,
  },
  fieldWrap: {
    gap: spacing.xs,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  required: {
    color: colors.error,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  fieldError: {
    borderColor: colors.error,
  },
  fieldDisabled: {
    opacity: 0.55,
  },
  fieldValue: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  placeholder: {
    color: colors.textMuted,
  },
  fieldHint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  fieldErrorText: {
    fontSize: 12,
    color: colors.error,
  },
});
