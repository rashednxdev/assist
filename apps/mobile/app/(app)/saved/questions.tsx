import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookEmpty } from '@/components/books/BookStates';
import { SwipeToRemove } from '@/components/saved/SwipeToRemove';
import { useSavedShortcuts } from '@/hooks/useSavedShortcuts';
import { removeSavedShortcut, type SavedShortcut } from '@/lib/saved-shortcuts';
import { questionDetailHref } from '@/lib/question-routes';
import { colors, spacing } from '@/theme';

type BookGroup = {
  bookKey: string;
  bookName: string;
  items: SavedShortcut[];
};

function groupQuestionsByBook(rows: SavedShortcut[]): BookGroup[] {
  const map = new Map<string, BookGroup>();
  for (const row of rows) {
    const bookKey = row.book_id?.trim() || row.subtitle?.trim() || '__other__';
    const bookName =
      row.subtitle?.trim() ||
      (row.book_id ? 'Book' : 'Other questions');
    let group = map.get(bookKey);
    if (!group) {
      group = { bookKey, bookName, items: [] };
      map.set(bookKey, group);
    }
    group.items.push(row);
  }
  return [...map.values()].sort((a, b) => a.bookName.localeCompare(b.bookName));
}

export default function SavedQuestionsScreen() {
  const router = useRouter();
  const { items } = useSavedShortcuts();
  const questions = useMemo(() => items.filter((row) => row.kind === 'question'), [items]);
  const [selectedBookKey, setSelectedBookKey] = useState<string | null>(null);
  const [bookMenuOpen, setBookMenuOpen] = useState(false);

  const groups = useMemo(() => groupQuestionsByBook(questions), [questions]);
  const bookOptions = useMemo(
    () => groups.map((g) => ({ id: g.bookKey, name: g.bookName, count: g.items.length })),
    [groups],
  );
  const visibleGroups = useMemo(
    () => (selectedBookKey ? groups.filter((g) => g.bookKey === selectedBookKey) : groups),
    [groups, selectedBookKey],
  );
  const selectedBookName = selectedBookKey
    ? bookOptions.find((b) => b.id === selectedBookKey)?.name
    : null;

  if (questions.length === 0) {
    return (
      <BookEmpty
        title="No saved questions"
        subtitle="Tap the bookmark on a non-MCQ question in Question Bank to add it here. MCQs go to Marathon Review."
      />
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <Text style={styles.countLabel}>
          {questions.length} saved
          {selectedBookName ? ` · ${selectedBookName}` : ''}
        </Text>
        <Pressable
          style={styles.menuBtn}
          onPress={() => setBookMenuOpen((v) => !v)}
          accessibilityLabel="Filter by book"
        >
          <Ionicons name="ellipsis-vertical" size={18} color={colors.primary} />
        </Pressable>
      </View>

      {bookMenuOpen ? (
        <View style={styles.bookMenu}>
          <Pressable
            style={[styles.bookMenuItem, !selectedBookKey && styles.bookMenuItemActive]}
            onPress={() => {
              setSelectedBookKey(null);
              setBookMenuOpen(false);
            }}
          >
            <Text style={[styles.bookMenuItemText, !selectedBookKey && styles.bookMenuItemTextActive]}>
              All books ({questions.length})
            </Text>
          </Pressable>
          {bookOptions.map((book) => {
            const active = selectedBookKey === book.id;
            return (
              <Pressable
                key={book.id}
                style={[styles.bookMenuItem, active && styles.bookMenuItemActive]}
                onPress={() => {
                  setSelectedBookKey(book.id);
                  setBookMenuOpen(false);
                }}
              >
                <Text style={[styles.bookMenuItemText, active && styles.bookMenuItemTextActive]} numberOfLines={1}>
                  {book.name} ({book.count})
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {selectedBookName ? (
        <View style={styles.filterChipRow}>
          <View style={styles.filterChip}>
            <Text style={styles.filterChipText} numberOfLines={1}>
              {selectedBookName}
            </Text>
            <Pressable onPress={() => setSelectedBookKey(null)} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.list}>
        {visibleGroups.map((group) => (
          <View key={group.bookKey} style={styles.bookBlock}>
            <Text style={styles.bookTitle}>{group.bookName}</Text>
            {group.items.map((item) => (
              <SwipeToRemove
                key={item.id}
                confirmTitle="Remove saved question?"
                confirmMessage="Remove this question from Saved on this device?"
                onConfirmRemove={() => removeSavedShortcut(item.id, 'question')}
              >
                <Pressable
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  onPress={() => router.push(questionDetailHref(item.id, { fromSaved: true }))}
                >
                  <View style={styles.iconWrap}>
                    <Ionicons name="help-circle-outline" size={22} color="#7c3aed" />
                  </View>
                  <View style={styles.body}>
                    <Text style={styles.title} numberOfLines={3}>
                      {item.title}
                    </Text>
                  </View>
                </Pressable>
              </SwipeToRemove>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  countLabel: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookMenu: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  bookMenuItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  bookMenuItemActive: {
    backgroundColor: '#e8f2fa',
  },
  bookMenuItemText: {
    fontSize: 14,
    color: colors.text,
  },
  bookMenuItemTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  filterChipRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  filterChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e8f2fa',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    maxWidth: 220,
  },
  list: {
    padding: spacing.md,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  bookBlock: {
    gap: spacing.sm,
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  rowPressed: {
    opacity: 0.92,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
});
