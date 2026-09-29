'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Flame,
  Lock,
  MessageSquare,
  MessagesSquare,
  Pin,
  Plus,
  Search,
  Trophy,
  X,
  Droplet,
} from 'lucide-react';
import {
  COMMUNITY_SORTS,
  COMMUNITY_SORT_LABELS,
  type CommunityFilter,
  type CommunityOverview,
  type CommunitySort,
  type CommunityThreadSummary,
} from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { timeAgo } from '@/lib/community';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/shared/empty-state';
import { LinkKindIcons } from '@/components/community/link-chips';
import { Avatar, AuthorName, AuthorWork } from '@/components/community/community-bits';

const FILTER_LABELS: Record<CommunityFilter, string> = {
  all: 'All discussions',
  following: 'Following',
  mine: 'My posts',
  solved: 'Solved',
  unsolved: 'Needs an answer',
};

const LINK_FILTERS = [
  { value: '', label: 'Any tag' },
  { value: 'task', label: 'Tagged workflow' },
  { value: 'toolkit', label: 'Tagged toolkit / checklist' },
  { value: 'circular', label: 'Tagged circular' },
] as const;

const PAGE_SIZE = 20;

function ThreadCard({ t }: { t: CommunityThreadSummary }) {
  return (
    <Link
      href={`/community/${t.id}`}
      className={cn(
        'group flex gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md',
        t.is_pinned && 'border-primary/30 bg-primary-muted/40',
        t.is_hidden && 'opacity-70',
      )}
    >
      <div className="hidden w-16 shrink-0 flex-col items-center gap-2 text-center sm:flex">
        <div className="text-sm">
          <div className="text-lg font-bold leading-none">{t.vote_score}</div>
          <div className="text-[11px] text-muted">votes</div>
        </div>
        <div
          className={cn(
            'w-full rounded-lg border px-1 py-1 text-sm',
            t.is_solved ? 'border-success bg-success text-white' : t.answer_count > 0 ? 'border-success/40 text-success' : 'border-border text-muted',
          )}
        >
          <div className="flex items-center justify-center gap-1 font-bold leading-none">
            {t.is_solved && <CheckCircle2 className="h-3.5 w-3.5" />}
            {t.answer_count}
          </div>
          <div className="text-[11px]">{t.answer_count === 1 ? 'answer' : 'answers'}</div>
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {t.is_pinned && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 font-semibold text-white">
              <Pin className="h-3 w-3" /> Pinned
            </span>
          )}
          {t.category && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2 py-0.5 font-medium">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.category.color }} />
              {t.category.name}
            </span>
          )}
          {t.is_locked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
              <Lock className="h-3 w-3" /> Locked
            </span>
          )}
          {t.is_hidden && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive-light px-2 py-0.5 font-medium text-destructive">
              <EyeOff className="h-3 w-3" /> Hidden
            </span>
          )}
          {t.is_solved && (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-light px-2 py-0.5 font-medium text-success sm:hidden">
              <CheckCircle2 className="h-3 w-3" /> Solved
            </span>
          )}
        </div>

        <h3 className="text-base font-semibold leading-snug text-foreground group-hover:text-primary-dark">{t.title}</h3>
        {t.excerpt && <p className="line-clamp-2 text-sm text-muted">{t.excerpt}</p>}

        {(t.tags.length > 0 || t.link_kinds.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5">
            <LinkKindIcons kinds={t.link_kinds} />
            {t.tags.map((tag) => (
              <span key={tag} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700">
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-xs text-muted">
          <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
            <Avatar author={t.author} size="sm" />
            <AuthorName author={t.author} />
            <AuthorWork author={t.author} short className="max-w-[16rem]" />
          </span>
          <span>asked {timeAgo(t.created_at)}</span>
          {t.last_answer_by && t.answer_count > 0 && (
            <span>
              · last answer by <span className="font-medium text-foreground">{t.last_answer_by}</span> {timeAgo(t.last_activity_at)}
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-3">
            <span className="inline-flex items-center gap-1 sm:hidden">
              <MessageSquare className="h-3.5 w-3.5" /> {t.answer_count}
            </span>
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" /> {t.view_count}
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}

function Sidebar({ overview, activeCategory, onCategory, onTag }: { overview: CommunityOverview | null; activeCategory: string; onCategory: (id: string) => void; onTag: (t: string) => void }) {
  if (!overview) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold">Categories</h2>
        <div className="space-y-0.5">
          {overview.categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onCategory(activeCategory === c.id ? '' : c.id)}
              className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50', activeCategory === c.id && 'bg-slate-100 font-medium')}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <span className="text-xs text-muted">{c.thread_count}</span>
            </button>
          ))}
        </div>
      </section>

      {overview.trending_tags.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Flame className="h-4 w-4 text-orange-500" /> Trending tags
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {overview.trending_tags.map((t) => (
              <button key={t.tag} type="button" onClick={() => onTag(t.tag)} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-primary-light hover:text-primary-dark">
                #{t.tag} <span className="text-muted">{t.count}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {overview.top_contributors.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <Trophy className="h-4 w-4 text-amber-500" /> Top helpers
          </h2>
          <ul className="space-y-2.5">
            {overview.top_contributors.map((a) => (
              <li key={a.id} className="flex items-center gap-2.5 text-sm">
                <Avatar author={a} size="sm" />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate">
                    <AuthorName author={a} />
                  </span>
                  <AuthorWork author={a} short className="block text-xs" />
                </span>
                <span className="text-xs text-muted" title={`${a.answers} answers · ${a.accepted} accepted`}>
                  {a.answers} <MessageSquare className="inline h-3 w-3" />
                  {a.accepted > 0 && (
                    <>
                      {' '}
                      {a.accepted} <CheckCircle2 className="inline h-3 w-3 text-success" />
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-dashed border-border p-4 text-xs leading-relaxed text-muted">
        <p className="mb-1 font-semibold text-foreground">Community guidelines</p>
        Be respectful, share sources, and tag the related workflow, checklist or circular so others can follow along. Never post passwords, NID numbers or confidential data.
      </section>
    </div>
  );
}

export function CommunityBrowser() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const tag = params.get('tag') ?? '';
  const sort = (params.get('sort') as CommunitySort) || 'active';
  const filter = (params.get('filter') as CommunityFilter) || 'all';
  const linkType = params.get('link_type') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [search, setSearch] = useState(q);
  const [items, setItems] = useState<CommunityThreadSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState<CommunityOverview | null>(null);

  useEffect(() => setSearch(q), [q]);

  const setParams = useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      if (!('page' in patch)) next.delete('page');
      const s = next.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  useEffect(() => {
    apiFetch<{ data: CommunityOverview }>('/community/overview')
      .then((r) => setOverview(r.data))
      .catch(() => setOverview(null));
  }, []);

  useEffect(() => {
    let alive = true;
    setItems(null);
    setError('');
    const sp = new URLSearchParams({ sort, filter, page: String(page), limit: String(PAGE_SIZE) });
    if (q) sp.set('q', q);
    if (category) sp.set('category', category);
    if (tag) sp.set('tag', tag);
    if (linkType) sp.set('link_type', linkType);
    apiFetch<{ data: CommunityThreadSummary[]; meta: { total: number } }>(`/community/threads?${sp.toString()}`)
      .then((r) => {
        if (!alive) return;
        setItems(r.data);
        setTotal(r.meta.total);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Could not load discussions');
        setItems([]);
      });
    return () => {
      alive = false;
    };
  }, [q, category, tag, sort, filter, linkType, page]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(q || category || tag || linkType || filter !== 'all');
  const activeCat = overview?.categories.find((c) => c.id === category);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-700 via-teal-600 to-sky-700 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-sky-300/20 blur-2xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">
              <MessagesSquare className="h-3.5 w-3.5" /> Community
            </p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Ask, share and learn together</h1>
            <p className="max-w-xl text-sm text-white/85">
              Discuss what&apos;s new — circulars, iBAS++ changes, bills, pension and exams. Tag the related workflow, checklist or circular so answers point to the right source.
            </p>
            {overview && (
              <div className="flex flex-wrap gap-4 pt-1 text-sm">
                <span>
                  <strong className="text-lg">{overview.stats.threads}</strong> <span className="text-white/80">discussions</span>
                </span>
                <span>
                  <strong className="text-lg">{overview.stats.answers}</strong> <span className="text-white/80">answers</span>
                </span>
                <span>
                  <strong className="text-lg">{overview.stats.solved}</strong> <span className="text-white/80">solved</span>
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="lg" className="bg-white text-teal-800 shadow-md hover:bg-teal-50">
              <Link href="/community/new">
                <Plus className="h-4 w-4" /> Start a discussion
              </Link>
            </Button>
            <Button asChild size="lg" className="bg-red-600 text-white shadow-md hover:bg-red-700">
              <Link href="/community/blood-bank">
                <Droplet className="h-4 w-4 fill-white" /> Blood bank
              </Link>
            </Button>
          </div>
        </div>
        <form
          className="relative mt-5"
          onSubmit={(e) => {
            e.preventDefault();
            setParams({ q: search.trim() });
          }}
        >
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search discussions, e.g. “GPF advance”, “bill return”, “প্রজ্ঞাপন”…"
            className="h-12 w-full rounded-xl border-0 bg-white pl-12 pr-24 text-[15px] text-foreground shadow-md outline-none placeholder:text-slate-400 focus:ring-4 focus:ring-white/30"
          />
          <Button type="submit" size="sm" className="absolute right-2 top-1/2 -translate-y-1/2">
            Search
          </Button>
        </form>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <button
              type="button"
              onClick={() => setParams({ category: '' })}
              className={cn('shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition', !category ? 'border-foreground bg-foreground text-white' : 'border-border bg-surface hover:bg-slate-50')}
            >
              All topics
            </button>
            {overview?.categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setParams({ category: category === c.id ? '' : c.id })}
                className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition', category === c.id ? 'border-transparent text-white' : 'border-border bg-surface hover:bg-slate-50')}
                style={category === c.id ? { backgroundColor: c.color } : undefined}
              >
                {category !== c.id && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />}
                {c.name}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-2 shadow-sm sm:flex-row sm:items-center">
            <div className="flex flex-1 gap-1 overflow-x-auto">
              {COMMUNITY_SORTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setParams({ sort: s === 'active' ? '' : s })}
                  className={cn('shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition', sort === s ? 'bg-primary-muted text-primary-dark' : 'text-muted hover:bg-slate-50 hover:text-foreground')}
                >
                  {COMMUNITY_SORT_LABELS[s]}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <select aria-label="Filter" value={filter} onChange={(e) => setParams({ filter: e.target.value === 'all' ? '' : e.target.value })} className="ibas-select h-9 w-auto min-w-[9.5rem]">
                {(Object.keys(FILTER_LABELS) as CommunityFilter[]).map((f) => (
                  <option key={f} value={f}>
                    {FILTER_LABELS[f]}
                  </option>
                ))}
              </select>
              <select aria-label="Tagged item" value={linkType} onChange={(e) => setParams({ link_type: e.target.value })} className="ibas-select h-9 w-auto min-w-[9.5rem]">
                {LINK_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {hasFilters && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">
                {items ? `${total} result${total === 1 ? '' : 's'}` : 'Searching…'}
              </span>
              {q && <FilterChip label={`“${q}”`} onClear={() => setParams({ q: '' })} />}
              {activeCat && <FilterChip label={activeCat.name} onClear={() => setParams({ category: '' })} />}
              {tag && <FilterChip label={`#${tag}`} onClear={() => setParams({ tag: '' })} />}
              {linkType && <FilterChip label={LINK_FILTERS.find((f) => f.value === linkType)?.label ?? linkType} onClear={() => setParams({ link_type: '' })} />}
              {filter !== 'all' && <FilterChip label={FILTER_LABELS[filter]} onClear={() => setParams({ filter: '' })} />}
              <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => router.replace(pathname, { scroll: false })}>
                Clear all
              </button>
            </div>
          )}

          {error && <Alert variant="error">{error}</Alert>}

          {items === null ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-2xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title={hasFilters ? 'No discussions match' : 'No discussions yet'}
              description={hasFilters ? 'Try another word or clear the filters.' : 'Be the first — ask a question or share something new with colleagues.'}
              action={
                <Button asChild>
                  <Link href="/community/new">
                    <Plus className="h-4 w-4" /> Start a discussion
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {items.map((t) => (
                <ThreadCard key={t.id} t={t} />
              ))}
            </div>
          )}

          {pages > 1 && items && items.length > 0 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setParams({ page: String(page - 1) })}>
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <span className="px-2 text-sm text-muted">
                Page {page} of {pages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setParams({ page: String(page + 1) })}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Sidebar overview={overview} activeCategory={category} onCategory={(id) => setParams({ category: id })} onTag={(t) => setParams({ tag: t })} />
        </aside>
      </div>
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-2.5 pr-1 text-xs font-medium">
      {label}
      <button type="button" onClick={onClear} className="rounded-full p-0.5 hover:bg-slate-200" aria-label={`Clear ${label}`}>
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
