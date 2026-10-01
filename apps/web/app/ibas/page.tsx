'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Archive,
  BookOpen,
  BookOpenCheck,
  Briefcase,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FileSignature,
  Lock,
  PauseCircle,
  Route,
  Scale,
  Search,
  Wrench,
  X,
} from 'lucide-react';
import type { IbasAreaDetail, IbasAreaSummary } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { fetchMe } from '@/lib/auth';
import { formatDdMmYyyy } from '@/lib/date-display';
import { issuerLabel } from '@/lib/policy-labels';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AccessRequiredDialog, type AccessRequiredVariant } from '@/components/dashboard/access-required-dialog';
import { SortToggle } from '@/components/circulars/sort-toggle';

type Tab = 'procedures' | 'checklists' | 'templates' | 'guides' | 'rules' | 'circulars' | 'tools';

const KIT_TAB_KIND = { checklists: 'checklist', templates: 'template', guides: 'guide' } as const;

const TABS: Array<{ id: Tab; label: string; icon: typeof Route }> = [
  { id: 'procedures', label: 'Procedures', icon: Route },
  { id: 'checklists', label: 'Checklists', icon: ClipboardCheck },
  { id: 'templates', label: 'Templates', icon: FileSignature },
  { id: 'guides', label: 'Guides', icon: BookOpenCheck },
  { id: 'rules', label: 'Rules', icon: Scale },
  { id: 'circulars', label: 'Circulars', icon: Archive },
  { id: 'tools', label: 'Tools', icon: Wrench },
];

function isKitTab(t: Tab): t is keyof typeof KIT_TAB_KIND {
  return t in KIT_TAB_KIND;
}

