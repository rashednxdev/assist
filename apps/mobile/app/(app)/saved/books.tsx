import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookEmpty } from '@/components/books/BookStates';
import { SwipeToRemove } from '@/components/saved/SwipeToRemove';
import { useSavedShortcuts } from '@/hooks/useSavedShortcuts';
import { removeSavedShortcut } from '@/lib/saved-shortcuts';
import { bookDetailHref } from '@/lib/book-routes';
import { colors, spacing } from '@/theme';

export default function SavedBooksScreen() {
  const router = useRouter();
  const { items } = useSavedShortcuts();
  const books = items.filter((row) => row.kind === 'book');

  return (
    <View style={styles.root}>
      {books.length === 0 ? (
        <BookEmpty
          title="No saved books"
          subtitle="Tap the bookmark on a book in Books and Tools to add it here."
        />
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <SwipeToRemove
              confirmTitle="Remove saved book?"
              confirmMessage={`Remove “${item.title}” from Saved on this device?`}
              onConfirmRemove={() => removeSavedShortcut(item.id, 'book')}
            >
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => router.push(bookDetailHref(item.id, { fromSaved: true }))}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name="book-outline" size={22} color={colors.primary} />
                </View>
                <View style={styles.body}>
                  <Text style={styles.title} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.subtitle ? (
                    <Text style={styles.sub} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            </SwipeToRemove>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
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
    backgroundColor: '#e8f2fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  sub: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
