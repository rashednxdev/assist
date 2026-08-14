import { Modal, View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BOOK_TEXT_MARKUP_HELP } from '@ibas/shared-constants';
import { colors, spacing } from '@/theme';

export function MarkupInstructionsModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Text markup</Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close markup guide">
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.intro}>
            Use these markers in question text, options, model answers, explanations, and notes.
            Markers are removed when the text is shown to users.
          </Text>
          {BOOK_TEXT_MARKUP_HELP.map((row) => (
            <View key={row.marker} style={styles.card}>
              <Text style={styles.marker}>{row.marker}</Text>
              <Text style={styles.description}>{row.description}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  intro: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    gap: 6,
  },
  marker: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
});
