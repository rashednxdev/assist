import { View, Text, StyleSheet } from 'react-native';
import { BookBadge } from '@/components/books/BookBadge';
import { BookRichText } from '@/components/books/BookRichText';
import { ChapterQuestionsButton } from '@/components/books/ChapterQuestionsPanel';
import { RuleContentLinkButton } from '@/components/books/RuleContentLinkButton';
import { BookEmpty, BookLoading } from '@/components/books/BookStates';
import { cleanBookLabel, ruleHeading, subRuleHeading } from '@/lib/book-display';
import type { ReaderChapter, ReaderChapterFull } from '@/types/books';
import { colors, spacing } from '@/theme';

export function BookContentsFull({
  chapters,
  loading,
  onOpenQuestions,
}: {
  chapters: ReaderChapterFull[];
  loading: boolean;
  onOpenQuestions: (chapter: ReaderChapter) => void;
}) {
  if (loading) return <BookLoading />;

  if (chapters.length === 0) {
    return <BookEmpty title="No chapters in this book yet." />;
  }

  return (
    <View style={styles.article}>
      {chapters.map((chapter) => (
        <View key={chapter.id} style={styles.chapterPanel}>
          {chapter.description?.trim() ? (
            <View style={styles.chapterBody}>
              <BookRichText html={chapter.description} />
            </View>
          ) : null}

          <View
            style={[styles.chapterHeader, chapter.description?.trim() && styles.chapterHeaderBorder]}
          >
            <View style={styles.chapterTitleBlock}>
              {cleanBookLabel(chapter.chapter_number) ? (
                <Text style={styles.chapterNumber}>{cleanBookLabel(chapter.chapter_number)}</Text>
              ) : null}
              <Text style={styles.chapterTitle}>
                {cleanBookLabel(chapter.name) || chapter.name.trim()}
              </Text>
              {chapter.sub_name?.trim() ? (
                <Text style={styles.chapterSubName}>{chapter.sub_name}</Text>
              ) : null}
            </View>
            <ChapterQuestionsButton onPress={() => onOpenQuestions(chapter)} />
          </View>

          {(chapter.topics ?? []).map((topic) => (
            <View key={topic.id} style={styles.rulePanel}>
              <View style={styles.ruleHeader}>
                <Text style={styles.ruleTitle}>{ruleHeading(topic)}</Text>
                {topic.is_amended ? <BookBadge label="Amended" variant="warning" /> : null}
              </View>

              {topic.sub_name?.trim() ? (
                <Text style={styles.plainText}>{topic.sub_name.trim()}</Text>
              ) : null}

              {topic.description?.trim() ? <BookRichText html={topic.description} /> : null}

              {topic.note?.trim() ? <BookRichText html={topic.note} /> : null}

              <RuleContentLinkButton contentLink={topic.content_link} title={ruleHeading(topic)} />

              {(topic.details ?? []).map((d) => (
                <View key={d.id} style={styles.detailBlock}>
                  <BookRichText html={d.detail_text} />
                </View>
              ))}

              {(topic.sub_topics ?? []).map((sub) => (
                <View key={sub.id} style={styles.subRulePanel}>
                  <Text style={styles.subRuleTitle}>{subRuleHeading(sub)}</Text>
                  {sub.description?.trim() ? <BookRichText html={sub.description} /> : null}
                  {sub.note?.trim() ? <BookRichText html={sub.note} /> : null}
                </View>
              ))}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  article: {
    gap: spacing.lg,
  },
  chapterPanel: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  chapterBody: {
    gap: spacing.sm,
  },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  chapterHeaderBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  chapterTitleBlock: {
    flex: 1,
    gap: 4,
  },
  chapterNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  chapterTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'justify',
  },
  chapterSubName: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'justify',
  },
  rulePanel: {
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  ruleHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  ruleTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'justify',
  },
  plainText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.textMuted,
    textAlign: 'justify',
  },
  detailBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  subRulePanel: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  subRuleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'justify',
  },
});
