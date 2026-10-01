'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, ExternalLink, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { TOOLKIT_KINDS, type ToolkitKind } from '@ibas/shared-constants';
import type { ToolkitItemDetail, ToolkitItemSummary } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { confirmDelete } from '@/lib/confirm-action';
import { toolkitKindLabel } from '@/lib/policy-labels';
import { useIbasAreas } from '@/lib/use-ibas-areas';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { ToolkitKindIcon } from '@/components/toolkit/kind-icon';

export default function ToolkitAdminPage() {
  const router = useRouter();
  const [items, setItems] = useState<ToolkitItemSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [kind, setKind] = useState<ToolkitKind | ''>('');
  const [q, setQ] = useState('');
  const { areaName } = useIbasAreas();

  async function load() {
    setLoading(true);
    try {
      const r = await apiFetch<{ data: ToolkitItemSummary[] }>('/toolkit?include_unpublished=true');
      setItems(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function duplicate(item: ToolkitItemSummary) {
    try {
      const r = await apiFetch<{ data: ToolkitItemDetail }>(`/toolkit/${item.id}/duplicate`, { method: 'POST' });
      router.push(`/admin/toolkit/${r.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to duplicate');
    }
  }

  async function remove(item: ToolkitItemSummary) {
    if (!confirmDelete(item.title)) return;
    try {
      await apiFetch(`/toolkit/${item.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((i) => (!kind || i.kind === kind) && (!term || [i.title, i.title_bn, ...i.tags].some((t) => t?.toLowerCase().includes(term))));
  }, [items, kind, q]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Toolkit admin"
        description="Create checklists, fill-in templates and guides. Each item is filed under one or more iBAS++ areas — users with access to any of those areas can open it, and it appears in that area's drawer."
        action={
          <>
            <Button asChild variant="outline">
              <Link href="/admin/toolkit/categories">
                <Tags className="h-4 w-4" /> Categories
              </Link>
            </Button>
            {TOOLKIT_KINDS.map((k) => (
              <Button key={k.code} asChild variant={k.code === 'checklist' ? 'default' : 'outline'}>
                <Link href={`/admin/toolkit/new?kind=${k.code}`}>
                  <Plus className="h-4 w-4" /> {k.label}
                </Link>
              </Button>
            ))}
          </>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Items ({visible.length})</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {[{ code: '' as const, label_plural: 'All' }, ...TOOLKIT_KINDS].map((k) => (
              <button
                key={k.code || 'all'}
                type="button"
                onClick={() => setKind(k.code)}
                className={cn(
                  'rounded-full px-3 py-1 text-sm font-medium',
                  kind === k.code ? 'bg-primary text-white' : 'border border-border text-muted hover:bg-slate-50',
                )}
              >
                {k.label_plural}
              </button>
            ))}
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="ml-auto max-w-xs" />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted">No items yet. Use the buttons above to create the first checklist, template or guide.</p>
          ) : (
            <div className="space-y-2">
              {visible.map((i) => (
                <div key={i.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3">
                  <ToolkitKindIcon kind={i.kind} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="font-medium text-foreground">{toolkitKindLabel(i.kind)}</span>
                      <span>{i.category_label}</span>
                      <span>· {i.size} {i.kind === 'checklist' ? 'items' : i.kind === 'template' ? 'fields' : 'sections'}</span>
                      {i.is_published ? <Badge variant="success">Published</Badge> : <Badge variant="warning">Draft</Badge>}
                    </div>
                    <p className="font-medium">{i.title}</p>
                    <p className="text-xs text-muted">{i.areas.map(areaName).join(', ')}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/toolkit/${i.id}`} target="_blank" aria-label="Open">
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void duplicate(i)} aria-label="Duplicate">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/admin/toolkit/${i.id}`}>
                        <Pencil className="h-4 w-4" /> Edit
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void remove(i)} aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
