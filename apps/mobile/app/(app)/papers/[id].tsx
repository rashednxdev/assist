import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { BookBadge } from '@/components/books/BookBadge';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { ProgressSummary } from '@/components/evaluation/ProgressSummary';
import {
  buildPaperQuestionProgressMap,
  fetchPaperEvaluation,
  type PaperEvaluationData,
} from '@/lib/evaluation-api';
import { fetchPaperCompose } from '@/lib/papers-api';
import {
  displayQuestionLabel,
  mainRowMarks,
  partsForDisplay,
  primaryQuestionId,
  promotedFirstPart,
  questionInlineText,
} from '@/lib/paper-display';
import { questionDetailHref } from '@/lib/question-routes';
import type { PaperComposeData, PaperQuestionPart, PaperQuestionRow } from '@/types/papers';
import { colors, spacing } from '@/theme';

function marksLabel(marks: number, marksBn?: string): string {
  return marksBn?.trim() ? marksBn : `${marks} marks`;
}

export default function PaperDetailScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<PaperComposeData | null>(null);
  const [evaluation, setEvaluation] = useState<PaperEvaluationData | null>(null);
  const [questionProgress, setQuestionProgress] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPaper = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const compose = await fetchPaperCompose(id);
      setData(compose);
      navigation.setOptions({ title: compose.paper.name || 'Paper' });
      try {
        const evalData = await fetchPaperEvaluation(id);
        setEvaluation(evalData);
        setQuestionProgress(buildPaperQuestionProgressMap(evalData.overall));
      } catch {
        setEvaluation(null);
        setQuestionProgress(new Map());
      }
    } catch (err) {
      setData(null);
      setEvaluation(null);
      setQuestionProgress(new Map());
      setError(err instanceof Error ? err.message : 'Failed to load paper');
    } finally {
      setLoading(false);
    }
  }, [id, navigation]);

  useEffect(() => {
    void loadPaper();
  }, [loadPaper]);

  useFocusEffect(
    useCallback(() => {
      if (!id || loading) return;
      fetchPaperEvaluation(id)
        .then((evalData) => {
          setEvaluation(evalData);
          setQuestionProgress(buildPaperQuestionProgressMap(evalData.overall));
        })
        .catch(() => {
          setEvaluation(null);
          setQuestionProgress(new Map());
        });
    }, [id, loading]),
  );

  if (loading) return <BookLoading />;
  if (error) return <BookError message={error} />;
  if (!data) return <BookEmpty title="Paper not found" />;

  const paper = data.paper;
  const totalQuestions =
    data.ungrouped_questions.length + data.groups.reduce((sum, group) => sum + group.questions.length, 0);

  function renderPart(part: PaperQuestionPart) {
    const title = part.question?.body_en?.trim() || 'Open question detail';
    return (
      <Pressable
        key={part.id}
        style={({ pressed }) => [styles.partRow, pressed && styles.pressed]}
        onPress={() => router.push(questionDetailHref(part.question_id))}
      >
        <Text style={styles.partLabel}>{part.part_label}.</Text>
        <Text style={styles.partText}>{title}</Text>
      </Pressable>
    );
  }

  function renderQuestionRow(row: PaperQuestionRow) {
    const label = displayQuestionLabel(row);
    const inline = questionInlineText(row);
    const tapId = primaryQuestionId(row);
    const rowMarks = mainRowMarks(row);
    const promoted = promotedFirstPart(row);
    const visibleParts = partsForDisplay(row);
    const hasSubQuestions = visibleParts.length > 0;
    const rowProgress = questionProgress.get(row.id);

    const mainContent = (
      <View style={styles.questionMain}>
        <Text style={styles.questionNo}>{label}.</Text>
        <View style={styles.questionBody}>
          <View style={styles.questionTopRow}>
            <View style={styles.questionTextRow}>
            {promoted ? <Text style={styles.promotedLabel}>{promoted.part_label}.</Text> : null}
            {tapId ? (
              <Pressable
                style={({ pressed }) => [styles.questionTap, pressed && styles.pressed]}
                onPress={() => router.push(questionDetailHref(tapId))}
              >
                <Text style={styles.questionText}>{inline || 'Open question detail'}</Text>
              </Pressable>
            ) : (
              <Text style={styles.questionText}>{inline || 'Composite question'}</Text>
            )}
            </View>
            {rowProgress !== undefined && rowProgress > 0 ? (
              <Text style={styles.questionProgress}>{rowProgress}%</Text>
            ) : null}
          </View>
          <View style={styles.badges}>
            <BookBadge label={marksLabel(rowMarks.marks, rowMarks.marks_display_bn)} variant="muted" />
            {!row.is_compulsory ? <BookBadge label="Optional" variant="muted" /> : null}
          </View>
        </View>
      </View>
    );

    return (
      <View key={row.id} style={styles.questionGroup}>
        {mainContent}
        {hasSubQuestions ? (
          <View style={styles.subQuestionWrap}>
            {visibleParts.map(renderPart)}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{paper.name}</Text>
      <Text style={styles.subTitle}>
        {[paper.exam_short_name, paper.exam_subject_name, paper.session_label_en].filter(Boolean).join(' · ')}
      </Text>

      <View style={styles.badges}>
        <BookBadge label={paper.paper_type_name ?? 'Paper'} variant="muted" />
        <BookBadge label={`${paper.total_marks} marks`} variant="muted" />
        <BookBadge label={`${paper.pass_marks} pass`} variant="muted" />
        <BookBadge label={`${paper.duration_minutes} min`} variant="muted" />
        <BookBadge label={`${totalQuestions} questions`} variant="muted" />
      </View>

      {evaluation && evaluation.overall.total_questions > 0 ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Overall evaluation</Text>
          <ProgressSummary summary={evaluation.overall} />
          <Text style={styles.evalHint}>
            Average mastery across all questions on this paper.
          </Text>
        </View>
      ) : null}

      {paper.instructions?.trim() ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Instructions</Text>
          <Text style={styles.instructions}>{paper.instructions}</Text>
        </View>
      ) : null}

      {data.groups.map((group) => (
        <View key={group.id} style={styles.panel}>
          <Text style={styles.sectionTitle}>
            Group {group.group_number}: {group.name}
          </Text>
          {group.instructions?.trim() ? <Text style={styles.groupHint}>{group.instructions}</Text> : null}
          {group.questions.length === 0 ? (
            <Text style={styles.muted}>No questions in this group.</Text>
          ) : (
            <View style={styles.questionList}>{group.questions.map(renderQuestionRow)}</View>
          )}
        </View>
      ))}

      {data.ungrouped_questions.length > 0 ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Questions</Text>
          <View style={styles.questionList}>{data.ungrouped_questions.map(renderQuestionRow)}</View>
        </View>
      ) : null}

      {totalQuestions === 0 ? (
        <BookEmpty title="No questions added yet" subtitle="This paper has no configured questions." />
      ) : null}
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
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  instructions: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 21,
  },
  groupHint: {
    fontSize: 13,
    color: colors.textMuted,
  },
  evalHint: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
  questionList: {
    gap: spacing.sm,
  },
  questionGroup: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  questionMain: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  questionNo: {
    width: 32,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  questionBody: {
    flex: 1,
    gap: 6,
  },
  questionTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  questionTextRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  promotedLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  questionTap: {
    flex: 1,
  },
  questionText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  questionProgress: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    minWidth: 36,
    textAlign: 'right',
  },
  subQuestionWrap: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: 6,
  },
  partRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.sm,
    backgroundColor: colors.background,
  },
  partLabel: {
    width: 24,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  partText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
  },
  muted: {
    fontSize: 14,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.9,
  },
});
