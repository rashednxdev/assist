import { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { BookBadge } from '@/components/books/BookBadge';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { fetchExamTree } from '@/lib/exams-api';
import { examSubjectSyllabusHref } from '@/lib/exam-routes';
import type { ExamTree } from '@/types/exams';
import { colors, spacing } from '@/theme';

export default function ExamDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const [tree, setTree] = useState<ExamTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchExamTree(id)
      .then((data) => {
        setTree(data);
        navigation.setOptions({ title: data.exam.short_name || data.exam.name });
      })
      .catch((err) => {
        setTree(null);
        setError(err instanceof Error ? err.message : 'Failed to load exam program');
      })
      .finally(() => setLoading(false));
  }, [id, navigation]);

  if (loading) return <BookLoading />;
  if (error) return <BookError message={error} />;
  if (!tree) return <BookEmpty title="Exam program not found" />;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{tree.exam.name}</Text>
      <Text style={styles.subTitle}>
        {tree.exam.short_name}
        {tree.exam.authority_name ? ` · ${tree.exam.authority_name}` : ''}
      </Text>

      {tree.types.length > 0 ? (
        <View style={styles.badges}>
          {tree.types.map((t) => (
            <BookBadge key={t.id} label={`${t.name} · ${t.total_time} min`} variant="muted" />
          ))}
        </View>
      ) : null}

      {tree.parts.length === 0 ? (
        <BookEmpty title="No parts yet" subtitle="Exam parts and subjects are not configured." />
      ) : (
        tree.parts.map((part) => (
          <View key={part.id} style={styles.panel}>
            <Text style={styles.partTitle}>
              Part {part.part_number}: {part.name}
            </Text>
            <Text style={styles.partMeta}>
              {part.total_marks} total marks · pass {part.pass_marks}
            </Text>

            {part.subjects.length === 0 ? (
              <Text style={styles.muted}>No subjects in this part.</Text>
            ) : (
              part.subjects.map((sub) => (
                <Pressable
                  key={sub.id}
                  style={({ pressed }) => [styles.subjectCard, pressed && styles.pressed]}
                  onPress={() => router.push(examSubjectSyllabusHref(sub.id))}
                >
                  <Text style={styles.subjectName}>{sub.name}</Text>
                  <View style={styles.badges}>
                    {sub.exam_type_name ? <BookBadge label={sub.exam_type_name} variant="muted" /> : null}
                    <BookBadge
                      label={`${sub.total_marks} marks · pass ${sub.pass_marks}`}
                      variant="muted"
                    />
                  </View>
                </Pressable>
              ))
            )}
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
  subTitle: {
    fontSize: 14,
    color: colors.textMuted,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  partTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  partMeta: {
    fontSize: 13,
    color: colors.textMuted,
  },
  muted: {
    fontSize: 14,
    color: colors.textMuted,
  },
  subjectCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
    gap: 6,
    backgroundColor: colors.background,
  },
  pressed: {
    opacity: 0.9,
  },
  subjectName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
});
