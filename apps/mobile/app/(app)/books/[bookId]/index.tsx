import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BookBadge } from '@/components/books/BookBadge';
import { BookContentsFull } from '@/components/books/BookContentsFull';
import { BookRichText } from '@/components/books/BookRichText';
import {
  BookViewModeToggle,
  type BookContentsViewMode,
} from '@/components/books/BookViewModeToggle';
import {
  ChapterQuestionsButton,
  ChapterQuestionsPanel,
} from '@/components/books/ChapterQuestionsPanel';
import { useBookReader } from '@/components/books/BookReaderContext';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { bookNavTitle, chapterHeading, ruleHeading, stripHtml } from '@/lib/book-display';
import { bookChapterHref, bookRuleHref } from '@/lib/book-routes';
import { saveLastReadBookId } from '@/lib/last-read-book';
import type { ReaderChapter, ReaderChapterFull, ReaderTopicFull } from '@/types/books';
import { colors, spacing } from '@/theme';

const viewModeByBook = new Map<string, BookContentsViewMode>();

function matchesQuery(text: string | undefined | null, q: string) {
  if (!q) return true;
  return stripHtml(text ?? '').toLowerCase().includes(q);
}

function topicMatchesShort(
  topic: { rule_number: string; name?: string; sub_name?: string },
  q: string,
) {
  return (
    matchesQuery(ruleHeading(topic), q) ||
    matchesQuery(topic.rule_number, q) ||
    matchesQuery(topic.name, q) ||
    matchesQuery(topic.sub_name, q)
  );
}

function topicMatchesFull(topic: ReaderTopicFull, q: string) {
  if (topicMatchesShort(topic, q)) return true;
  if (matchesQuery(topic.description, q) || matchesQuery(topic.note, q)) return true;
  if ((topic.details ?? []).some((d) => matchesQuery(d.detail_text, q))) return true;
  return (topic.sub_topics ?? []).some(
    (sub) =>
      matchesQuery(sub.name, q) ||
      matchesQuery(sub.rule_number, q) ||
      matchesQuery(sub.description, q) ||
      matchesQuery(sub.note, q),
  );
}

function filterShortChapters(chapters: ReaderChapter[], q: string) {
  if (!q) return chapters;
  return chapters
    .map((chapter) => ({
      ...chapter,
      topics: chapter.topics.filter((topic) => topicMatchesShort(topic, q)),
    }))
    .filter(
      (chapter) =>
        matchesQuery(chapterHeading(chapter), q) ||
        matchesQuery(chapter.chapter_number, q) ||
        matchesQuery(chapter.name, q) ||
        matchesQuery(chapter.sub_name, q) ||
        matchesQuery(chapter.description, q) ||
        chapter.topics.length > 0,
    );
}

function filterFullChapters(chapters: ReaderChapterFull[], q: string) {
  if (!q) return chapters;
  return chapters
    .map((chapter) => ({
      ...chapter,
      topics: chapter.topics.filter((topic) => topicMatchesFull(topic, q)),
    }))
    .filter(
      (chapter) =>
        matchesQuery(chapterHeading(chapter), q) ||
        matchesQuery(chapter.chapter_number, q) ||
        matchesQuery(chapter.name, q) ||
        matchesQuery(chapter.sub_name, q) ||
        matchesQuery(chapter.description, q) ||
        chapter.topics.length > 0,
    );
}

