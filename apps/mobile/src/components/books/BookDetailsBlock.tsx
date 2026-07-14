import { View, Text, StyleSheet } from 'react-native';
import { BookRichText } from '@/components/books/BookRichText';
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
      {hasDetails ? <BookRichText html={html} /> : null}
      {hasNote ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteLabel}>Note</Text>
          <BookRichText html={note} />
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
});
