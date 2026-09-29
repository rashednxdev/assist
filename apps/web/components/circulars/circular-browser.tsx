'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, ClipboardCheck, FileText, Search, Tag } from 'lucide-react';
import { CIRCULAR_DOC_TYPES, CIRCULAR_ISSUERS, POLICY_COLLECTIONS } from '@ibas/shared-constants';
import type { CircularFacets, CircularRecord, CircularTagCount } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { formatDdMmYyyy } from '@/lib/date-display';
import { collectionName, docTypeLabel, issuerLabel } from '@/lib/policy-labels';
import { useIbasAreas } from '@/lib/use-ibas-areas';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { SortToggle, type CircularSort } from './sort-toggle';

const PAGE_SIZE = 20;
const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

interface Filters {
  q: string;
  issuer: string;
  doc_type: string;
  collection: string;
  area: string;
  year: string;
  tag: string;
}

const FILTER_KEYS: Array<keyof Filters> = ['q', 'issuer', 'doc_type', 'collection', 'area', 'year', 'tag'];

/** Who issued it, most specific first: "Finance Division · Budget-1 Wing". */
export function circularIssuedBy(c: Pick<CircularRecord, 'issuer' | 'ministry' | 'department' | 'issuer_detail'>): string {
  const parts = [c.ministry, c.department, c.issuer_detail].filter(Boolean) as string[];
  return parts.length ? parts.join(' · ') : issuerLabel(c.issuer);
}

