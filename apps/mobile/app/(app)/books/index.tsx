import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookCard } from '@/components/books/BookCard';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { fetchBooks, fetchBookSubjectCatalog } from '@/lib/books-api';
import { bookDetailHref } from '@/lib/book-routes';
import { loadLastReadBookId, pinLastReadBook } from '@/lib/last-read-book';
import { useSavedShortcuts } from '@/hooks/useSavedShortcuts';
import { useAuth } from '@/lib/auth-context';
import type { BookListItem } from '@/types/books';
import { colors, spacing } from '@/theme';

type SubjectOption = { id: string; name: string; name_bn?: string; label: string };

export default function BooksLibraryScreen() {
  const router = useRouter();
  const { canAccess } = useAuth();
  const [books, setBooks] = useState<BookListItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [bookMenuOpen, setBookMenuOpen] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [subjectFilterId, setSubjectFilterId] = useState('');
  const [subjectCatalog, setSubjectCatalog] = useState<SubjectOption[]>([]);
  const [lastReadBookId, setLastReadBookId] = useState<string | null>(null);
  const { isSaved, toggle } = useSavedShortcuts();

  const load = useCallback(async (search?: string, examSubjectId?: string) => {
    setError('');
    try {
      const data = await fetchBooks({
        q: search,
        exam_subject_id: examSubjectId || undefined,
      });
      setBooks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load books');
    }
  }, []);

  useEffect(() => {
    if (!canAccess('BOOKS')) {
      setLoading(false);
      setError('You do not have access to Books & Tools.');
      return;
    }
    setLoading(true);
    void Promise.all([
      load(undefined, subjectFilterId || undefined),
      fetchBookSubjectCatalog()
        .then(setSubjectCatalog)
        .catch(() => setSubjectCatalog([])),
    ]).finally(() => setLoading(false));
  }, [canAccess, load, subjectFilterId]);

  useFocusEffect(
    useCallback(() => {
      void loadLastReadBookId().then(setLastReadBookId);
    }, []),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      load(query, subjectFilterId || undefined),
      loadLastReadBookId().then(setLastReadBookId),
      fetchBookSubjectCatalog()
        .then(setSubjectCatalog)
        .catch(() => undefined),
    ]);
    setRefreshing(false);
  }, [load, query, subjectFilterId]);

  const onSearch = useCallback(() => {
    setLoading(true);
    setBookMenuOpen(false);
    void load(query, subjectFilterId || undefined).finally(() => setLoading(false));
  }, [load, query, subjectFilterId]);

  // API already returns subject-sorted books; only pin last-read to the top.
  const orderedBooks = useMemo(
    () => pinLastReadBook(books, lastReadBookId),
    [books, lastReadBookId],
  );

  const bookOptions = useMemo(
    () =>
      orderedBooks.map((b) => ({
        id: b.id,
        name: b.name,
      })),
    [orderedBooks],
  );

  const visibleBooks = useMemo(
    () => (selectedBookId ? orderedBooks.filter((b) => b.id === selectedBookId) : orderedBooks),
    [orderedBooks, selectedBookId],
  );

  const selectedBookName = selectedBookId
    ? bookOptions.find((b) => b.id === selectedBookId)?.name
    : null;

  const selectedSubjectLabel = subjectFilterId
    ? subjectCatalog.find((s) => s.id === subjectFilterId)?.label
    : null;

  function toggleBookMenu() {
    setBookMenuOpen((v) => !v);
  }

  function selectBook(bookId: string | null) {
    setSelectedBookId(bookId);
    setBookMenuOpen(false);
  }

  function openBook(bookId: string) {
    setLastReadBookId(bookId);
    router.push(bookDetailHref(bookId));
  }

  if (!canAccess('BOOKS') && !loading) {
    return (
      <View style={styles.root}>
        <BookError message={error || 'You do not have access to Books & Tools.'} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by title or tag..."
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            onSubmitEditing={onSearch}
          />
        </View>
        <Pressable style={styles.searchBtn} onPress={onSearch}>
          <Text style={styles.searchBtnText}>Search</Text>
        </Pressable>
        <Pressable
          style={[styles.moreIconBtn, bookMenuOpen && styles.moreIconBtnActive]}
          onPress={toggleBookMenu}
          hitSlop={8}
          accessibilityLabel="Books and tools list"
        >
          <Ionicons
            name="ellipsis-vertical"
            size={20}
            color={bookMenuOpen ? colors.white : colors.primary}
          />
        </Pressable>
      </View>

      {subjectCatalog.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subjectChips}
        >
          <Pressable
            style={[styles.chip, !subjectFilterId && styles.chipActive]}
            onPress={() => setSubjectFilterId('')}
          >
            <Text style={[styles.chipText, !subjectFilterId && styles.chipTextActive]}>All subjects</Text>
          </Pressable>
          {subjectCatalog.map((s) => {
            const active = subjectFilterId === s.id;
            return (
              <Pressable
                key={s.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSubjectFilterId(s.id)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {bookMenuOpen ? (
        <View style={styles.bookMenu}>
          <Text style={styles.bookMenuTitle}>Books &amp; Tools</Text>
          <Text style={styles.bookMenuSub}>
            {selectedSubjectLabel
              ? `Sorted for ${selectedSubjectLabel}`
              : 'Ordered by subject sort · your allowed subjects only'}
          </Text>
          <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }} contentContainerStyle={styles.bookMenuList}>
            <Pressable
              style={[styles.bookMenuItem, !selectedBookId && styles.bookMenuItemActive]}
              onPress={() => selectBook(null)}
            >
              <Text
                style={[styles.bookMenuItemText, !selectedBookId && styles.bookMenuItemTextActive]}
              >
                All books
              </Text>
              <Text style={styles.bookMenuCount}>{books.length}</Text>
            </Pressable>
            {bookOptions.length === 0 ? (
              <Text style={styles.bookMenuEmpty}>No books for your subjects yet.</Text>
            ) : (
              bookOptions.map((book) => {
                const active = selectedBookId === book.id;
                return (
                  <Pressable
                    key={book.id}
                    style={[styles.bookMenuItem, active && styles.bookMenuItemActive]}
                    onPress={() => selectBook(book.id)}
                  >
                    <Text
                      style={[styles.bookMenuItemText, active && styles.bookMenuItemTextActive]}
                      numberOfLines={2}
                    >
                      {book.name}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      ) : null}

      {selectedBookName || selectedSubjectLabel ? (
        <View style={styles.filterChipRow}>
          {selectedSubjectLabel ? (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText} numberOfLines={1}>
                {selectedSubjectLabel}
              </Text>
              <Pressable
                onPress={() => setSubjectFilterId('')}
                hitSlop={8}
                accessibilityLabel="Clear subject filter"
              >
                <Ionicons name="close-circle" size={16} color={colors.primary} />
              </Pressable>
            </View>
          ) : null}
          {selectedBookName ? (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText} numberOfLines={1}>
                {selectedBookName}
              </Text>
              <Pressable onPress={() => selectBook(null)} hitSlop={8} accessibilityLabel="Clear book filter">
                <Ionicons name="close-circle" size={16} color={colors.primary} />
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {loading && books.length === 0 ? (
        <BookLoading />
      ) : error ? (
        <BookError message={error} />
      ) : (
        <FlatList
          data={visibleBooks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <BookEmpty
              title={selectedBookId ? 'No book in this filter' : 'No books found'}
              subtitle={
                selectedBookId
                  ? 'Pick another book from the ⋮ menu.'
                  : subjectFilterId
                    ? 'No books linked to this subject for your account.'
                    : 'No books are available for your allowed subjects yet.'
              }
            />
          }
          renderItem={({ item }) => (
            <BookCard
              book={item}
              isLastRead={item.id === lastReadBookId}
              onPress={() => openBook(item.id)}
              saved={isSaved(item.id, 'book')}
              onToggleSave={() =>
                void toggle({
                  id: item.id,
                  kind: 'book',
                  title: item.name,
                  subtitle: item.short_name || item.book_type_name,
                })
              }
            />
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
  toolbar: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  searchRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  searchBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  searchBtnText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  moreIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 0,
  },
  moreIconBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  subjectChips: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: 8,
  },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: 220,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  chipTextActive: {
    color: colors.white,
  },
  bookMenu: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    maxHeight: 280,
  },
  bookMenuTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  bookMenuSub: {
    fontSize: 12,
    color: colors.textMuted,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  bookMenuList: {
    gap: 2,
  },
  bookMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  bookMenuItemActive: {
    backgroundColor: '#e8f3fa',
  },
  bookMenuItemText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  bookMenuItemTextActive: {
    color: colors.primary,
  },
  bookMenuCount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  bookMenuEmpty: {
    padding: 12,
    fontSize: 13,
    color: colors.textMuted,
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  filterChip: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e8f3fa',
    borderRadius: 999,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
  },
  filterChipText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  list: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
});
