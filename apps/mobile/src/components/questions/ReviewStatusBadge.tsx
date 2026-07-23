import { BookBadge } from '@/components/books/BookBadge';
import type { ReviewStatus } from '@/types/questions';

const LABEL: Record<ReviewStatus, string> = {
  draft: 'Draft',
  quality_check: 'Quality check',
  published: 'Published',
};

const VARIANT: Record<ReviewStatus, 'default' | 'warning' | 'muted'> = {
  draft: 'muted',
  quality_check: 'warning',
  published: 'default',
};

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  return <BookBadge label={LABEL[status]} variant={VARIANT[status]} />;
}
