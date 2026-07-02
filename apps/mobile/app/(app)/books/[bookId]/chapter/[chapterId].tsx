import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { BookBadge } from '@/components/books/BookBadge';
import { HtmlContent } from '@/components/books/HtmlContent';
import { useBookReader } from '@/components/books/BookReaderContext';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { chapterHeading, ruleHeading } from '@/lib/book-display';
import { bookRuleHref } from '@/lib/book-routes';
import { fetchChapterQuestions } from '@/lib/books-api';
import type { ChapterQuestionBrief } from '@/types/books';
import { colors, spacing } from '@/theme';

export default function BookChapterScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { bookId, chapterId } = useLocalSearchParams<{ bookId: string; chapterId: string }>();
  const { outline, loading, error, getChapter } = useBookReader();
  const chapter = getChapter(chapterId);
  const [questions, setQuestions] = useState<ChapterQuestionBrief[]>([]);
  const [questionsOpen, setQuestionsOpen] = useState(false);

  const loadQuestions = useCallback(async () => {
    if (!chapterId) return;
    try {
      const data = await fetchChapterQuestions(chapterId);
      setQuestions(data);
    } catch {
      setQuestions([]);
    }
  }, [chapterId]);

  useEffect(() => {
    if (chapter) {
      navigation.setOptions({ title: chapterHeading(chapter) });
    }
  }, [chapter, navigation]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  if (loading) return <BookLoading />;
  if (error) return <BookError message={error} />;

  if (!chapter) {
    return <BookEmpty title="Chapter not found" />;
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.panel}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{chapterHeading(chapter)}</Text>
            {chapter.sub_name?.trim() ? (
              <Text style={styles.subtitle}>{chapter.sub_name}</Text>
            ) : null}
          </View>
          <Pressable
            style={[styles.tagBtn, questionsOpen && styles.tagBtnActive]}
            onPress={() => setQuestionsOpen((v) => !v)}
          >
            <Text style={[styles.tagBtnText, questionsOpen && styles.tagBtnTextActive]}>
              Questions ({questions.length})
            </Text>
          </Pressable>
        </View>
        {chapter.description?.trim() ? (
          <View style={styles.htmlWrap}>
            <HtmlContent html={chapter.description} />
          </View>
        ) : null}
      </View>

      {questionsOpen && (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Tagged questions</Text>
          {questions.length === 0 ? (
            <Text style={styles.muted}>No published questions linked to this chapter.</Text>
          ) : (
            questions.map((q) => (
              <View key={q.id} style={styles.questionRow}>
                <Text style={styles.questionBody}>{q.body_en || q.body_bn}</Text>
                <View style={styles.questionMeta}>
                  <BookBadge label={q.question_type_code} variant="muted" />
                  <BookBadge label={`${q.marks} marks`} variant="muted" />
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {chapter.topics.length > 0 && (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Rules</Text>
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
    gap: spacing.sm,
  },
  headerText: {
    gap: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
  },
  tagBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tagBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tagBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  tagBtnTextActive: {
    color: colors.white,
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
  muted: {
    fontSize: 14,
    color: colors.textMuted,
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
  },
  questionRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 6,
  },
  questionBody: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  questionMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pressed: {
    opacity: 0.85,
  },
});
