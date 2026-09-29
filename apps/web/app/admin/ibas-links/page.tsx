'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Check, ExternalLink, Plus, Search, Trash2 } from 'lucide-react';
import type {
  CircularRecord,
  ContentLinkTargetType,
  IbasAreaRecord,
  IbasLinkRecord,
  PolicyBookItem,
} from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

const TYPE_LABEL: Record<ContentLinkTargetType, string> = {
  book_topic: 'Rule',
  book: 'Book',
  circular: 'Circular',
};

interface PickHit {
  id: string;
  title: string;
  subtitle?: string;
  snippet?: string;
}

function LinkRow({
  link,
  first,
  last,
  onChange,
}: {
  link: IbasLinkRecord;
  first: boolean;
  last: boolean;
  onChange: (links: IbasLinkRecord[]) => void;
}) {
  const [note, setNote] = useState(link.note ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => setNote(link.note ?? ''), [link.note]);

  async function call(method: 'PATCH' | 'DELETE', body?: object) {
    setBusy(true);
    setErr('');
    try {
      const r = await apiFetch<{ data: IbasLinkRecord[] }>(`/ibas/admin/links/${link.id}`, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      });
      onChange(r.data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  const href =
    link.target_type === 'circular' ? `/circulars/${link.target_id}` : link.target_type === 'book' ? `/books/${link.target_id}` : null;
  const missing = link.title === 'Missing item';

  return (
    <div className={cn('space-y-2 rounded-md border p-3', missing ? 'border-red-200 bg-red-50/50' : 'border-border')}>
      <div className="flex flex-wrap items-start gap-2">
        <Badge variant="outline">{TYPE_LABEL[link.target_type]}</Badge>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{link.title}</p>
          {link.subtitle && <p className="text-xs text-muted">{link.subtitle}</p>}
        </div>
        <div className="flex gap-1">
          {href && (
            <Button asChild variant="ghost" size="sm">
              <Link href={href} target="_blank" aria-label="Open">
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" disabled={busy || first} onClick={() => void call('PATCH', { move: 'up' })} aria-label="Move up">
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" disabled={busy || last} onClick={() => void call('PATCH', { move: 'down' })} aria-label="Move down">
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive" disabled={busy} onClick={() => void call('DELETE')} aria-label="Remove">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note shown in the drawer (e.g. “Use when the bill is returned by AO”)"
          maxLength={500}
          className="h-8 text-xs"
        />
        {note !== (link.note ?? '') && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void call('PATCH', { note })}>
            <Check className="h-4 w-4" /> Save
          </Button>
        )}
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}

export default function IbasLinksAdminPage() {
  const [areas, setAreas] = useState<IbasAreaRecord[]>([]);
  const [area, setArea] = useState('');
  const [links, setLinks] = useState<IbasLinkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [type, setType] = useState<ContentLinkTargetType>('book_topic');
  const [pickQ, setPickQ] = useState('');
  const [hits, setHits] = useState<PickHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [books, setBooks] = useState<PolicyBookItem[]>([]);
  const [newNote, setNewNote] = useState('');
  const [adding, setAdding] = useState<string | null>(null);

  const areaInfo = areas.find((a) => a.code === area);

  useEffect(() => {
    apiFetch<{ data: IbasAreaRecord[] }>('/ibas/admin/areas')
      .then((r) => {
        setAreas(r.data);
        const wanted = new URLSearchParams(window.location.search).get('area');
        setArea(r.data.find((a) => a.code === wanted)?.code ?? r.data.find((a) => a.is_active)?.code ?? r.data[0]?.code ?? '');
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load areas');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!area) return;
    setLoading(true);
    setError('');
    apiFetch<{ data: IbasLinkRecord[] }>(`/ibas/admin/links?area=${area}`)
      .then((r) => setLinks(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load links'))
      .finally(() => setLoading(false));
  }, [area]);

  useEffect(() => {
    apiFetch<{ data: PolicyBookItem[] }>('/policy/admin/books')
      .then((r) => setBooks(r.data))
      .catch(() => setBooks([]));
  }, []);

  useEffect(() => {
    setHits([]);
    const term = pickQ.trim();
    if (term.length < 2) return;
    if (type === 'book') {
      const t = term.toLowerCase();
      setHits(
        books
          .filter((b) => [b.name, b.name_bn, b.short_name].some((x) => x?.toLowerCase().includes(t)))
          .slice(0, 15)
          .map((b) => ({ id: b.id, title: b.name, subtitle: [b.book_type_name, b.name_bn].filter(Boolean).join(' · ') })),
      );
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      const req =
        type === 'book_topic'
          ? apiFetch<{ data: PickHit[] }>(`/ibas/admin/topic-search?q=${encodeURIComponent(term)}`).then((r) => r.data)
          : apiFetch<{ data: CircularRecord[] }>(`/circulars?include_unpublished=true&limit=15&q=${encodeURIComponent(term)}`).then((r) =>
              r.data.map((c) => ({ id: c.id, title: c.title, subtitle: `${c.circular_no}${c.is_published ? '' : ' · draft'}` })),
            );
      req
        .then(setHits)
        .catch(() => setHits([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [pickQ, type, books]);

  const linkedIds = useMemo(() => new Set(links.map((l) => `${l.target_type}:${l.target_id}`)), [links]);

  async function add(hit: PickHit) {
    setAdding(hit.id);
    setError('');
    try {
      const r = await apiFetch<{ data: IbasLinkRecord[] }>('/ibas/admin/links', {
        method: 'POST',
        body: JSON.stringify({ area_code: area, target_type: type, target_id: hit.id, note: newNote.trim() || undefined }),
      });
      setLinks(r.data);
      setNewNote('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add link');
    } finally {
      setAdding(null);
    }
  }

  const grouped = (['book_topic', 'book', 'circular'] as ContentLinkTargetType[]).map((t) => ({
    type: t,
    items: links.filter((l) => l.target_type === t),
  }));

  if (!areaInfo) {
    return (
      <div className="space-y-6">
        <PageHeader title="iBAS++ area links" />
        {error ? <Alert variant="error">{error}</Alert> : <p className="text-sm text-muted">Loading areas…</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="iBAS++ area links"
        description="Choose which rules, books and circulars appear in each area's drawer in the iBAS++ Workspace. Procedures come from published workflow tasks tagged with the area (or belonging to its module codes); circulars tagged with the area appear automatically."
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/ibas-areas">Manage areas</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/ibas?area=${area}`} target="_blank">
                <ExternalLink className="h-4 w-4" /> Preview drawer
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {areas.map((a) => (
          <button
            key={a.code}
            type="button"
            onClick={() => setArea(a.code)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
              area === a.code ? 'border-transparent text-white' : 'border-border text-muted hover:bg-slate-50',
            )}
            style={area === a.code ? { backgroundColor: a.color } : undefined}
          >
            {a.name_en}
            {!a.is_active && <span className="ml-1 text-xs opacity-75">(hidden)</span>}
          </button>
        ))}
      </div>

      <Alert variant="info">
        <span className="font-medium">{areaInfo.name_en}</span> — access code <code>{areaInfo.code}</code>
        {areaInfo.legacy_codes.length > 0 && (
          <>
            ; also opens for users with <code>{areaInfo.legacy_codes.join(', ')}</code>, and shows workflow tasks of those modules
          </>
        )}
        . {areaInfo.usage.tagged_tasks} workflow task{areaInfo.usage.tagged_tasks === 1 ? '' : 's'} tagged directly.
      </Alert>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" /> Add to {areaInfo.name_en}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="link-type">Type</Label>
              <select
                id="link-type"
                className={selectClass}
                value={type}
                onChange={(e) => {
                  setType(e.target.value as ContentLinkTargetType);
                  setPickQ('');
                }}
              >
                <option value="book_topic">Rule (from the rule library)</option>
                <option value="book">Whole book</option>
                <option value="circular">Circular</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link-note">Note (optional)</Label>
              <Input id="link-note" value={newNote} onChange={(e) => setNewNote(e.target.value)} maxLength={500} />
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                value={pickQ}
                onChange={(e) => setPickQ(e.target.value)}
                placeholder={type === 'book_topic' ? 'Rule number, title or text…' : type === 'book' ? 'Book name…' : 'Circular no. or title…'}
                className="pl-9"
              />
            </div>
            {searching && <p className="text-xs text-muted">Searching…</p>}
            {!searching && pickQ.trim().length >= 2 && hits.length === 0 && <p className="text-xs text-muted">No matches.</p>}
            <div className="max-h-[420px] space-y-1.5 overflow-y-auto">
              {hits.map((h) => {
                const already = linkedIds.has(`${type}:${h.id}`);
                return (
                  <div key={h.id} className="flex items-start gap-2 rounded-md border border-border p-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{h.title}</p>
                      {h.subtitle && <p className="text-xs text-muted">{h.subtitle}</p>}
                      {h.snippet && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{h.snippet}</p>}
                    </div>
                    <Button size="sm" variant={already ? 'ghost' : 'outline'} disabled={already || adding === h.id} onClick={() => void add(h)}>
                      {already ? 'Linked' : adding === h.id ? '…' : 'Add'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Linked content ({links.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {loading ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : links.length === 0 ? (
              <p className="text-sm text-muted">Nothing linked yet. Search on the left and click “Add”.</p>
            ) : (
              grouped
                .filter((g) => g.items.length > 0)
                .map((g) => (
                  <div key={g.type} className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">{TYPE_LABEL[g.type]}s</p>
                    {g.items.map((l) => {
                      const idx = links.findIndex((x) => x.id === l.id);
                      return <LinkRow key={l.id} link={l} first={idx === 0} last={idx === links.length - 1} onChange={setLinks} />;
                    })}
                  </div>
                ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
