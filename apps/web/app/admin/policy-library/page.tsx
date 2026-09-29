'use client';

import { useEffect, useMemo, useState } from 'react';
import { POLICY_COLLECTIONS, type PolicyCollectionCode } from '@ibas/shared-constants';
import type { PolicyBookItem } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';

export default function PolicyLibraryAdminPage() {
  const [books, setBooks] = useState<PolicyBookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);

  useEffect(() => {
    apiFetch<{ data: PolicyBookItem[] }>('/policy/admin/books')
      .then((r) => setBooks(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load books'))
      .finally(() => setLoading(false));
  }, []);

  async function toggle(book: PolicyBookItem, code: PolicyCollectionCode) {
    const next = book.policy_collections.includes(code)
      ? book.policy_collections.filter((c) => c !== code)
      : [...book.policy_collections, code];
    setSavingId(book.id);
    setError('');
    try {
      const r = await apiFetch<{ data: PolicyBookItem }>(`/policy/books/${book.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ policy_collections: next }),
      });
      setBooks((prev) => prev.map((b) => (b.id === book.id ? r.data : b)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSavingId(null);
    }
  }

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return books.filter(
      (b) =>
        (!onlyUnassigned || b.policy_collections.length === 0) &&
        (!term || [b.name, b.name_bn, b.short_name, b.book_type_name].some((t) => t?.toLowerCase().includes(term))),
    );
  }, [books, q, onlyUnassigned]);

  const counts = useMemo(
    () => Object.fromEntries(POLICY_COLLECTIONS.map((c) => [c.code, books.filter((b) => b.policy_collections.includes(c.code)).length])),
    [books],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Policy collections"
        description="Group existing rule-library books (Acts, Rules, Instructions…) into Policy Library collections. A book can belong to several collections. Changes save instantly."
      />

      <div className="flex flex-wrap gap-2">
        {POLICY_COLLECTIONS.map((c) => (
          <Badge key={c.code} variant="secondary">
            {c.name_en}: {counts[c.code] ?? 0}
          </Badge>
        ))}
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Books ({visible.length})</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter books…" className="max-w-sm" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={onlyUnassigned} onChange={(e) => setOnlyUnassigned(e.target.checked)} />
              Only books not in any collection
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted">No books match.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3 font-medium">Book</th>
                    {POLICY_COLLECTIONS.map((c) => (
                      <th key={c.code} className="px-2 py-2 text-center font-medium">{c.name_en}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((b) => (
                    <tr key={b.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-3">
                        <p className="font-medium">{b.name}</p>
                        <p className="text-xs text-muted">
                          {b.book_type_name ?? '—'}
                          {!b.is_published && ' · draft'}
                        </p>
                      </td>
                      {POLICY_COLLECTIONS.map((c) => (
                        <td key={c.code} className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            aria-label={`${b.name} in ${c.name_en}`}
                            disabled={savingId === b.id}
                            checked={b.policy_collections.includes(c.code)}
                            onChange={() => void toggle(b, c.code)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
