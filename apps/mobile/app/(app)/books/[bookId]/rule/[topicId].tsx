import { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BookBadge } from '@/components/books/BookBadge';
import { HtmlContent } from '@/components/books/HtmlContent';
import { RuleContentLinkButton } from '@/components/books/RuleContentLinkButton';
import { useBookReader } from '@/components/books/BookReaderContext';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { chapterHeading, ruleHeading, subRuleHeading } from '@/lib/book-display';
import { bookChapterHref, bookRuleHref, regulationDetailHref } from '@/lib/book-routes';
import { fetchTopicDetail } from '@/lib/books-api';
import type { TopicDetail } from '@/types/books';
import { colors, spacing } from '@/theme';

export default function BookRuleScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { bookId, topicId } = useLocalSearchParams<{ bookId: string; topicId: string }>();
  const { loading: outlineLoading, error: outlineError, getRuleNav, getAdjacentRules } =
    useBookReader();
  const [topic, setTopic] = useState<TopicDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const ruleNav = getRuleNav(topicId);
  const { prev, next } = getAdjacentRules(topicId);
  const chapterId = ruleNav?.chapter_id ?? topic?.chapter?.id;

  useEffect(() => {
    setLoading(true);
    fetchTopicDetail(topicId)
      .then(setTopic)
      .catch(() => setTopic(null))
      .finally(() => setLoading(false));
  }, [topicId]);

  useEffect(() => {
    if (topic) {
      navigation.setOptions({ title: ruleHeading(topic) });
    }
  }, [topic, navigation]);

  if (outlineLoading || loading) return <BookLoading />;
  if (outlineError) return <BookError message={outlineError} />;
  if (!topic) return <BookEmpty title="Rule not found" />;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {chapterId ? (
        <Pressable
          style={styles.chapterLink}
          onPress={() => router.push(bookChapterHref(bookId, chapterId))}
        >
          <Text style={styles.chapterLinkText}>
            {topic.chapter
              ? chapterHeading({
                  chapter_number: topic.chapter.chapter_number,
                  name: topic.chapter.name,
                })
              : 'View chapter'}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.panel}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{ruleHeading(topic)}</Text>
          {topic.is_amended ? <BookBadge label="Amended" variant="warning" /> : null}
        </View>

        {topic.description?.trim() || topic.note?.trim() ? (
          <View style={styles.htmlWrap}>
            <HtmlContent html={topic.description} />
            {topic.note?.trim() ? (
              <View style={styles.noteBox}>
                <Text style={styles.noteLabel}>Note</Text>
                <HtmlContent html={topic.note} />
              </View>
            ) : null}
          </View>
        ) : null}

        <RuleContentLinkButton contentLink={topic.content_link} title={ruleHeading(topic)} />

        {topic.details.map((d) => (
          <View key={d.id} style={styles.detailBlock}>
            <HtmlContent html={d.detail_text} />
          </View>
        ))}

        {topic.sub_topics.length > 0 && (
          <View style={styles.subSection}>
            <Text style={styles.sectionTitle}>Sub-rules</Text>
            {topic.sub_topics.map((st) => (
              <View key={st.id} style={styles.subRuleCard}>
                <Text style={styles.subRuleTitle}>{subRuleHeading(st)}</Text>
                {st.description?.trim() ? <HtmlContent html={st.description} /> : null}
                {st.note?.trim() ? (
                  <View style={styles.noteBox}>
                    <Text style={styles.noteLabel}>Note</Text>
                    <HtmlContent html={st.note} />
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}

        {topic.regulations.length > 0 && (
          <View style={styles.subSection}>
            <Text style={styles.sectionTitle}>Linked regulations</Text>
            {topic.regulations.map((r) => (
              <Pressable
                key={r.id}
                style={({ pressed }) => [styles.regRow, pressed && styles.pressed]}
                onPress={() => router.push(regulationDetailHref(r.id))}
              >
                <Text style={styles.regText}>
                  {r.regulation_no} — {r.title}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={styles.navRow}>
        {prev ? (
          <Pressable
            style={styles.navBtn}
            onPress={() => router.push(bookRuleHref(bookId, prev.id))}
          >
            <Ionicons name="chevron-back" size={18} color={colors.primary} />
            <Text style={styles.navText} numberOfLines={2}>
              {ruleHeading(prev)}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.navSpacer} />
        )}
        {next ? (
          <Pressable
            style={[styles.navBtn, styles.navBtnNext]}
            onPress={() => router.push(bookRuleHref(bookId, next.id))}
          >
            <Text style={[styles.navText, styles.navTextRight]} numberOfLines={2}>
              {ruleHeading(next)}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </Pressable>
        ) : (
          <View style={styles.navSpacer} />
        )}
      </View>
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
  chapterLink: {
    alignSelf: 'flex-start',
  },
  chapterLinkText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  htmlWrap: {
    gap: spacing.sm,
  },
  noteBox: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.sm,
    gap: 4,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  detailBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  subSection: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  subRuleCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.sm,
    gap: 6,
  },
  subRuleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  regRow: {
    paddingVertical: 8,
  },
  regText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  navRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm,
  },
  navBtnNext: {
    justifyContent: 'flex-end',
  },
  navText: {
    flex: 1,
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  navTextRight: {
    textAlign: 'right',
  },
  navSpacer: {
    flex: 1,
  },
  pressed: {
    opacity: 0.85,
  },
});
