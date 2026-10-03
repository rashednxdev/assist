'use client';

import { useState } from 'react';
import { Library, Plus, X } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';

interface BookArchiveTagProps {
  bookId: string;
  archived: boolean;
  onChange: (archived: boolean) => void;
}

/** Admin chip that adds or removes a book from Policy Library → Books & Query. */
export function BookArchiveTag({ bookId, archived, onChange }: BookArchiveTagProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/policy/archive/books/${bookId}`, {
        method: 'PATCH',
        body: JSON.stringify({ archive: !archived }),
      });
      onChange(!archived);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update Books & Query');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        disabled={busy}
        onClick={() => void toggle()}
        title={archived ? 'Remove from Books & Query' : 'Add to Books & Query (content and PDF only)'}
        className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors disabled:opacity-60 ${
          archived
            ? 'border-emerald-600/30 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            : 'border-dashed border-input bg-background text-muted hover:text-foreground'
        }`}
      >
        <Library className="h-3.5 w-3.5" />
        Books &amp; Query
        {archived ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
