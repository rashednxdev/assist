import { View, Text, StyleSheet } from 'react-native';
import { BookBadge } from '@/components/books/BookBadge';
import { BookRichText } from '@/components/books/BookRichText';
import { RuleContentLinkButton } from '@/components/books/RuleContentLinkButton';
import { TopicComparisonTable } from '@/components/books/TopicComparisonTable';
import { ProcessFlowPreview } from '@/components/books/ProcessFlowPreview';
import { BookEmpty, BookLoading } from '@/components/books/BookStates';
import { cleanBookLabel, ruleHeading, subRuleHeading } from '@/lib/book-display';
import type { ReaderChapterFull } from '@/types/books';
import { colors, spacing } from '@/theme';

export function BookContentsFull({
  chapters,
  loading,
}: {
  chapters: ReaderChapterFull[];
  loading: boolean;
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
          </View>

          {(chapter.topics ?? []).map((topic) => {
            const hasRuleHeading = Boolean(topic.rule_number?.trim() || topic.name?.trim());
            return (
            <View key={topic.id} style={styles.rulePanel}>
              <View style={styles.ruleHeader}>
                {hasRuleHeading ? <Text style={styles.ruleTitle}>{ruleHeading(topic)}</Text> : null}
                {topic.is_amended ? <BookBadge label="Amended" variant="warning" /> : null}
              </View>

              {topic.sub_name?.trim() ? (
                <Text style={styles.plainText}>{topic.sub_name.trim()}</Text>
              ) : null}

              {topic.description?.trim() ? <BookRichText html={topic.description} /> : null}

              {topic.note?.trim() ? <BookRichText html={topic.note} /> : null}

              <RuleContentLinkButton contentLink={topic.content_link} title={ruleHeading(topic)} />

              <TopicComparisonTable table={topic.table} title={ruleHeading(topic)} />

              {(topic.processes ?? []).map((p) => (
                <View key={p.id} style={styles.processPanel}>
                  <Text style={styles.processTitle}>{p.title}</Text>
                  {p.details?.trim() ? <BookRichText html={p.details} /> : null}
                  <View style={styles.processSteps}>
                    <ProcessFlowPreview steps={p.steps} />
                  </View>
                </View>
              ))}

              {(topic.details ?? []).map((d) => (
                <View key={d.id} style={styles.detailBlock}>
                  <BookRichText html={d.detail_text} />
                </View>
              ))}

              {(topic.sub_topics ?? []).map((sub) => {
                const hasSubHeading = Boolean(sub.rule_number?.trim() || sub.name?.trim());
                return (
                  <View key={sub.id} style={styles.subRulePanel}>
                    {hasSubHeading ? (
                      <Text style={styles.subRuleTitle}>{subRuleHeading(sub)}</Text>
                    ) : null}
                    {sub.description?.trim() ? <BookRichText html={sub.description} /> : null}
                    {sub.note?.trim() ? <BookRichText html={sub.note} /> : null}
                  </View>
                );
              })}
            </View>
            );
          })}
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
  processPanel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
    gap: 4,
  },
  processTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'justify',
  },
  processSteps: {
    marginTop: spacing.xs,
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
