import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BookBadge } from './BookBadge';
import { stripHtml } from '@/lib/book-display';
import type { BookListItem } from '@/types/books';
import { colors, spacing } from '@/theme';

interface BookCardProps {
  book: BookListItem;
  onPress: () => void;
}

export function BookCard({ book, onPress }: BookCardProps) {
  const preview = stripHtml(book.description).slice(0, 140);

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.iconWrap}>
        <Ionicons name="book-outline" size={22} color={colors.primary} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{book.name}</Text>
        <View style={styles.badges}>
          {book.short_name ? <BookBadge label={book.short_name} /> : null}
          {book.book_type_name ? <BookBadge label={book.book_type_name} variant="muted" /> : null}
          {book.edition ? <BookBadge label={book.edition} variant="muted" /> : null}
        </View>
        {preview ? <Text style={styles.preview}>{preview}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  pressed: {
    opacity: 0.92,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#e8f2fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  preview: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: 4,
  },
});
