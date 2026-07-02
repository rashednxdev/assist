import { useEffect, useLayoutEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BookBadge } from '@/components/books/BookBadge';
import { HtmlContent } from '@/components/books/HtmlContent';
import { useBookReader } from '@/components/books/BookReaderContext';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { bookNavTitle, chapterHeading, ruleHeading, stripHtml } from '@/lib/book-display';
import { bookChapterHref, bookRuleHref } from '@/lib/book-routes';
import { colors, spacing } from '@/theme';

export default function BookDetailScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const { outline, loading, error } = useBookReader();
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerBackTitle: 'Library',
      title: loading ? ' ' : outline?.book.name ? bookNavTitle(outline.book.name) : ' ',
    });
  }, [navigation, loading, outline?.book.name]);

  useEffect(() => {
    setDetailsExpanded(false);
  }, [bookId]);

  if (loading) return <BookLoading />;
  if (error) return <BookError message={error} />;
  if (!outline) return <BookEmpty title="Book not found" />;

  const { book, chapters } = outline;
  const descriptionPlain = stripHtml(book.description);
  const hasDescription = descriptionPlain.length > 0;

  return (
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

      <Text style={styles.sectionTitle}>Table of contents</Text>

      {chapters.length === 0 ? (
        <BookEmpty title="No chapters yet" />
      ) : (
        chapters.map((chapter) => (
          <View key={chapter.id} style={styles.chapterBlock}>
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
    </ScrollView>
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
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.sm,
  },
  chapterBlock: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
