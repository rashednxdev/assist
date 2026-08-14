'use client';

import { BOOK_TEXT_MARKUP_HELP } from '@ibas/shared-constants';
import { X, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function MarkupInstructionsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex h-[100dvh] max-h-[100dvh] w-full max-w-[100vw] flex-col overflow-hidden rounded-none border border-border bg-background shadow-xl sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-2xl sm:rounded-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">Text markup</h2>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm leading-relaxed">
          <p className="text-muted">
            Use these markers in question text, options, model answers, explanations, and notes.
            Markers are removed when the text is shown to users.
          </p>
          <ul className="space-y-3">
            {BOOK_TEXT_MARKUP_HELP.map((row) => (
              <li key={row.marker} className="rounded-lg border border-border bg-slate-50/80 px-3 py-2.5">
                <code className="rounded bg-background px-1.5 py-0.5 font-mono text-sm font-semibold text-foreground ring-1 ring-border">
                  {row.marker}
                </code>
                <p className="mt-1.5 text-muted">{row.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function MarkupInstructionsButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" size="sm" variant="outline" onClick={onClick}>
      <BookOpen className="h-4 w-4" />
      Markup guide
    </Button>
  );
}
