import { StyleSheet, Text, View } from 'react-native';
import { formatDurationBn, toBanglaDigits } from '@/lib/bangla-format';
import { paperHeadingLines } from '@/lib/paper-display';
import type { PaperItem } from '@/types/papers';
import { colors, spacing } from '@/theme';

interface PaperSheetHeaderProps {
  paper: PaperItem;
}

export function PaperSheetHeader({ paper }: PaperSheetHeaderProps) {
  const { paperName, examLine, subjectLine } = paperHeadingLines(paper);

  return (
    <View style={styles.header}>
      <Text style={styles.paperName}>{paperName}</Text>
      <View style={styles.centerBlock}>
        {examLine ? <Text style={styles.examLine}>{examLine}</Text> : null}
        {subjectLine ? <Text style={styles.subjectLine}>{subjectLine}</Text> : null}
        <Text style={styles.metaLine}>সময়- {formatDurationBn(paper.duration_minutes)}</Text>
        <Text style={styles.metaLine}>পূর্ণমান- {toBanglaDigits(paper.total_marks)}</Text>
        <Text style={styles.metaLine}>পাস নম্বর- {toBanglaDigits(paper.pass_marks)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(120, 53, 15, 0.12)',
    paddingBottom: spacing.md,
    minHeight: 120,
  },
  paperName: {
    position: 'absolute',
    top: 0,
    right: 0,
    maxWidth: '48%',
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
    lineHeight: 18,
  },
  centerBlock: {
    paddingTop: spacing.xs,
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
  },
  examLine: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 24,
  },
  subjectLine: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 24,
  },
  metaLine: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 24,
  },
});
