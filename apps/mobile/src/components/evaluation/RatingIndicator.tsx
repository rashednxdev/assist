import { View, StyleSheet } from 'react-native';
import { ratingCircleColor, type QuestionEvalBrief } from '@/lib/evaluation-display';

interface RatingIndicatorProps {
  evaluation?: QuestionEvalBrief | null;
  size?: number;
}

export function RatingIndicator({ evaluation, size = 10 }: RatingIndicatorProps) {
  const color = ratingCircleColor(evaluation ?? undefined);
  if (!color) return null;

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
      ]}
      accessibilityRole="image"
      accessibilityLabel={evaluation ? `Evaluation: ${evaluation.progress_index}%` : undefined}
    />
  );
}

const styles = StyleSheet.create({
  circle: {
    flexShrink: 0,
  },
});
