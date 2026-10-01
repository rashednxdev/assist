'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Lock, PauseCircle, Search } from 'lucide-react';
import { TOOLKIT_KINDS, type ToolkitKind } from '@ibas/shared-constants';
import type { ToolkitItemSummary } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { fetchMe } from '@/lib/auth';
import { toolkitKindLabel } from '@/lib/policy-labels';
import { useToolkitCategories } from '@/lib/use-toolkit-categories';
import { useIbasAreas } from '@/lib/use-ibas-areas';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AccessRequiredDialog, type AccessRequiredVariant } from '@/components/dashboard/access-required-dialog';
import { ToolkitKindIcon } from '@/components/toolkit/kind-icon';

const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

function sizeLabel(item: ToolkitItemSummary) {
  const unit = item.kind === 'checklist' ? 'item' : item.kind === 'template' ? 'field' : 'section';
  return `${item.size} ${unit}${item.size === 1 ? '' : 's'}`;
}

function ToolkitHub() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const kind = (params.get('kind') ?? '') as ToolkitKind | '';
  const area = params.get('area') ?? '';
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<ToolkitItemSummary[] | null>(null);
  const [error, setError] = useState('');
  const [unpaidMessage, setUnpaidMessage] = useState<string | undefined>();
  const [dialog, setDialog] = useState<{ variant: AccessRequiredVariant; title: string; reason?: string } | null>(null);
  const { activeAreas, areaName } = useIbasAreas();
  const { forKind } = useToolkitCategories();

  useEffect(() => {
    fetchMe()
      .then((r) => setUnpaidMessage(r.data.unpaid_message))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (kind) qs.set('kind', kind);
    if (area) qs.set('area', area);
    setItems(null);
    setError('');
    apiFetch<{ data: ToolkitItemSummary[] }>(`/toolkit?${qs}`)
      .then((r) => setItems(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load the toolkit'));
  }, [kind, area]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    setCategory('');
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
  }

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (items ?? []).filter(
      (i) =>
        (!category || i.category === category) &&
        (!term || [i.title, i.title_bn, i.summary, ...i.tags].some((t) => t?.toLowerCase().includes(term))),
    );
  }, [items, category, q]);

  const categories = kind ? forKind(kind) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Toolkit"
        description="Ready-to-use checklists, fill-in templates and step-by-step guides for iBAS++ work: pre-audit, bill scrutiny, audit broadsheet replies, cash book and more."
      />

      <div className="flex flex-wrap gap-2">
        {[{ code: '' as const, label_plural: 'All' }, ...TOOLKIT_KINDS].map((k) => (
          <button
            key={k.code || 'all'}
            type="button"
            onClick={() => setParam('kind', k.code)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              kind === k.code ? 'bg-primary text-white' : 'border border-border text-muted hover:bg-slate-50',
            )}
          >
            {k.label_plural}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by title or tag…" className="pl-9" />
        </div>
        <select className={selectClass} value={area} onChange={(e) => setParam('area', e.target.value)}>
          <option value="">All iBAS++ areas</option>
          {activeAreas.map((a) => (
            <option key={a.code} value={a.code}>{a.name_en}</option>
          ))}
        </select>
        <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value)} disabled={!kind}>
          <option value="">{kind ? 'All categories' : 'Pick a type to filter by category'}</option>
          {categories.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {!items && !error ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : visible.length === 0 && !error ? (
        <EmptyState
          title="Nothing here yet"
          description={items?.length ? 'No items match these filters.' : 'Checklists, templates and guides will appear here once the admin publishes them.'}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((item) => {
            const locked = item.access !== 'open';
            const content = (
              <Card className={cn('h-full transition-shadow hover:shadow-md', locked && 'opacity-80')}>
                <CardContent className="flex gap-4 pt-5">
                  <ToolkitKindIcon kind={item.kind} />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="font-medium text-foreground">{toolkitKindLabel(item.kind)}</span>
                      <span>·</span>
                      <span>{item.category_label}</span>
                      <span>·</span>
                      <span>{sizeLabel(item)}</span>
                      {item.access === 'stopped' ? (
                        <PauseCircle className="h-3.5 w-3.5 text-amber-600" />
                      ) : locked ? (
                        <Lock className="h-3.5 w-3.5" />
                      ) : null}
                    </div>
                    <p className="font-semibold text-foreground">{item.title}</p>
                    {item.title_bn && <p className="text-sm text-muted">{item.title_bn}</p>}
                    {item.summary && <p className="line-clamp-2 text-sm text-muted">{item.summary}</p>}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {item.areas.map((a) => (
                        <Badge key={a} variant="outline">{areaName(a)}</Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
            return locked ? (
              <button
                key={item.id}
                type="button"
                className="text-left"
                onClick={() =>
                  setDialog({ variant: item.access as AccessRequiredVariant, title: item.title, reason: item.stopped_reason })
                }
              >
                {content}
              </button>
            ) : (
              <Link key={item.id} href={`/toolkit/${item.id}`}>
                {content}
              </Link>
            );
          })}
        </div>
      )}

      {dialog && (
        <AccessRequiredDialog
          variant={dialog.variant}
          moduleTitle={dialog.title}
          stoppedReason={dialog.reason}
          unpaidMessage={unpaidMessage}
          packageTab="basic"
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

export default function ToolkitPage() {
  return (
    <Suspense fallback={<Skeleton className="h-32 w-full" />}>
      <ToolkitHub />
    </Suspense>
  );
}
