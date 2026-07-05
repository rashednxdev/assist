import { View, Text, StyleSheet } from 'react-native';
import { HtmlContent } from '@/components/books/HtmlContent';
import { colors, spacing } from '@/theme';

export function BookDetailsBlock({
  html,
  note,
  showEmpty = false,
}: {
  html?: string;
  note?: string;
  showEmpty?: boolean;
}) {
  const hasDetails = Boolean(html?.trim());
  const hasNote = Boolean(note?.trim());

  if (!hasDetails && !hasNote) {
    if (!showEmpty) return null;
    return <Text style={styles.empty}>No details entered for this item.</Text>;
  }

  return (
    <View style={styles.wrap}>
      {hasDetails ? <HtmlContent html={html} /> : null}
      {hasNote ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteLabel}>Note</Text>
          <Text style={styles.noteText}>{note?.trim()}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  empty: {
    fontSize: 14,
    color: colors.textMuted,
  },
  noteBox: {
    gap: 4,
  },
  noteLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  noteText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
});