function TagCloud({
  tags,
  active,
  onPick,
}: {
  tags: CircularTagCount[];
  active: string;
  onPick: (tag: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [allTags, setAllTags] = useState<CircularTagCount[] | null>(null);
  const [tagQ, setTagQ] = useState('');

  useEffect(() => {
    if (!showAll || allTags) return;
    apiFetch<{ data: CircularTagCount[] }>('/circulars/tags?limit=500')
      .then((r) => setAllTags(r.data))
      .catch(() => setAllTags([]));
  }, [showAll, allTags]);

  const list = useMemo(() => {
    const source = showAll ? (allTags ?? tags) : tags.slice(0, 20);
    const term = tagQ.trim().toLowerCase();
    return term ? source.filter((t) => t.tag.toLowerCase().includes(term)) : source;
  }, [showAll, allTags, tags, tagQ]);

  if (tags.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
          <Tag className="h-3.5 w-3.5" /> Tags
        </span>
        {showAll && (
          <Input value={tagQ} onChange={(e) => setTagQ(e.target.value)} placeholder="Find a tag…" className="h-7 w-44 text-xs" />
        )}
        <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show popular only' : 'Show all tags'}
        </button>
      </div>
      <div className={showAll ? 'flex max-h-52 flex-wrap gap-1.5 overflow-y-auto' : 'flex flex-wrap gap-1.5'}>
        {list.map((t) => (
          <button
            key={t.tag}
            type="button"
            onClick={() => onPick(active === t.tag ? '' : t.tag)}
            className={
              active === t.tag
                ? 'rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-white'
                : 'rounded-full border border-border px-2.5 py-0.5 text-xs text-muted hover:bg-slate-50'
            }
          >
            #{t.tag} <span className="opacity-70">{t.count}</span>
          </button>
        ))}
        {list.length === 0 && <span className="text-xs text-muted">No matching tags.</span>}
      </div>
    </div>
  );
}

/**
 * Searchable, filterable circular list used by the Circular Archive and the Books & Tools
 * "Circulars & orders" tab. Initial filters come from the URL (?tag=, ?area=, …).
 */
export function CircularBrowser({ detailHref = (id: string) => `/circulars/${id}` }: { detailHref?: (id: string) => string }) {
  const params = useSearchParams();
  const [filters, setFilters] = useState<Filters>(
    () => Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? ''])) as unknown as Filters,
  );
  const [sort, setSort] = useState<CircularSort>(params.get('sort') === 'oldest' ? 'oldest' : 'newest');
  const [qInput, setQInput] = useState(filters.q);
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<CircularRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<CircularFacets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { activeAreas, areaName } = useIbasAreas();

  useEffect(() => {
    apiFetch<{ data: CircularFacets }>('/circulars/facets')
      .then((r) => setFacets(r.data))
      .catch(() => setFacets(null));
  }, []);

  useEffect(() => {
    const qs = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset), sort });
    for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v);
    setLoading(true);
    setError('');
    apiFetch<{ data: CircularRecord[]; meta: { total: number } }>(`/circulars?${qs}`)
      .then((r) => {
        setItems(r.data);
        setTotal(r.meta.total);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load circulars'))
      .finally(() => setLoading(false));
  }, [filters, offset, sort]);

  function update(patch: Partial<Filters>) {
    setOffset(0);
    setFilters((f) => ({ ...f, ...patch }));
  }

  const activeFilters = Object.entries(filters).filter(([k, v]) => v && k !== 'q');
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              update({ q: qInput.trim() });
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="Search by order no., subject, ministry, wing, signed by, tag…"
                className="pl-9"
              />
            </div>
            <Button type="submit">Search</Button>
          </form>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <select className={selectClass} value={filters.issuer} onChange={(e) => update({ issuer: e.target.value })}>
              <option value="">All issuers</option>
              {CIRCULAR_ISSUERS.map((i) => (
                <option key={i.code} value={i.code}>{i.label}</option>
              ))}
            </select>
            <select className={selectClass} value={filters.doc_type} onChange={(e) => update({ doc_type: e.target.value })}>
              <option value="">All document types</option>
              {CIRCULAR_DOC_TYPES.map((d) => (
                <option key={d.code} value={d.code}>{d.label}</option>
              ))}
            </select>
            <select className={selectClass} value={filters.collection} onChange={(e) => update({ collection: e.target.value })}>
              <option value="">All collections</option>
              {POLICY_COLLECTIONS.map((c) => (
                <option key={c.code} value={c.code}>{c.name_en}</option>
              ))}
            </select>
            <select className={selectClass} value={filters.area} onChange={(e) => update({ area: e.target.value })}>
              <option value="">All iBAS++ areas</option>
              {activeAreas.map((a) => (
                <option key={a.code} value={a.code}>{a.name_en}</option>
              ))}
            </select>
            <select className={selectClass} value={filters.year} onChange={(e) => update({ year: e.target.value })}>
              <option value="">All years</option>
              {(facets?.years ?? []).map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </div>
          {facets && <TagCloud tags={facets.tags} active={filters.tag} onPick={(tag) => update({ tag })} />}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>Filtered by:</span>
              {activeFilters.map(([k, v]) => (
                <Badge key={k} variant="secondary">
                  {k === 'issuer'
                    ? issuerLabel(v)
                    : k === 'doc_type'
                      ? docTypeLabel(v)
                      : k === 'collection'
                        ? collectionName(v)
                        : k === 'area'
                          ? areaName(v)
                          : k === 'tag'
                            ? `#${v}`
                            : v}
                </Badge>
              ))}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => {
                  setQInput('');
                  update({ q: '', issuer: '', doc_type: '', collection: '', area: '', year: '', tag: '' });
                }}
              >
                Clear all
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : !error && items.length === 0 ? (
        <EmptyState
          title="No circulars found"
          description={activeFilters.length || filters.q ? 'Try removing some filters.' : 'Circulars will appear here once the admin publishes them.'}
        />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">
              {total} circular{total === 1 ? '' : 's'}
            </p>
            <SortToggle
              value={sort}
              onChange={(s) => {
                setOffset(0);
                setSort(s);
              }}
            />
          </div>
          {items.map((c) => (
            <Card key={c.id} className="transition-shadow hover:shadow-md">
              <CardContent className="flex gap-4 pt-5">
                <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 sm:flex">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className="font-mono font-medium text-foreground">{c.circular_no}</span>
                    <span>·</span>
                    <span>{formatDdMmYyyy(c.issue_date)}</span>
                    <span>·</span>
                    <span>{circularIssuedBy(c)}</span>
                    <Badge variant="outline">{docTypeLabel(c.doc_type)}</Badge>
                    {c.checklist_count > 0 && (
                      <Badge variant="secondary" className="gap-1">
                        <ClipboardCheck className="h-3 w-3" /> Checklist
                      </Badge>
                    )}
                    {!c.is_published && <Badge variant="warning">Draft</Badge>}
                    {c.superseded_by.length > 0 && <Badge variant="destructive">Superseded</Badge>}
                  </div>
                  <Link href={detailHref(c.id)} className="block font-semibold text-foreground hover:text-primary hover:underline">
                    {c.title}
                  </Link>
                  {c.title_bn && <p className="text-sm text-muted">{c.title_bn}</p>}
                  {c.order_by && (
                    <p className="text-xs text-muted">
                      Signed by {c.order_by}
                      {c.order_by_designation ? `, ${c.order_by_designation}` : ''}
                    </p>
                  )}
                  {c.summary && <p className="line-clamp-2 text-sm text-muted">{c.summary}</p>}
                  {(c.collections.length > 0 || c.areas.length > 0 || c.tags.length > 0) && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {c.collections.map((code) => (
                        <Badge key={code} variant="secondary">{collectionName(code)}</Badge>
                      ))}
                      {c.areas.map((code) => (
                        <button key={code} type="button" onClick={() => update({ area: code })}>
                          <Badge variant="outline">{areaName(code)}</Badge>
                        </button>
                      ))}
                      {c.tags.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => update({ tag: t })}
                          className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 hover:bg-indigo-100"
                        >
                          #{t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <span className="text-sm text-muted">
                Page {page} of {pages}
              </span>
              <Button variant="outline" disabled={page >= pages} onClick={() => setOffset(offset + PAGE_SIZE)}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
