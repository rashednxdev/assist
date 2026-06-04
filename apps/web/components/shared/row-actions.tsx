'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function RowActions({
  onEdit,
  onDelete,
  editLabel = 'Edit',
  deleteLabel = 'Delete',
  busy,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  editLabel?: string;
  deleteLabel?: string;
  busy?: boolean;
}) {
  return (
    <div className="flex shrink-0 gap-1">
      {onEdit && (
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2" disabled={busy} onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
          <span className="sr-only">{editLabel}</span>
        </Button>
      )}
      {onDelete && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
          disabled={busy}
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="sr-only">{deleteLabel}</span>
        </Button>
      )}
    </div>
  );
}
