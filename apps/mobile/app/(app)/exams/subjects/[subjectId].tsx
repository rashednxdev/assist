import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { BookBadge } from '@/components/books/BookBadge';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { fetchSubjectSyllabusTree } from '@/lib/exams-api';
import { bookChapterHref, bookDetailHref, bookRuleHref, regulationDetailHref } from '@/lib/book-routes';
import type { SubjectSyllabusTree, SyllabusReference, SyllabusTopic } from '@/types/exams';
import { colors, spacing } from '@/theme';

function referenceLabel(ref: SyllabusReference) {
  const parts = [ref.book_short_name];
  if (ref.chapter_number) parts.push(`Ch. ${ref.chapter_number}`);
  if (ref.rule_number) parts.push(`Rule ${ref.rule_number}`);
  if (ref.regulation_no) parts.push(ref.regulation_no);
  return parts.filter(Boolean).join(' · ');
}

function referenceHref(ref: SyllabusReference) {
  if (ref.regulation_id) return regulationDetailHref(ref.regulation_id);
  if (ref.book_info_id && ref.book_topic_id) return bookRuleHref(ref.book_info_id, ref.book_topic_id);
  if (ref.book_info_id && ref.book_chapter_id) return bookChapterHref(ref.book_info_id, ref.book_chapter_id);
  if (ref.book_info_id) return bookDetailHref(ref.book_info_id);
  return null;
}

function TopicCard({ topic }: { topic: SyllabusTopic }) {
  const router = useRouter();

  return (
    <View style={styles.topicCard}>
      <View style={styles.topicHeader}>
        <Text style={styles.topicName}>{topic.name}</Text>
        {topic.marks_weightage != null ? (
          <BookBadge label={`${topic.marks_weightage} marks`} variant="muted" />
        ) : null}
      </View>

      {topic.description?.trim() ? <Text style={styles.topicDesc}>{topic.description}</Text> : null}

      {topic.sub_topics.length > 0 && (
        <View style={styles.subSection}>
          <Text style={styles.subTitle}>Sub-topics</Text>
          {topic.sub_topics.map((sub) => (
            <View key={sub.id} style={styles.subTopicRow}>
              <Text style={styles.subTopicName}>{sub.name}</Text>
              {sub.description?.trim() ? <Text style={styles.subTopicDesc}>{sub.description}</Text> : null}
            </View>
          ))}
        </View>
      )}

      <View style={styles.subSection}>
        <Text style={styles.subTitle}>References</Text>
        {topic.references.length === 0 ? (
          <Text style={styles.muted}>No references linked yet.</Text>
        ) : (
          topic.references.map((ref) => (
            <Pressable
              key={ref.id}
              style={({ pressed }) => [styles.refRow, pressed && styles.pressed]}
              onPress={() => {
                const href = referenceHref(ref);
                if (href) router.push(href);
              }}
            >
              <View style={styles.refTop}>
                <BookBadge label={ref.ref_level ?? 'reference'} variant="muted" />
                {ref.regulation_title ? <Text style={styles.refTitle}>{ref.regulation_title}</Text> : null}
              </View>
              <Text style={styles.refLabel}>{referenceLabel(ref) || 'Book reference'}</Text>
              {ref.relevance_note?.trim() ? <Text style={styles.refNote}>{ref.relevance_note}</Text> : null}
            </Pressable>
          ))
        )}
      </View>
    </View>
  );
}

export default function SubjectSyllabusScreen() {
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const navigation = useNavigation();
  const [tree, setTree] = useState<SubjectSyllabusTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!subjectId) return;
    setLoading(true);
    fetchSubjectSyllabusTree(subjectId)
      .then((data) => {
        setTree(data);
        navigation.setOptions({ title: 'Syllabus & References' });
      })
      .catch((err) => {
        setTree(null);
        setError(err instanceof Error ? err.message : 'Failed to load syllabus');
      })
      .finally(() => setLoading(false));
  }, [subjectId, navigation]);

  const groupedCount = useMemo(() => tree?.groups.length ?? 0, [tree?.groups.length]);
  const subjectTopicCount = useMemo(() => tree?.subject_topics.length ?? 0, [tree?.subject_topics.length]);

  if (loading) return <BookLoading />;
  if (error) return <BookError message={error} />;
  if (!tree) return <BookEmpty title="Syllabus not found" />;

  if (groupedCount === 0 && subjectTopicCount === 0) {
    return <BookEmpty title="No syllabus topics" subtitle="This subject has no syllabus configured yet." />;
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {tree.groups.map((group) => (
        <View key={group.id} style={styles.groupCard}>
          <View style={styles.groupHead}>
            <Text style={styles.groupTitle}>{group.name}</Text>
            <BookBadge label={`${group.marks_allocated} marks`} variant="muted" />
          </View>
          {group.topics.length === 0 ? (
            <Text style={styles.muted}>No topics in this group.</Text>
          ) : (
            group.topics.map((topic) => <TopicCard key={topic.id} topic={topic} />)
          )}
        </View>
      ))}

      {tree.subject_topics.length > 0 && (
        <View style={styles.groupCard}>
          <Text style={styles.groupTitle}>Subject Topics</Text>
          {tree.subject_topics.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
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
  groupCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.sm,
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  groupTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  topicCard: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  topicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  topicName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  topicDesc: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  subSection: {
    gap: 6,
  },
  subTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  subTopicRow: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  subTopicName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  subTopicDesc: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },
  refRow: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  refTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refTitle: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
  },
  refLabel: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  refNote: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },
  muted: {
    fontSize: 13,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.9,
  },
});
