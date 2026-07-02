'use client';

import { RichTextView } from '@/components/books/rich-text-view';
import { bookTheme } from '@/lib/book-theme';

export function BookDetailsBlock({ html, note }: { html?: string; note?: string }) {
  const hasDetails = Boolean(html?.trim());
  const hasNote = Boolean(note?.trim());

  if (!hasDetails && !hasNote) {
    return <p className="text-sm text-muted">No details entered for this item.</p>;
  }

  return (
    <div className="space-y-4">
      {hasDetails && <RichTextView html={html} />}
      {hasNote && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-muted">Note</h4>
          <p className={bookTheme.note}>{note}</p>
        </div>
      )}
    </div>
  );
}
