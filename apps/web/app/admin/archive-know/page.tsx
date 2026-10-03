'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Plus, Search, X } from 'lucide-react';
import type { ArchiveOverview, KnowCandidate, KnowQuestionItem, PolicyBookItem } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';

interface ChapterOption {
  id: string;
  chapter_number?: string;
  name?: string;
}

function questionText(q: { body_en: string; body_bn?: string }) {
  return q.body_bn?.trim() || q.body_en;
}

export default function ArchiveKnowAdminPage() {
  const [overview, setOverview] = useState<ArchiveOverview | null>(null);
  const [area, setArea] = useState('');
  const [items, setItems] = useState<KnowQuestionItem[]>([]);
  const [books, setBooks] = useState<PolicyBookItem[]>([]);
  const [bookId, setBookId] = useState('');
  const [chapters, setChapters] = useState<ChapterOption[]>([]);
  const [chapterId, setChapterId] = useState('');
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<KnowCandidate[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadOverview = useCallback(() => {
    return apiFetch<{ data: ArchiveOverview }>('/policy/archive').then((r) => {
      setOverview(r.data);
      return r.data;
    });
  }, []);

  useEffect(() => {
    loadOverview()
      .then((data) => {
        const wanted = new URLSearchParams(window.location.search).get('area');
        const pick = data.areas.find((a) => a.code === wanted) ?? data.areas[0];
        if (pick) setArea(pick.code);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load areas'));
    apiFetch<{ data: PolicyBookItem[] }>('/policy/admin/books')
      .then((r) => setBooks(r.data))
      .catch(() => setBooks([]));
  }, [loadOverview]);

  const loadItems = useCallback(() => {
    if (!area) return Promise.resolve();
    return apiFetch<{ data: KnowQuestionItem[] }>(`/policy/archive/know?area=${encodeURIComponent(area)}`).then((r) =>
      setItems(r.data),
    );
  }, [area]);

  useEffect(() => {
    setItems([]);
    loadItems().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load questions'));
  }, [loadItems]);

  useEffect(() => {
    setChapterId('');
    setChapters([]);
    if (!bookId) return;
    apiFetch<{ data: ChapterOption[] }>(`/books/${bookId}/chapters`)
      .then((r) => setChapters(r.data))
      .catch(() => setChapters([]));
  }, [bookId]);

  const loadCandidates = useCallback(() => {
    if (!area || (!bookId && !query)) {
      setCandidates(null);
      return Promise.resolve();
    }
    const params = new URLSearchParams({ area });
    if (bookId) params.set('book_id', bookId);
    if (chapterId) params.set('chapter_id', chapterId);
    if (query) params.set('q', query);
    setLoadingCandidates(true);
    return apiFetch<{ data: KnowCandidate[] }>(`/policy/archive/know/candidates?${params.toString()}`)
      .then((r) => setCandidates(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load questions'))
      .finally(() => setLoadingCandidates(false));
  }, [area, bookId, chapterId, query]);

  useEffect(() => {
    setSelected(new Set());
    void loadCandidates();
  }, [loadCandidates]);

  const selectable = useMemo(() => (candidates ?? []).filter((c) => !c.added), [candidates]);
  const allSelected = selectable.length > 0 && selectable.every((c) => selected.has(c.id));

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function addSelected() {
    if (selected.size === 0) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const r = await apiFetch<{ data: { added: number; skipped: number } }>('/policy/archive/know', {
        method: 'POST',
        body: JSON.stringify({ area_code: area, question_ids: [...selected] }),
      });
      setMessage(`Added ${r.data.added} question${r.data.added === 1 ? '' : 's'}${r.data.skipped ? ` (${r.data.skipped} already there)` : ''}.`);
      setSelected(new Set());
      await Promise.all([loadItems(), loadCandidates(), loadOverview()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add questions');
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: KnowQuestionItem) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/policy/archive/know/${item.link_id}`, { method: 'DELETE' });
      await Promise.all([loadItems(), loadCandidates(), loadOverview()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove the question');
    } finally {
      setBusy(false);
    }
  }

  const areaInfo = overview?.areas.find((a) => a.code === area);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Know, Because you asked any more"
        description="Pick published MCQs from any Books & Tools book and file them under an iBAS++ area. Users see them in Policy Library → Books & Policy Archive; tapping one shows its explanation and tagged circulars."
        backHref="/policy/archive"
        backLabel="Archive"
      />

      {error && <Alert variant="error">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      <div className="max-w-md space-y-1.5">
        <Label htmlFor="area">Area</Label>
        <select id="area" className="ibas-select" value={area} onChange={(e) => setArea(e.target.value)}>
          {(overview?.areas ?? []).map((a) => (
            <option key={a.code} value={a.code}>
              {a.name_en} ({a.question_count})
            </option>
          ))}
        </select>
        {overview && overview.areas.length === 0 && (
          <p className="text-xs text-amber-700">No active iBAS++ areas. Create one under iBAS++ areas first.</p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="space-y-3 border-b border-border pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-5 w-5 text-primary" />
              Add questions
            </CardTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <select className="ibas-select" value={bookId} onChange={(e) => setBookId(e.target.value)}>
                <option value="">Any book (search below)</option>
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <select
                className="ibas-select"
                value={chapterId}
                disabled={!bookId}
                onChange={(e) => setChapterId(e.target.value)}
              >
                <option value="">All chapters</option>
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {[c.chapter_number, c.name].filter(Boolean).join(': ')}
                  </option>
                ))}
              </select>
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setQuery(draft.trim());
              }}
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Search question text…" className="pl-9" />
              </div>
              <Button type="submit" variant="outline">
                Search
              </Button>
            </form>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {candidates === null ? (
              <p className="text-sm text-muted">Choose a book or search to list published MCQs.</p>
            ) : loadingCandidates ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : candidates.length === 0 ? (
              <p className="text-sm text-muted">No published MCQs found.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      disabled={selectable.length === 0}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(selectable.map((c) => c.id)))}
                    />
                    Select all ({selectable.length})
                  </label>
                  <Button size="sm" disabled={busy || selected.size === 0 || !area} onClick={() => void addSelected()}>
                    <Plus className="h-4 w-4" />
                    Add {selected.size || ''} to {areaInfo?.name_en ?? 'area'}
                  </Button>
                </div>
                <div className="max-h-[560px] space-y-1.5 overflow-y-auto pr-1">
                  {candidates.map((c) => (
                    <label
                      key={c.id}
                      className={`flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm ${c.added ? 'opacity-60' : 'cursor-pointer hover:bg-slate-50'}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        disabled={c.added}
                        checked={c.added || selected.has(c.id)}
                        onChange={() => toggle(c.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block">{questionText(c)}</span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {[c.book_name, c.chapter_label].filter(Boolean).join(' · ') || 'Not linked to a book'}
                        </span>
                      </span>
                      {c.circular_count > 0 && (
                        <Badge variant="outline" className="shrink-0">
                          <FileText className="mr-1 h-3 w-3" />
                          {c.circular_count}
                        </Badge>
                      )}
                      {c.added && <Badge variant="secondary">Added</Badge>}
                    </label>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-base">
              In {areaInfo?.name_en ?? 'this area'} ({items.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {items.length === 0 ? (
              <p className="text-sm text-muted">No questions yet. Pick some on the left.</p>
            ) : (
              <div className="max-h-[640px] space-y-1.5 overflow-y-auto pr-1">
                {items.map((it) => (
                  <div key={it.link_id} className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm">
                    <span className="w-6 shrink-0 font-semibold text-primary">{it.number}.</span>
                    <span className="min-w-0 flex-1">
                      <span className="block">{questionText(it)}</span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {[it.book_name, it.chapter_label].filter(Boolean).join(' · ') || 'Not linked to a book'}
                      </span>
                    </span>
                    {it.circulars.length > 0 && (
                      <Badge variant="outline" className="shrink-0">
                        <FileText className="mr-1 h-3 w-3" />
                        {it.circulars.length}
                      </Badge>
                    )}
                    {!it.is_published && <Badge variant="warning">Draft</Badge>}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-1.5"
                      disabled={busy}
                      title="Remove from this area"
                      onClick={() => void remove(it)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
