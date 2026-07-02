import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { ProgressSummary } from '@/components/evaluation/ProgressSummary';
import { RatingIndicator } from '@/components/evaluation/RatingIndicator';
import { PaperSheetHeader } from '@/components/papers/PaperSheetHeader';
import {
  collectPaperQuestionIds,
  type QuestionEvalBrief,
} from '@/lib/evaluation-display';
import {
  fetchPaperEvaluation,
  fetchQuestionEvaluationsBatch,
  type PaperEvaluationData,
} from '@/lib/evaluation-api';
import { bookNavTitle } from '@/lib/book-display';
import { toBanglaDigits } from '@/lib/bangla-format';
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

function marksLine(marks: number, marksBn?: string): string {
  return marksBn?.trim() ? toBanglaDigits(marksBn) : toBanglaDigits(String(marks));
}

export default function PaperDetailScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<PaperComposeData | null>(null);
  const [evaluation, setEvaluation] = useState<PaperEvaluationData | null>(null);
  const [evalMap, setEvalMap] = useState<Map<string, QuestionEvalBrief>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({
      title: loading ? ' ' : data?.paper.name ? bookNavTitle(data.paper.name) : ' ',
      headerBackTitle: 'Papers',
    });
  }, [navigation, loading, data?.paper.name]);

  const loadPaper = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const compose = await fetchPaperCompose(id);
      setData(compose);
      try {
        const evalData = await fetchPaperEvaluation(id);
        setEvaluation(evalData);
      } catch {
        setEvaluation(null);
      }
    } catch (err) {
      setData(null);
      setEvaluation(null);
      setEvalMap(new Map());
      setError(err instanceof Error ? err.message : 'Failed to load paper');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadPaper();
  }, [loadPaper]);

  const allQuestionRows = useMemo(() => {
    if (!data) return [];
    return [...data.groups.flatMap((group) => group.questions), ...data.ungrouped_questions];
  }, [data]);

  const loadEvaluations = useCallback(async () => {
    const ids = collectPaperQuestionIds(allQuestionRows);
    if (ids.length === 0) {
      setEvalMap(new Map());
      return;
    }
    try {
      const rows = await fetchQuestionEvaluationsBatch(ids);
      const map = new Map<string, QuestionEvalBrief>();
      for (const row of rows) {
        if (row.progress_index > 0 || row.self_rating || row.is_correct !== undefined) {
          map.set(row.question_id, row);
        }
      }
      setEvalMap(map);
    } catch {
      setEvalMap(new Map());
    }
  }, [allQuestionRows]);

  useEffect(() => {
    void loadEvaluations();
  }, [loadEvaluations]);

  useFocusEffect(
    useCallback(() => {
      if (!id || loading) return;
      fetchPaperEvaluation(id)
        .then((evalData) => setEvaluation(evalData))
        .catch(() => setEvaluation(null));
      void loadEvaluations();
    }, [id, loading, loadEvaluations]),
  );

  if (loading) return <BookLoading />;
  if (error) return <BookError message={error} />;
  if (!data) return <BookEmpty title="Paper not found" />;

  const paper = data.paper;
  const totalQuestions =
    data.ungrouped_questions.length + data.groups.reduce((sum, group) => sum + group.questions.length, 0);

  function renderPart(part: PaperQuestionPart) {
    const title = part.question?.body_en?.trim() || 'Open question detail';
    const partMarksText = marksLine(part.marks, part.marks_display_bn);
    const showMarks = part.marks > 0 || part.marks_display_bn?.trim();

    return (
      <Pressable
        key={part.id}
        style={({ pressed }) => [styles.partRow, pressed && styles.pressed]}
        onPress={() => router.push(questionDetailHref(part.question_id))}
      >
        <Text style={styles.sheetText}>{part.part_label}.</Text>
        <View style={styles.questionBody}>
          <View style={styles.titleWithRating}>
            <Text style={[styles.sheetText, styles.partBody]}>{title}</Text>
            <RatingIndicator evaluation={evalMap.get(part.question_id)} />
          </View>
          {showMarks ? (
            <View style={styles.marksCol}>
              <Text style={[styles.sheetText, styles.marksLine]}>[{partMarksText}]</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  }

  function renderQuestionRow(row: PaperQuestionRow) {
    const label = displayQuestionLabel(row);
    const inline = questionInlineText(row);
    const tapId = primaryQuestionId(row);
    const rowMarks = mainRowMarks(row);
    const marksText = marksLine(rowMarks.marks, rowMarks.marks_display_bn);
    const promoted = promotedFirstPart(row);
    const visibleParts = partsForDisplay(row);
    const hasSubQuestions = visibleParts.length > 0;
    const questionEval = tapId ? evalMap.get(tapId) : undefined;

    const mainContent = (
      <View style={styles.questionMain}>
        <Text style={styles.sheetText}>{label}.</Text>
        <View style={styles.questionBody}>
          <View style={styles.questionTextRow}>
            {promoted ? <Text style={styles.sheetText}>{promoted.part_label}.</Text> : null}
            {tapId ? (
              <Pressable
                style={({ pressed }) => [styles.questionTap, pressed && styles.pressed]}
                onPress={() => router.push(questionDetailHref(tapId))}
              >
                <View style={styles.titleWithRating}>
                  <Text style={[styles.sheetText, styles.questionTitle]}>
                    {inline || 'Open question detail'}
                  </Text>
                  <RatingIndicator evaluation={questionEval} />
                </View>
              </Pressable>
            ) : (
              <View style={styles.titleWithRating}>
                <Text style={[styles.sheetText, styles.questionTitle]}>
                  {inline || 'Composite question'}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.marksCol}>
            {(rowMarks.marks > 0 || rowMarks.marks_display_bn?.trim()) ? (
              <Text style={[styles.sheetText, styles.marksLine]}>[{marksText}]</Text>
            ) : null}
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
      {evaluation && evaluation.overall.total_questions > 0 ? (
        <View style={styles.evalPanel}>
          <Text style={styles.sectionTitle}>Overall evaluation</Text>
          <ProgressSummary summary={evaluation.overall} />
        </View>
      ) : null}

      <View style={styles.paperSheet}>
        <PaperSheetHeader paper={paper} />

        {paper.instructions?.trim() ? (
          <View style={styles.instructionsBlock}>
            <Text style={styles.instructions}>{toBanglaDigits(paper.instructions)}</Text>
          </View>
        ) : null}

        {data.groups.map((group) => (
          <View key={group.id} style={styles.groupBlock}>
            {(group.name || group.instructions?.trim()) ? (
              <View style={styles.groupHeading}>
                {group.name ? <Text style={styles.groupTitle}>{group.name}</Text> : null}
                {group.instructions?.trim() ? (
                  <Text style={styles.groupHint}>{group.instructions}</Text>
                ) : null}
              </View>
            ) : null}
            {group.questions.length === 0 ? (
              <Text style={styles.muted}>No questions in this group.</Text>
            ) : (
              <View style={styles.questionList}>{group.questions.map(renderQuestionRow)}</View>
            )}
          </View>
        ))}

        {data.ungrouped_questions.length > 0 ? (
          <View style={styles.groupBlock}>
            {data.groups.length > 0 ? <Text style={styles.groupTitle}>প্রশ্ন</Text> : null}
            <View style={styles.questionList}>{data.ungrouped_questions.map(renderQuestionRow)}</View>
          </View>
        ) : null}

        {totalQuestions === 0 ? (
          <BookEmpty title="No questions added yet" subtitle="This paper has no configured questions." />
        ) : null}
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
  evalPanel: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  paperSheet: {
    backgroundColor: '#fffdf7',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(120, 53, 15, 0.15)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  instructionsBlock: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(120, 53, 15, 0.12)',
    paddingBottom: spacing.md,
  },
  instructions: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 24,
    textAlign: 'center',
  },
  groupBlock: {
    gap: spacing.sm,
  },
  groupHeading: {
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.xs,
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  groupHint: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
  },
  questionList: {
    gap: spacing.sm,
  },
  questionGroup: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(120, 53, 15, 0.08)',
  },
  questionMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  sheetText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 24,
  },
  questionBody: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  questionTextRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 4,
  },
  questionTap: {
    flex: 1,
    minWidth: 0,
  },
  titleWithRating: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  questionTitle: {
    flex: 1,
    minWidth: 0,
  },
  marksCol: {
    flexShrink: 0,
    alignItems: 'flex-end',
    gap: 2,
    maxWidth: 72,
  },
  marksLine: {
    textAlign: 'right',
  },
  subQuestionWrap: {
    marginTop: spacing.sm,
    marginLeft: spacing.lg,
    gap: spacing.sm,
  },
  partRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  partBody: {
    flex: 1,
    minWidth: 0,
  },
  muted: {
    fontSize: 14,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.9,
  },
});
