import { ClipboardCheck, RotateCcw, Send, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export type ReviewStatus = 'draft' | 'quality_check' | 'published';

const STATUS_LABEL: Record<ReviewStatus, string> = {
  draft: 'Draft',
  quality_check: 'Quality check',
  published: 'Published',
};

const STATUS_VARIANT: Record<ReviewStatus, 'outline' | 'warning' | 'success'> = {
  draft: 'outline',
  quality_check: 'warning',
  published: 'success',
};

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

/**
 * Draft -> quality_check -> published action buttons, plus the ability to fall back
 * (published -> quality_check, quality_check -> draft). Renders only the transitions valid from
 * the current status.
 */
export function ReviewStatusActions({
  status,
  busy,
  onSubmitForQualityCheck,
  onReturnToDraft,
  onPublish,
  onUnpublish,
  size = 'sm',
}: {
  status: ReviewStatus;
  busy?: boolean;
  onSubmitForQualityCheck: (e: React.MouseEvent) => void;
  onReturnToDraft: (e: React.MouseEvent) => void;
  onPublish: (e: React.MouseEvent) => void;
  onUnpublish: (e: React.MouseEvent) => void;
  size?: 'sm' | 'default';
}) {
  if (status === 'draft') {
    return (
      <Button type="button" size={size} variant="outline" disabled={busy} onClick={onSubmitForQualityCheck}>
        <Send className="h-4 w-4" />
        Submit for quality check
      </Button>
    );
  }
  if (status === 'quality_check') {
    return (
      <>
        <Button type="button" size={size} variant="outline" disabled={busy} onClick={onReturnToDraft}>
          <RotateCcw className="h-4 w-4" />
          Send back to draft
        </Button>
        <Button type="button" size={size} disabled={busy} onClick={onPublish}>
          <Upload className="h-4 w-4" />
          Publish
        </Button>
      </>
    );
  }
  return (
    <Button type="button" size={size} variant="outline" disabled={busy} onClick={onUnpublish}>
      <ClipboardCheck className="h-4 w-4" />
      Send to quality check
    </Button>
  );
}