export default function BookDetailScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { bookId, from } = useLocalSearchParams<{ bookId: string; from?: string }>();
  const fromSaved = from === 'saved';
  const { outline, fullChapters, loading, fullLoading, error, fullError } = useBookReader();
  const bookName = outline?.book.name || outline?.book.short_name;
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<BookContentsViewMode>(
    () => viewModeByBook.get(bookId) ?? 'full',
  );
  const [showBookQuestions, setShowBookQuestions] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerBackTitle: fromSaved ? 'Books' : 'Library',
      title: loading ? ' ' : outline?.book.name ? bookNavTitle(outline.book.name) : ' ',
      headerLeft: fromSaved
        ? () => (
            <Pressable
              onPress={() => router.replace('/(app)/saved/books' as Href)}
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, gap: 2 }}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={28} color={colors.white} />
              <Text style={{ color: colors.white, fontSize: 17 }}>Books</Text>
            </Pressable>
          )
        : undefined,
    });
  }, [navigation, loading, outline?.book.name, fromSaved, router]);

  useEffect(() => {
    setDetailsExpanded(false);
    setViewMode(viewModeByBook.get(bookId) ?? 'full');
    setShowBookQuestions(false);
    setSearchDraft('');
    setSearchQuery('');
    setSearchOpen(false);
    if (bookId) void saveLastReadBookId(bookId);
  }, [bookId]);

  function handleViewModeChange(mode: BookContentsViewMode) {
    setViewMode(mode);
    viewModeByBook.set(bookId, mode);
  }

  function openSearch() {
    setSearchOpen(true);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }

  function closeSearch() {
    searchInputRef.current?.blur();
    setSearchOpen(false);
    setSearchDraft('');
    setSearchQuery('');
  }

  function applySearch() {
    const next = searchDraft.trim();
    setSearchQuery(next);
    if (next) {
      setViewMode('full');
      viewModeByBook.set(bookId, 'full');
    }
  }

  function onSearchIconPress() {
    if (!searchOpen) {
      openSearch();
      return;
    }
    applySearch();
  }

  const displayFullChapters = useMemo(() => {
    if (!fullChapters || !outline) return [];
    return fullChapters.map((chapter) => {
      const fromOutline = outline.chapters.find((c) => c.id === chapter.id);
      return {
        ...chapter,
        description: chapter.description?.trim() ? chapter.description : fromOutline?.description,
        sub_name: chapter.sub_name?.trim() ? chapter.sub_name : fromOutline?.sub_name,
      };
    });
  }, [fullChapters, outline]);

  const q = searchQuery.trim().toLowerCase();

  const filteredShortChapters = useMemo(
    () => (outline ? filterShortChapters(outline.chapters, q) : []),
    [outline, q],
  );

  const filteredFullChapters = useMemo(
    () => filterFullChapters(displayFullChapters, q),
    [displayFullChapters, q],
  );

  if (loading && !outline) return <BookLoading />;
  if (error && !outline) return <BookError message={error} />;
  if (!outline) return <BookEmpty title="Book not found" />;

  const { book } = outline;
  const descriptionPlain = stripHtml(book.description);
  const hasDescription = descriptionPlain.length > 0;
  const showFullLoading = viewMode === 'full' && (fullChapters === null || fullLoading);
  const activeViewMode = q ? 'full' : viewMode;

  return (
    <>
      <View style={styles.root}>
        <View style={styles.toolbar}>
          {searchOpen ? (
            <View style={styles.toolbarMain}>
              <View style={styles.searchField}>
                <TextInput
                  ref={searchInputRef}
                  style={styles.searchInput}
                  value={searchDraft}
                  onChangeText={setSearchDraft}
                  placeholder="Search…"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="search"
                  onSubmitEditing={applySearch}
                  autoFocus
                />
                <Pressable onPress={closeSearch} hitSlop={10} accessibilityLabel="Close search">
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.toolbarMain}>
              <BookViewModeToggle compact value={viewMode} onChange={handleViewModeChange} />
            </View>
          )}

          <Pressable
            style={styles.searchIconBtn}
            onPress={onSearchIconPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={searchOpen ? 'Search book' : 'Open search'}
          >
            <View style={styles.searchIconInner}>
              <Ionicons name="search" size={20} color={colors.primary} />
            </View>
          </Pressable>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <Text style={styles.title}>{book.name}</Text>

          <View style={styles.badges}>
            {book.short_name ? <BookBadge label={book.short_name} /> : null}
            {book.edition ? <BookBadge label={`Edition ${book.edition}`} variant="muted" /> : null}
            {book.language ? <BookBadge label={book.language} variant="muted" /> : null}
            {book.book_type_name ? <BookBadge label={book.book_type_name} variant="muted" /> : null}
          </View>

          <ChapterQuestionsButton fullWidth onPress={() => setShowBookQuestions(true)} />

          {hasDescription ? (
            <View style={styles.panel}>
              {detailsExpanded ? (
                <>
                  <BookRichText html={book.description} />
                  <Pressable style={styles.detailsBtn} onPress={() => setDetailsExpanded(false)}>
                    <Text style={styles.detailsBtnText}>Hide details</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.descriptionPreview} numberOfLines={2}>
                    {descriptionPlain}
                  </Text>
                  <Pressable style={styles.detailsBtn} onPress={() => setDetailsExpanded(true)}>
                    <Text style={styles.detailsBtnText}>Details</Text>
                  </Pressable>
                </>
              )}
            </View>
          ) : null}

          {q ? (
            <Text style={styles.searchMeta}>
              Showing results for “{searchQuery}” · {filteredFullChapters.length} chapter
              {filteredFullChapters.length === 1 ? '' : 's'}
            </Text>
          ) : null}

          {activeViewMode === 'full' ? (
            <>
              {fullError ? <Text style={styles.errorText}>{fullError}</Text> : null}
              <BookContentsFull chapters={filteredFullChapters} loading={showFullLoading} />
            </>
          ) : (
            <>
              {filteredShortChapters.length === 0 ? (
                <BookEmpty
                  title={q ? 'No matches found' : 'No chapters yet'}
                  subtitle={q ? 'Try a different search term.' : undefined}
                />
              ) : (
                filteredShortChapters.map((chapter) => (
                  <View key={chapter.id} style={styles.chapterBlock}>
                    <View style={styles.chapterHeader}>
                      <Pressable
                        style={({ pressed }) => [styles.chapterRow, pressed && styles.pressed]}
                        onPress={() => router.push(bookChapterHref(bookId, chapter.id))}
                      >
                        <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                        <View style={styles.chapterText}>
                          <Text style={styles.chapterTitle}>{chapterHeading(chapter)}</Text>
                          {chapter.sub_name?.trim() ? (
                            <Text style={styles.chapterSub}>{chapter.sub_name}</Text>
                          ) : null}
                        </View>
                      </Pressable>
                    </View>

                    {chapter.topics.length > 0 ? (
                      <View style={styles.rulesList}>
                        {chapter.topics.map((topic) => (
                          <Pressable
                            key={topic.id}
                            style={({ pressed }) => [styles.ruleRow, pressed && styles.pressed]}
                            onPress={() => router.push(bookRuleHref(bookId, topic.id))}
                          >
                            <Text style={styles.ruleText}>{ruleHeading(topic)}</Text>
                            {topic.is_amended ? (
                              <BookBadge label="Amended" variant="warning" />
                            ) : null}
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      </View>

      <ChapterQuestionsPanel
        bookId={bookId}
        bookName={bookName}
        open={showBookQuestions}
        onClose={() => setShowBookQuestions(false)}
      />
    </>
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
    gap: spacing.sm,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  searchIconBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 3,
    flexShrink: 0,
  },
  searchIconInner: {
    minWidth: 34,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  toolbarMain: {
    flex: 1,
    minWidth: 0,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    minHeight: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: spacing.sm,
    minWidth: 0,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'justify',
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  descriptionPreview: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    textAlign: 'justify',
  },
  detailsBtn: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  detailsBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  searchMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
  },
  chapterBlock: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingRight: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chapterRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
  },
  chapterText: {
    flex: 1,
    gap: 2,
  },
  chapterTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'justify',
  },
  chapterSub: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'justify',
  },
  rulesList: {
    paddingLeft: spacing.lg,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
    gap: 4,
  },
  ruleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  ruleText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
    textAlign: 'justify',
  },
  pressed: {
    opacity: 0.85,
  },
});
