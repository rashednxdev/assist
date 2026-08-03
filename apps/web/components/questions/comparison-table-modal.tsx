'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { ComparisonTable } from '@ibas/shared-types';
import { Button } from '@/components/ui/button';
import { ComparisonTableEditor } from './comparison-table-editor';

export function ComparisonTableModal({
  open,
  initialValue,
  title,
  onCancel,
  onSave,
}: {
  open: boolean;
  initialValue: ComparisonTable;
  title?: string;
  onCancel: () => void;
  onSave: (table: ComparisonTable) => void;
}) {
  const [draft, setDraft] = useState<ComparisonTable>(initialValue);
  const wasOpen = useRef(false);

  useEffect(() => {
    // Only reseed the draft on the closed -> open transition, not on every render where a caller
    // happens to pass a new `initialValue` object reference while already open (which would
    // otherwise silently discard whatever the user is mid-typing).
    if (open && !wasOpen.current) setDraft(initialValue);
    wasOpen.current = open;
  }, [open, initialValue]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex h-[100dvh] max-h-[100dvh] w-full max-w-[100vw] flex-col overflow-hidden rounded-none border border-border bg-background shadow-xl sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-3xl sm:rounded-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">{title || 'Comparison table'}</h2>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <ComparisonTableEditor value={draft} onChange={setDraft} />
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={() => onSave(draft)}>
            Save table
          </Button>
        </div>
      </div>
    </div>
  );
}
