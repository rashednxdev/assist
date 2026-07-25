'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';

interface SearchResult {
  id: string;
  body_en: string;
  body_bn?: string;
  question_type_code: string;
}

interface BookOption {
  id: string;
  name: string;
  short_name?: string;
}

interface ChapterOption {
  id: string;
  name: string;
  chapter_number?: string;
}

/** Pick a question to use as a "mother" — filter by book/tool, chapter, or free-text search. */
export function MotherQuestionSearch({
  excludeQuestionId,
  onPick,
  busy,
}: {
  excludeQuestionId?: string;
  onPick: (question: { id: string; label: string }) => void;
  busy?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [books, setBooks] = useState<BookOption[]>([]);
  const [bookId, setBookId] = useState('');
  const [chapters, setChapters] = useState<ChapterOption[]>([]);
  const [chapterId, setChapterId] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ data: BookOption[] }>('/books')
      .then((r) => setBooks(r.data))
      .catch(() => setBooks([]));
  }, []);

  useEffect(() => {
    if (!bookId) {
      setChapters([]);
      setChapterId('');
      return;
    }
    apiFetch<{ data: ChapterOption[] }>(`/books/${bookId}/chapters`)
      .then((r) => {
        setChapters(r.data);
        setChapterId('');
      })
      .catch(() => setChapters([]));
  }, [bookId]);

  async function search() {
    setSearching(true);
    setSearched(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (chapterId) params.set('book_chapter_id', chapterId);
      else if (bookId) params.set('book_info_id', bookId);
      params.set('limit', '20');
      const res = await apiFetch<{ data: SearchResult[] }>(`/questions?${params.toString()}`);
      setResults(res.data.filter((r) => r.id !== excludeQuestionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      {error && <Alert variant="error">{error}</Alert>}
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
          value={bookId}
          onChange={(e) => setBookId(e.target.value)}
        >
          <option value="">All books &amp; tools</option>
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.short_name || b.name}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
          value={chapterId}
          onChange={(e) => setChapterId(e.target.value)}
          disabled={!bookId || chapters.length === 0}
        >
          <option value="">{bookId ? 'All chapters' : 'Select a book first'}</option>
          {chapters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.chapter_number ? `${c.chapter_number}. ` : ''}
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search question text..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void search();
            }
          }}
        />
        <Button type="button" size="sm" onClick={() => void search()} disabled={searching}>
          <Search className="h-3.5 w-3.5" />
        </Button>
      </div>
      {searching && <p className="text-xs text-muted">Searching…</p>}
      {!searching && searched && results.length === 0 && <p className="text-xs text-muted">No questions found.</p>}
      {!searching && results.length > 0 && (
        <ul className="max-h-56 space-y-1.5 overflow-y-auto">
          {results.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-2 text-sm">
              <span className="line-clamp-2 flex-1">{r.body_bn || r.body_en}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => onPick({ id: r.id, label: r.body_bn || r.body_en })}
              >
                Use this
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
