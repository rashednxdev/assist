import { ratingCircleClass, ratingIndicatorTitle, type QuestionEvalBrief } from '@/lib/evaluation-display';

interface RatingIndicatorProps {
  evaluation?: QuestionEvalBrief | null;
  className?: string;
}

export function RatingIndicator({ evaluation, className }: RatingIndicatorProps) {
  const circleClass = ratingCircleClass(evaluation ?? undefined);
  if (!circleClass) return null;

  const title = ratingIndicatorTitle(evaluation ?? undefined);

  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${circleClass} ${className ?? ''}`}
      title={title}
      aria-label={title}
      role="img"
    />
  );
}