function DrawerLink({ href, title, subtitle, meta, note }: { href: string; title: string; subtitle?: string; meta?: React.ReactNode; note?: string }) {
  return (
    <Link href={href} className="block rounded-lg border border-border p-3 transition-colors hover:border-primary/40 hover:bg-slate-50">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {subtitle && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{subtitle}</p>}
          {meta && <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">{meta}</div>}
          {note && <p className="mt-1.5 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">{note}</p>}
        </div>
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
      </div>
    </Link>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted">{children}</p>;
}

function tabCount(d: IbasAreaDetail, t: Tab): number {
  if (t === 'rules') return d.rules.length + d.collection_books.length;
  if (isKitTab(t)) return d.toolkit.filter((k) => k.kind === KIT_TAB_KIND[t]).length;
  return d[t].length;
}

const KIT_EMPTY: Record<keyof typeof KIT_TAB_KIND, string> = {
  checklists: 'No checklists for this area yet.',
  templates: 'No templates for this area yet.',
  guides: 'No guides for this area yet.',
};

function AreaDrawer({ code, onClose }: { code: string; onClose: () => void }) {
  const [detail, setDetail] = useState<IbasAreaDetail | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('procedures');
  const [circularSort, setCircularSort] = useState<'newest' | 'oldest'>('newest');

  useEffect(() => {
    setDetail(null);
    setError('');
    setTab('procedures');
    apiFetch<{ data: IbasAreaDetail }>(`/ibas/areas/${code}`)
      .then((r) => {
        setDetail(r.data);
        const first = TABS.map((t) => t.id).find((t) => tabCount(r.data, t) > 0);
        if (first) setTab(first);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load this area'));
  }, [code]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const count = (t: Tab) => (detail ? tabCount(detail, t) : 0);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-surface shadow-2xl">
        <div className="border-b border-border px-5 py-4" style={detail ? { borderTop: `4px solid ${detail.color}` } : undefined}>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">iBAS++ area</p>
              <h2 className="text-lg font-bold text-foreground">{detail?.name_en ?? '…'}</h2>
              {detail && <p className="text-sm text-muted">{detail.name_bn}</p>}
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-slate-100" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
          {detail && <p className="mt-2 text-sm text-muted">{detail.description_en}</p>}
          <div className="mt-4 flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  tab === t.id ? 'bg-primary text-white' : 'text-muted hover:bg-slate-100 hover:text-foreground',
                )}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
                {detail && (
                  <span className={cn('rounded-full px-1.5 text-xs', tab === t.id ? 'bg-white/20' : 'bg-slate-100')}>{count(t.id)}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-5">
          {error && <Alert variant="error">{error}</Alert>}
          {!detail && !error && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}

          {detail && tab === 'procedures' &&
            (detail.procedures.length === 0 ? (
              <Empty>No step-by-step procedures published for this area yet.</Empty>
            ) : (
              detail.procedures.map((p) => (
                <DrawerLink
                  key={p.id}
                  href={p.href}
                  title={p.name_en}
                  subtitle={p.name_bn || p.description_en}
                  meta={
                    <>
                      <span>{p.total_steps} step{p.total_steps === 1 ? '' : 's'}</span>
                      {p.estimated_time ? (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> ~{p.estimated_time} min
                        </span>
                      ) : null}
                    </>
                  }
                />
              ))
            ))}

          {detail && isKitTab(tab) && (() => {
            const kits = detail.toolkit.filter((k) => k.kind === KIT_TAB_KIND[tab]);
            return (
              <>
                {kits.length === 0 ? (
                  <Empty>{KIT_EMPTY[tab]}</Empty>
                ) : (
                  kits.map((k) => (
                    <DrawerLink
                      key={k.id}
                      href={`/toolkit/${k.id}`}
                      title={k.title}
                      subtitle={k.summary || k.title_bn}
                      meta={<span>{k.category_label}</span>}
                    />
                  ))
                )}
                <Link
                  href={`/toolkit?kind=${KIT_TAB_KIND[tab]}&area=${code}`}
                  className="inline-flex items-center gap-1 pt-2 text-sm font-medium text-primary hover:underline"
                >
                  Open in Toolkit <ChevronRight className="h-4 w-4" />
                </Link>
              </>
            );
          })()}

          {detail && tab === 'rules' && (
            <>
              {detail.rules.length === 0 && detail.collection_books.length === 0 && (
                <Empty>No rules have been linked to this area yet.</Empty>
              )}
              {detail.rules.map((r) => (
                <DrawerLink
                  key={r.link_id ?? r.id}
                  href={r.href}
                  title={r.title}
                  subtitle={r.snippet}
                  meta={r.subtitle ? <span>{r.subtitle}</span> : undefined}
                  note={r.note}
                />
              ))}
              {detail.collection_books.length > 0 && (
                <div className="space-y-2 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">Related books</p>
                  {detail.collection_books.map((b) => (
                    <Link key={b.id} href={b.href} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-slate-50">
                      <BookOpen className="h-4 w-4 shrink-0 text-muted" />
                      <span className="min-w-0 flex-1 truncate">{b.name}</span>
                      <ChevronRight className="h-4 w-4 text-muted" />
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}

          {detail && tab === 'circulars' && (
            <>
              {detail.circulars.length > 1 && (
                <div className="flex items-center justify-between pb-1 text-xs text-muted">
                  <span>{detail.circulars.length} circulars</span>
                  <SortToggle value={circularSort} onChange={setCircularSort} />
                </div>
              )}
              {detail.circulars.length === 0 ? (
                <Empty>No circulars filed under this area yet.</Empty>
              ) : (
                [...detail.circulars]
                  .sort((a, b) =>
                    circularSort === 'newest' ? b.issue_date.localeCompare(a.issue_date) : a.issue_date.localeCompare(b.issue_date),
                  )
                  .map((c) => (
                  <DrawerLink
                    key={c.link_id ?? c.id}
                    href={c.href}
                    title={c.title}
                    meta={
                      <>
                        <span className="font-mono">{c.circular_no}</span>
                        <span>{issuerLabel(c.issuer)}</span>
                        <span>{formatDdMmYyyy(c.issue_date)}</span>
                      </>
                    }
                    note={c.note}
                  />
                ))
              )}
              <Link href={`/circulars?area=${code}`} className="inline-flex items-center gap-1 pt-2 text-sm font-medium text-primary hover:underline">
                Browse all circulars for this area <ChevronRight className="h-4 w-4" />
              </Link>
            </>
          )}

          {detail && tab === 'tools' &&
            (detail.tools.length === 0 ? (
              <Empty>Calculators and smart tools for this area are coming soon.</Empty>
            ) : (
              detail.tools.map((t) => <DrawerLink key={t.key} href={t.href} title={t.title} subtitle={t.description} />)
            ))}
        </div>
      </aside>
    </div>
  );
}

function Workspace() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const openCode = params.get('area');
  const [areas, setAreas] = useState<IbasAreaSummary[] | null>(null);
  const [error, setError] = useState('');
  const [unpaidMessage, setUnpaidMessage] = useState<string | undefined>();
  const [dialog, setDialog] = useState<{ variant: AccessRequiredVariant; title: string; reason?: string } | null>(null);

  useEffect(() => {
    apiFetch<{ data: IbasAreaSummary[] }>('/ibas/areas')
      .then((r) => setAreas(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load the workspace'));
    fetchMe()
      .then((r) => setUnpaidMessage(r.data.unpaid_message))
      .catch(() => undefined);
  }, []);

  const setOpen = useCallback(
    (code: string | null) => {
      router.replace(code ? `${pathname}?area=${code}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const openArea = areas?.find((a) => a.code === openCode);

  useEffect(() => {
    if (openArea && openArea.access !== 'open') {
      setDialog({ variant: openArea.access, title: `iBAS++: ${openArea.name_en}`, reason: openArea.stopped_reason });
      setOpen(null);
    }
  }, [openArea, setOpen]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="iBAS++ Workspace"
        description="Pick an area to see its step-by-step procedures, the rules behind them, related circulars and tools — all in one panel."
        action={
          <Button asChild variant="outline">
            <Link href="/search">
              <Search className="h-4 w-4" /> Search everything
            </Link>
          </Button>
        }
      />

      <Alert variant="info">
        This workspace is a guide to iBAS++ work, not a connection to the live iBAS++ system — no transactions are made here.
      </Alert>

      {error && <Alert variant="error">{error}</Alert>}

      {!areas && !error ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(areas ?? []).map((a) => {
            const locked = a.access !== 'open';
            const kits = a.counts.checklists + a.counts.templates + a.counts.guides;
            const total = a.counts.procedures + a.counts.rules + a.counts.circulars + a.counts.tools + kits;
            return (
              <button
                key={a.code}
                type="button"
                onClick={() =>
                  locked
                    ? setDialog({ variant: a.access as AccessRequiredVariant, title: `iBAS++: ${a.name_en}`, reason: a.stopped_reason })
                    : setOpen(a.code)
                }
                className="text-left"
              >
                <Card className={cn('h-full overflow-hidden transition-shadow hover:shadow-md', locked && 'opacity-80')}>
                  <div className="h-1.5" style={{ backgroundColor: a.color }} />
                  <CardContent className="space-y-3 pt-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                        style={{ backgroundColor: a.color }}
                      >
                        <Briefcase className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold leading-tight text-foreground">{a.name_en}</p>
                        <p className="text-xs text-muted">{a.name_bn}</p>
                      </div>
                      {a.access === 'stopped' ? (
                        <PauseCircle className="h-4 w-4 shrink-0 text-amber-600" />
                      ) : locked ? (
                        <Lock className="h-4 w-4 shrink-0 text-muted" />
                      ) : null}
                    </div>
                    <p className="line-clamp-2 text-xs text-muted">{a.description_en}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {total === 0 ? (
                        <Badge variant="outline">Content coming soon</Badge>
                      ) : (
                        <>
                          {a.counts.procedures > 0 && <Badge variant="secondary">{a.counts.procedures} procedures</Badge>}
                          {kits > 0 && <Badge variant="secondary">{kits} checklists & templates</Badge>}
                          {a.counts.rules > 0 && <Badge variant="secondary">{a.counts.rules} rules</Badge>}
                          {a.counts.circulars > 0 && <Badge variant="secondary">{a.counts.circulars} circulars</Badge>}
                          {a.counts.tools > 0 && <Badge variant="secondary">{a.counts.tools} tools</Badge>}
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      {openArea && openArea.access === 'open' && <AreaDrawer code={openArea.code} onClose={() => setOpen(null)} />}

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

export default function IbasWorkspacePage() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <Workspace />
    </Suspense>
  );
}
