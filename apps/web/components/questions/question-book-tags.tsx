'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';

export interface QuestionBookTag {
  id: string;
  name: string;
  chapter_id: string;
}

export interface BookCatalogItem {
  id: string;
  name: string;
  label: string;
}

interface QuestionBookTagsProps {
  questionId: string;
  books: QuestionBookTag[];
  catalog: BookCatalogItem[];
  disabled?: boolean;
  onChange: (books: QuestionBookTag[]) => void;
}

/** Inline book tags — links the question to each book's first chapter only. */
export function QuestionBookTags({
  questionId,
  books,
  catalog,
  disabled,
  onChange,
}: QuestionBookTagsProps) {
  const [busy, setBusy] = useState(false);
  const taggedIds = new Set(books.map((b) => b.id));
  const available = catalog.filter((c) => !taggedIds.has(c.id));

  async function addBook(bookInfoId: string) {
    if (!bookInfoId || busy || disabled) return;
    setBusy(true);
    try {
      const res = await apiFetch<{
        data: { id: string; name: string; chapter_id: string };
      }>(`/questions/${questionId}/book-first-chapter-links`, {
        method: 'POST',
        body: JSON.stringify({ book_info_id: bookInfoId }),
      });
      const next = [
        ...books.filter((b) => b.id !== res.data.id),
        {
          id: res.data.id,
          name: res.data.name,
          chapter_id: res.data.chapter_id,
        },
      ];
      onChange(next);
    } finally {
      setBusy(false);
    }
  }

  async function removeBook(bookInfoId: string) {
    if (busy || disabled) return;
    setBusy(true);
    try {
      await apiFetch(`/questions/${questionId}/book-first-chapter-links/${bookInfoId}`, {
        method: 'DELETE',
      });
      onChange(books.filter((b) => b.id !== bookInfoId));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="mt-1.5 flex flex-wrap items-center gap-1.5"
      onClick={(e) => e.preventDefault()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {books.map((b) => (
        <Badge key={b.id} variant="outline" className="gap-1 pr-1">
          <span>{b.name}</span>
          {!disabled ? (
            <button
              type="button"
              className="rounded p-0.5 hover:bg-black/10"
              aria-label={`Remove book ${b.name}`}
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void removeBook(b.id);
              }}
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </Badge>
      ))}
      {!disabled && available.length > 0 ? (
        <select
          className="h-7 max-w-[220px] rounded-md border border-input bg-background px-2 text-xs"
          disabled={busy}
          value=""
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            const id = e.target.value;
            e.target.value = '';
            void addBook(id);
          }}
          aria-label="Add book tag (first chapter)"
        >
          <option value="">+ Book…</option>
          {available.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
      ) : null}
      {!disabled && available.length === 0 && books.length === 0 ? (
        <span className="text-xs text-muted-foreground">No books in catalog</span>
      ) : null}
    </div>
  );
}
