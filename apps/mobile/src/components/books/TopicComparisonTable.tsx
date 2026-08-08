import { ComparisonTablePreview } from '@/components/questions/ComparisonTablePreview';
import type { ComparisonTable } from '@/types/questions';

export function TopicComparisonTable({
  table,
  title,
}: {
  table?: ComparisonTable | null;
  title?: string;
}) {
  return <ComparisonTablePreview table={table} title={title} />;
}
