'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MoreVertical, Search, X } from 'lucide-react';
import { QUESTION_DIFFICULTIES } from '@ibas/shared-constants';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface BankItem {
  id: string;
  body_en: string;
  difficulty: string;
  question_type_name?: string;
  question_type_code: string;
  book_id?: string;
  book_name?: string;
  chapter_number?: string;
  chapter_name?: string;
  subjects?: Array<{ id: string; name: string; name_bn?: string }>;
  book_tags?: Array<{ book_id?: string; book_name?: string; chapter_name?: string; chapter_number?: string }>;
}

interface TypeRow {
  code: string;
  name: string;
}

function plain(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function bookOf(item: BankItem): { id: string; name: string } | null {
  if (item.book_id && item.book_name) return { id: item.book_id, name: item.book_name };
  const tag = item.book_tags?.[0];
  if (tag?.book_id && tag.book_name) return { id: tag.book_id, name: tag.book_name };
  return null;
}

export function QuestionBankLearner() {
  const [items, setItems] = useState<BankItem[]>([]);
  const [types, setTypes] = useState<TypeRow[]>([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [applied, setApplied] = useState('');
  const [typeCode, setTypeCode] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [bookId, setBookId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [groupByBooks, setGroupByBooks] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('limit', '100');
    if (applied.trim()) params.set('q', applied.trim());
    if (typeCode) params.set('question_type_code', typeCode);
    if (difficulty) params.set('difficulty', difficulty);
    if (subjectId) params.set('exam_subject_id', subjectId);
    void Promise.all([
      apiFetch<{ data: BankItem[] }>(`/questions?${params.toString()}`),
      apiFetch<{ data: TypeRow[] }>('/questions/types'),
      apiFetch<{ data: Array<{ id: string; label: string }> }>('/questions/subject-catalog').catch(() => ({
        data: [] as Array<{ id: string; label: string }>,
      })),
    ])
      .then(([list, typeRes, subjectRes]) => {
        setItems(list.data);
        setTypes(typeRes.data);
        setSubjects(subjectRes.data);
        setError('');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load questions'))
      .finally(() => setLoading(false));
  }, [applied, typeCode, difficulty, subjectId]);

  const books = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      const book = bookOf(item);
      if (book) map.set(book.id, book.name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const filtered = useMemo(() => {
    const rows = items.filter((item) => {
      if (bookId && bookOf(item)?.id !== bookId) return false;
      return true;
    });
    if (!groupByBooks) return rows;
    return [...rows].sort((a, b) => {
      const an = bookOf(a)?.name ?? 'zzz';
      const bn = bookOf(b)?.name ?? 'zzz';
      const bookCmp = an.localeCompare(bn);
      if (bookCmp !== 0) return bookCmp;
      return (a.chapter_number ?? '').localeCompare(b.chapter_number ?? '', undefined, { numeric: true });
    });
  }, [items, bookId, groupByBooks]);

  const selectedBook = books.find((b) => b.id === bookId)?.name;
  const selectedSubject = subjects.find((s) => s.id === subjectId)?.label;

  let lastBook = '';
  let lastChapter = '';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Question Bank</h1>
        <p className="mt-1 text-sm text-muted">Subjects you have access to. Group by Books & Tools when you want chapter order.</p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(query);
          setMenuOpen(false);
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search questions..." className="pl-9" />
        </div>
        <Button type="submit">Search</Button>
        <Button type="button" variant={menuOpen ? 'default' : 'outline'} size="sm" className="h-10 w-10 px-0" aria-label="Books and tools options" onClick={() => setMenuOpen((v) => !v)}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </form>

      {subjects.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button type="button" onClick={() => setSubjectId('')} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${!subjectId ? 'border-[#0f5c8c] bg-[#0f5c8c] text-white' : 'border-[#e2e8f0] bg-white text-[#64748b]'}`}>
            All subjects
          </button>
          {subjects.map((s) => (
            <button key={s.id} type="button" onClick={() => setSubjectId(s.id)} className={`max-w-[220px] shrink-0 truncate rounded-full border px-3 py-1.5 text-xs font-semibold ${subjectId === s.id ? 'border-[#0f5c8c] bg-[#0f5c8c] text-white' : 'border-[#e2e8f0] bg-white text-[#64748b]'}`}>
              {s.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={typeCode} onChange={(e) => setTypeCode(e.target.value)} aria-label="Question type">
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t.code} value={t.code}>{t.name}</option>
          ))}
        </select>
        <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} aria-label="Difficulty">
          <option value="">All levels</option>
          {QUESTION_DIFFICULTIES.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={groupByBooks} onChange={(e) => setGroupByBooks(e.target.checked)} />
          Group by Books & Tools
        </label>
      </div>

      {menuOpen ? (
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-border bg-surface p-3">
          <p className="text-sm font-semibold">Books & Tools</p>
          <button type="button" className={`block w-full rounded-lg px-2 py-1.5 text-left text-sm ${!bookId ? 'bg-primary/10 font-semibold text-primary' : ''}`} onClick={() => { setBookId(null); setMenuOpen(false); }}>
            All books
          </button>
          {books.map((b) => (
            <button key={b.id} type="button" className={`block w-full rounded-lg px-2 py-1.5 text-left text-sm ${bookId === b.id ? 'bg-primary/10 font-semibold text-primary' : ''}`} onClick={() => { setBookId(b.id); setMenuOpen(false); }}>
              {b.name}
            </button>
          ))}
        </div>
      ) : null}

      {selectedBook || selectedSubject ? (
        <div className="flex flex-wrap gap-2">
          {selectedSubject ? (
            <button type="button" className="inline-flex items-center gap-1 rounded-full bg-[#e8f3fa] px-3 py-1 text-sm font-semibold text-[#0f5c8c]" onClick={() => setSubjectId('')}>
              {selectedSubject} <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {selectedBook ? (
            <button type="button" className="inline-flex items-center gap-1 rounded-full bg-[#e8f3fa] px-3 py-1 text-sm font-semibold text-[#0f5c8c]" onClick={() => setBookId(null)}>
              {selectedBook} <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? <p className="text-sm text-muted">Loading Question Bank…</p> : null}
      {!loading && filtered.length === 0 ? <p className="text-sm text-muted">No questions for this filter.</p> : null}

      <div className="space-y-2">
        {filtered.map((item) => {
          const book = bookOf(item);
          const chapter = [item.chapter_number, item.chapter_name].filter(Boolean).join(': ');
          const showBook = groupByBooks && book && book.name !== lastBook;
          const showChapter = groupByBooks && chapter && chapter !== lastChapter;
          if (groupByBooks && book) lastBook = book.name;
          if (groupByBooks) lastChapter = chapter;
          return (
            <div key={item.id}>
              {showBook ? <p className="pt-3 text-lg font-extrabold text-[#0f5c8c]">{book?.name}</p> : null}
              {showChapter ? <p className="text-sm font-bold text-[#64748b]">{chapter}</p> : null}
              <Link href={`/questions/${item.id}`} className="block rounded-[14px] border border-[#e2e8f0] bg-white p-4 hover:border-[#0f5c8c]/40">
                <p className="line-clamp-3 text-sm leading-5 text-[#0f172a]">{plain(item.body_en)}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.question_type_name ? <Badge variant="secondary">{item.question_type_name}</Badge> : null}
                  <Badge variant="outline">{item.difficulty}</Badge>
                  {!groupByBooks && book ? <Badge variant="outline">{book.name}</Badge> : null}
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
