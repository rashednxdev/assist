import { View, Text, Pressable, ScrollView, StyleSheet, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ComparisonTableEditor } from '@/components/questions/ComparisonTableEditor';
import { useDifferencesLandscape } from '@/hooks/useDifferencesLandscape';
import type { ComparisonTable } from '@/types/questions';
import { colors, spacing } from '@/theme';

interface ComparisonTableEditorModalProps {
  visible: boolean;
  value?: ComparisonTable;
  onChange: (next: ComparisonTable) => void;
  onClose: () => void;
  disabled?: boolean;
}

/** Full-screen, landscape-locked editor for one comparison table — more room than the portrait form. */
export function ComparisonTableEditorModal({
  visible,
  value,
  onChange,
  onClose,
  disabled,
}: ComparisonTableEditorModalProps) {
  useDifferencesLandscape(visible);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Comparison table</Text>
          <Pressable style={styles.doneBtn} onPress={onClose} hitSlop={8}>
            <Ionicons name="checkmark" size={18} color={colors.white} />
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {value ? (
            <ComparisonTableEditor value={value} onChange={onChange} disabled={disabled} />
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primaryDark,
  },
  headerTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.success,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  doneBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
});
