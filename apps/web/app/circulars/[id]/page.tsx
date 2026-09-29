'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle, ClipboardCheck, ExternalLink, FileDown, History, RotateCcw, StickyNote } from 'lucide-react';
import type { CircularChecklistItem, CircularRecord } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { formatDdMmYyyy } from '@/lib/date-display';
import { collectionName, docTypeLabel, issuerLabel } from '@/lib/policy-labels';
import { useIbasAreas } from '@/lib/use-ibas-areas';
import { PageHeader } from '@/components/shared/page-header';
import { RichTextView } from '@/components/books/rich-text-view';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

function Meta({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function CircularChecklist({ circularId, items }: { circularId: string; items: CircularChecklistItem[] }) {
  const storageKey = `circular:checklist:${circularId}`;
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      setDone(JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Record<string, boolean>);
    } catch {
      setDone({});
    }
  }, [storageKey]);

  function toggle(id: string) {
    setDone((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }

  function reset() {
    localStorage.removeItem(storageKey);
    setDone({});
  }

  const doneCount = items.filter((i) => done[i.id]).length;
  const requiredLeft = items.filter((i) => i.required && !done[i.id]).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4" /> Checklist
          <span className="text-sm font-normal text-muted">
            {doneCount}/{items.length}
          </span>
        </CardTitle>
        {doneCount > 0 && (
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${items.length ? (doneCount / items.length) * 100 : 0}%` }} />
        </div>
        <ul className="space-y-1.5">
          {items.map((it, idx) => (
            <li key={it.id}>
              <label className="flex cursor-pointer items-start gap-2 rounded-md p-1.5 text-sm hover:bg-slate-50">
                <input type="checkbox" className="mt-0.5" checked={!!done[it.id]} onChange={() => toggle(it.id)} />
                <span className={done[it.id] ? 'text-muted line-through' : ''}>
                  {idx + 1}. {it.text}
                  {!it.required && <span className="ml-1 text-xs text-muted">(optional)</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">
          {requiredLeft === 0 ? 'All required items are ticked.' : `${requiredLeft} required item(s) left.`} Ticks are saved on this device only.
        </p>
      </CardContent>
    </Card>
  );
}

export default function CircularDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<CircularRecord | null>(null);
  const [error, setError] = useState('');
  const { areaName } = useIbasAreas();

  useEffect(() => {
    setC(null);
    setError('');
    apiFetch<{ data: CircularRecord }>(`/circulars/${id}`)
      .then((r) => setC(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load circular'));
  }, [id]);

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Circular" backHref="/circulars" backLabel="Circular Archive" />
        <Alert variant="error">{error}</Alert>
      </div>
    );
  }

  if (!c) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={c.title}
        description={c.title_bn}
        backHref="/circulars"
        backLabel="Circular Archive"
        action={
          <>
            {c.attachment_url && (
              <Button asChild>
                <a href={c.attachment_url} target="_blank" rel="noopener noreferrer">
                  <FileDown className="h-4 w-4" /> Open document
                </a>
              </Button>
            )}
            {c.source_url && (
              <Button asChild variant="outline">
                <a href={c.source_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" /> Official source
                </a>
              </Button>
            )}
          </>
        }
      />

      {!c.is_published && <Alert variant="warning">Draft — only admins can see this circular.</Alert>}

      {c.superseded_by.length > 0 && (
        <Alert variant="warning">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">This circular has been superseded by:</p>
              <ul className="mt-1 space-y-0.5">
                {c.superseded_by.map((s) => (
                  <li key={s.id}>
                    <Link href={`/circulars/${s.id}`} className="font-medium underline">
                      {s.circular_no}
                    </Link>{' '}
                    — {s.title}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {c.summary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{c.summary}</p>
              </CardContent>
            </Card>
          )}
          {c.checklist && c.checklist.length > 0 && <CircularChecklist circularId={c.id} items={c.checklist} />}
          {c.note?.trim() && (
            <Card className="border-amber-200 bg-amber-50/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <StickyNote className="h-4 w-4" /> Note
                </CardTitle>
              </CardHeader>
              <CardContent>
                {c.note.trim().startsWith('<') ? (
                  <RichTextView html={c.note} />
                ) : (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{c.note}</p>
                )}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Full text</CardTitle>
            </CardHeader>
            <CardContent>
              {c.full_text ? (
                <RichTextView html={c.full_text} />
              ) : (
                <p className="text-sm text-muted">
                  Full text has not been added yet.
                  {c.attachment_url ? ' Use “Open document” to read the original.' : ''}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <dl className="space-y-3">
                <Meta label="Order / memo no." value={<span className="font-mono">{c.circular_no}</span>} />
                <Meta label="Document type" value={docTypeLabel(c.doc_type)} />
                <Meta label="Order date" value={formatDdMmYyyy(c.issue_date)} />
                <Meta label="Effective from" value={c.effective_date ? formatDdMmYyyy(c.effective_date) : undefined} />
                <Meta label="Issued by" value={issuerLabel(c.issuer)} />
                <Meta label="Ministry / division" value={c.ministry} />
                <Meta label="Department / office" value={c.department} />
                <Meta label="Wing / branch" value={c.issuer_detail} />
                <Meta
                  label="Order by"
                  value={
                    c.order_by || c.order_by_designation ? (
                      <>
                        {c.order_by}
                        {c.order_by_designation && (
                          <span className="block text-xs font-normal text-muted">{c.order_by_designation}</span>
                        )}
                      </>
                    ) : undefined
                  }
                />
              </dl>
            </CardContent>
          </Card>

          {c.toolkit && c.toolkit.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardCheck className="h-4 w-4" /> Related checklists
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {c.toolkit.map((k) => (
                  <Link key={k.id} href={`/toolkit/${k.id}`} className="block rounded-md border border-border p-2 text-sm font-medium hover:bg-slate-50">
                    {k.title}
                    {!k.is_published && <span className="ml-1 text-xs font-normal text-muted">(draft)</span>}
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {(c.collections.length > 0 || c.areas.length > 0 || c.tags.length > 0) && (
            <Card>
              <CardContent className="space-y-3 pt-6">
                {c.collections.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs uppercase tracking-wide text-muted">Policy collections</p>
                    <div className="flex flex-wrap gap-1.5">
                      {c.collections.map((code) => (
                        <Link key={code} href={`/circulars?collection=${code}`}>
                          <Badge variant="secondary">{collectionName(code)}</Badge>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {c.areas.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs uppercase tracking-wide text-muted">iBAS++ areas</p>
                    <div className="flex flex-wrap gap-1.5">
                      {c.areas.map((code) => (
                        <Link key={code} href={`/ibas?area=${code}`}>
                          <Badge variant="outline">{areaName(code)}</Badge>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {c.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {c.tags.map((t) => (
                      <Link key={t} href={`/circulars?tag=${encodeURIComponent(t)}`} className="text-xs text-primary hover:underline">
                        #{t}
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {c.supersedes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="h-4 w-4" /> Replaces
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {c.supersedes.map((s) => (
                  <Link key={s.id} href={`/circulars/${s.id}`} className="block rounded-md border border-border p-2 text-sm hover:bg-slate-50">
                    <span className="font-mono text-xs text-muted">{s.circular_no}</span>
                    <p className="font-medium">{s.title}</p>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
