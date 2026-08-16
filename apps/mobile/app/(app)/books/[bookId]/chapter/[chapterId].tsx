import { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { BookBadge } from '@/components/books/BookBadge';
import { BookRichText } from '@/components/books/BookRichText';
import {
  ChapterQuestionsButton,
  ChapterQuestionsPanel,
} from '@/components/books/ChapterQuestionsPanel';
import { useBookReader } from '@/components/books/BookReaderContext';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { chapterHeading, chapterNameForMarkup, cleanBookLabel, ruleHeading } from '@/lib/book-display';
import { bookRuleHref } from '@/lib/book-routes';
import { colors, spacing } from '@/theme';

export default function BookChapterScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { bookId, chapterId } = useLocalSearchParams<{ bookId: string; chapterId: string }>();
  const { loading, error, getChapter, outline } = useBookReader();
  const bookName = outline?.book.name || outline?.book.short_name;
  const chapter = getChapter(chapterId);
  const [questionsOpen, setQuestionsOpen] = useState(false);

  useEffect(() => {
    if (chapter) {
      navigation.setOptions({ title: chapterHeading(chapter) });
    }
  }, [chapter, navigation]);

  if (loading) return <BookLoading />;
  if (error) return <BookError message={error} />;

  if (!chapter) {
    return <BookEmpty title="Chapter not found" />;
  }

  const chapterNum = cleanBookLabel(chapter.chapter_number);
  const chapterName = chapterNameForMarkup(chapter);

  return (
    <>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <View style={styles.panel}>
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              {chapterNum ? <Text style={styles.title}>{chapterNum}</Text> : null}
              {chapterName ? <BookRichText html={chapterName} style={styles.title} /> : null}
              {chapter.sub_name?.trim() ? (
                <Text style={styles.subtitle}>{chapter.sub_name}</Text>
              ) : null}
            </View>
            <ChapterQuestionsButton
              active={questionsOpen}
              onPress={() => setQuestionsOpen((v) => !v)}
            />
          </View>
          {chapter.description?.trim() ? (
            <View style={styles.htmlWrap}>
              <BookRichText html={chapter.description} />
            </View>
          ) : null}
        </View>

        {chapter.topics.length > 0 && (
          <View style={styles.panel}>
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
        )}
      </ScrollView>

      <ChapterQuestionsPanel
        chapterId={chapterId}
        chapterTitle={chapterHeading(chapter)}
        bookName={bookName}
        open={questionsOpen}
        onClose={() => setQuestionsOpen(false)}
      />
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
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'justify',
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'justify',
  },
  htmlWrap: {
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ruleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  ruleText: {
    flex: 1,
    fontSize: 15,
    color: colors.primary,
    fontWeight: '500',
    textAlign: 'justify',
  },
  pressed: {
    opacity: 0.85,
  },
});
