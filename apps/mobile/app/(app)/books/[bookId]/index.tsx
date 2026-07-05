import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BookBadge } from '@/components/books/BookBadge';
import { BookContentsFull } from '@/components/books/BookContentsFull';
import { HtmlContent } from '@/components/books/HtmlContent';
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
import type { ReaderChapter } from '@/types/books';
import { colors, spacing } from '@/theme';

const viewModeByBook = new Map<string, BookContentsViewMode>();

export default function BookDetailScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const { outline, fullChapters, loading, fullLoading, error, fullError } = useBookReader();
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<BookContentsViewMode>(
    () => viewModeByBook.get(bookId) ?? 'short',
  );
  const [questionsChapter, setQuestionsChapter] = useState<ReaderChapter | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerBackTitle: 'Library',
      title: loading ? ' ' : outline?.book.name ? bookNavTitle(outline.book.name) : ' ',
    });
  }, [navigation, loading, outline?.book.name]);

  useEffect(() => {
    setDetailsExpanded(false);
    setViewMode(viewModeByBook.get(bookId) ?? 'short');
    setQuestionsChapter(null);
  }, [bookId]);

  function handleViewModeChange(mode: BookContentsViewMode) {
    setViewMode(mode);
    viewModeByBook.set(bookId, mode);
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

  if (loading && !outline) return <BookLoading />;
  if (error && !outline) return <BookError message={error} />;
  if (!outline) return <BookEmpty title="Book not found" />;

  const { book, chapters } = outline;
  const descriptionPlain = stripHtml(book.description);
  const hasDescription = descriptionPlain.length > 0;
  const showFullLoading = viewMode === 'full' && (fullChapters === null || fullLoading);

  return (
    <>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{book.name}</Text>

        <View style={styles.badges}>
          {book.short_name ? <BookBadge label={book.short_name} /> : null}
          {book.edition ? <BookBadge label={`Edition ${book.edition}`} variant="muted" /> : null}
          {book.language ? <BookBadge label={book.language} variant="muted" /> : null}
          {book.book_type_name ? <BookBadge label={book.book_type_name} variant="muted" /> : null}
        </View>

        {hasDescription ? (
          <View style={styles.panel}>
            {detailsExpanded ? (
              <>
                <HtmlContent html={book.description} />
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

        <BookViewModeToggle value={viewMode} onChange={handleViewModeChange} />

        {viewMode === 'full' ? (
          <>
            {fullError ? <Text style={styles.errorText}>{fullError}</Text> : null}
            <BookContentsFull
              chapters={displayFullChapters}
              loading={showFullLoading}
              onOpenQuestions={setQuestionsChapter}
            />
          </>
        ) : (
          <>
            {chapters.length === 0 ? (
              <BookEmpty title="No chapters yet" />
            ) : (
              chapters.map((chapter) => (
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
                    <ChapterQuestionsButton onPress={() => setQuestionsChapter(chapter)} />
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
                          {topic.is_amended ? <BookBadge label="Amended" variant="warning" /> : null}
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

      {questionsChapter ? (
        <ChapterQuestionsPanel
          chapterId={questionsChapter.id}
          chapterTitle={chapterHeading(questionsChapter)}
          open={!!questionsChapter}
          onClose={() => setQuestionsChapter(null)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
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
  },
  chapterSub: {
    fontSize: 13,
    color: colors.textMuted,
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
  },
  pressed: {
    opacity: 0.85,
  },
});
