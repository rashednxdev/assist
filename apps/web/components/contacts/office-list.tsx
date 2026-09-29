'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ContactOffice } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { OfficeCard } from '@/components/contacts/contact-bits';

const PAGE = 30;

/** Paged office cards filtered by type, parent office and/or search text. */
export function OfficeList({ typeId, parentId, q, emptyTitle = 'No offices found', emptyText }: { typeId?: string; parentId?: string; q?: string; emptyTitle?: string; emptyText?: string }) {
  const [items, setItems] = useState<ContactOffice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');

  function url(p: number) {
    const s = new URLSearchParams({ page: String(p), limit: String(PAGE) });
    if (typeId) s.set('type_id', typeId);
    if (parentId) s.set('parent_id', parentId);
    if (q) s.set('q', q);
    return `/contacts/offices?${s}`;
  }

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    apiFetch<{ data: ContactOffice[]; meta: { total: number } }>(url(1))
      .then((r) => {
        if (!live) return;
        setItems(r.data);
        setTotal(r.meta.total);
        setPage(1);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : 'Could not load offices'))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [typeId, parentId, q]);

  async function loadMore() {
    setMore(true);
    try {
      const r = await apiFetch<{ data: ContactOffice[]; meta: { total: number } }>(url(page + 1));
      setItems((cur) => [...cur, ...r.data]);
      setTotal(r.meta.total);
      setPage(page + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load more');
    } finally {
      setMore(false);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-64 rounded-2xl" />
        ))}
      </div>
    );
  }
  if (error) return <Alert variant="error">{error}</Alert>;
  if (items.length === 0) return <EmptyState title={emptyTitle} description={emptyText} />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {total} {total === 1 ? 'office' : 'offices'}
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((o) => (
          <OfficeCard key={o.id} o={o} />
        ))}
      </div>
      {items.length < total && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={more}>
            {more && <Loader2 className="h-4 w-4 animate-spin" />}
            Load more ({total - items.length} left)
          </Button>
        </div>
      )}
    </div>
  );
}
