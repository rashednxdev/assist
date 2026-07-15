import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SaveButton } from '@/components/ui/SaveButton';
import { BookBadge } from './BookBadge';
import { stripHtml } from '@/lib/book-display';
import type { BookListItem } from '@/types/books';
import { colors, spacing } from '@/theme';

interface BookCardProps {
  book: BookListItem;
  onPress: () => void;
  /** Highlight as the most recently opened book. */
  isLastRead?: boolean;
  saved?: boolean;
  onToggleSave?: () => void;
}

export function BookCard({ book, onPress, isLastRead, saved = false, onToggleSave }: BookCardProps) {
  const preview = stripHtml(book.description).slice(0, 140);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, isLastRead && styles.cardLastRead, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={[styles.iconWrap, isLastRead && styles.iconWrapLastRead]}>
        <Ionicons name="book-outline" size={22} color={isLastRead ? '#2f7d4a' : colors.primary} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>
            {book.name}
          </Text>
          {isLastRead ? (
            <View style={styles.lastReadChip}>
              <Text style={styles.lastReadChipText}>Last read</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.badges}>
          {book.short_name ? <BookBadge label={book.short_name} /> : null}
          {book.book_type_name ? <BookBadge label={book.book_type_name} variant="muted" /> : null}
          {book.edition ? <BookBadge label={book.edition} variant="muted" /> : null}
        </View>
        {preview ? <Text style={styles.preview}>{preview}</Text> : null}
      </View>
      {onToggleSave ? <SaveButton saved={saved} onPress={onToggleSave} /> : null}
      <Ionicons name="chevron-forward" size={18} color={isLastRead ? '#2f7d4a' : colors.textMuted} />
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
  cardLastRead: {
    backgroundColor: '#eaf7ee',
    borderColor: '#a8d5b5',
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
  iconWrapLastRead: {
    backgroundColor: '#d4eedc',
  },
  body: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  lastReadChip: {
    backgroundColor: '#c8e6d0',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  lastReadChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2f7d4a',
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
