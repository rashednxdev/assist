'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Pencil, Plus, Settings2, Trash2 } from 'lucide-react';
import { formatDeductionAmount, type DeductionEntrySummary, type DeductionSetupItem } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { confirmDelete } from '@/lib/confirm-action';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';

const selectClass = 'h-10 rounded-md border border-input bg-background px-3 text-sm';

export default function DeductionEntriesAdminPage() {
  const [items, setItems] = useState<DeductionEntrySummary[]>([]);
  const [setup, setSetup] = useState<DeductionSetupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [eco, setEco] = useState('');
  const [bill, setBill] = useState('');
  const [status, setStatus] = useState<'' | 'published' | 'draft'>('');
  const [q, setQ] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        apiFetch<{ data: DeductionEntrySummary[] }>('/deductions?include_unpublished=true'),
        apiFetch<{ data: DeductionSetupItem[] }>('/deductions/setup'),
      ]);
      setItems(r.data);
      setSetup(s.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function remove(item: DeductionEntrySummary) {
    if (!confirmDelete(`${item.economic_code.code ?? ''} · ${item.bill_type.name_en}`)) return;
    try {
      await apiFetch(`/deductions/${item.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!eco || i.economic_code.id === eco) &&
        (!bill || i.bill_type.id === bill) &&
        (!status || (status === 'published') === i.is_published) &&
        (!term ||
          [i.title, i.economic_code.code, i.economic_code.name_en, i.bill_type.name_en, ...i.deductions.map((d) => d.deduction_type.name_en)].some((t) =>
            t?.toLowerCase().includes(term),
          )),
    );
  }, [items, eco, bill, status, q]);

  const ecoCodes = setup.filter((s) => s.kind === 'economic_code');
  const billTypes = setup.filter((s) => s.kind === 'bill_type');

  return (
    <div className="space-y-6">
      <PageHeader
        title="VAT, IT, Tax & Deductions"
        description="Deductions by economic code and type of bill. Users see only published entries under Community & services."
        action={
          <>
            <Button asChild variant="outline">
              <Link href="/admin/deductions/setup">
                <Settings2 className="h-4 w-4" /> Setup
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/deductions/new">
                <Plus className="h-4 w-4" /> New entry
              </Link>
            </Button>
          </>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}
      {!loading && (ecoCodes.length === 0 || billTypes.length === 0) ? (
        <Alert variant="warning">
          Add economic codes, types of bill and deduction types in{' '}
          <Link href="/admin/deductions/setup" className="font-medium underline">
            Setup
          </Link>{' '}
          before creating entries.
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Entries ({visible.length})</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <select className={selectClass} value={eco} onChange={(e) => setEco(e.target.value)} aria-label="Economic code">
              <option value="">All economic codes</option>
              {ecoCodes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} · {s.name_en}
                </option>
              ))}
            </select>
            <select className={selectClass} value={bill} onChange={(e) => setBill(e.target.value)} aria-label="Type of bill">
              <option value="">All bill types</option>
              {billTypes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name_en}
                </option>
              ))}
            </select>
            <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status">
              <option value="">Published & drafts</option>
              <option value="published">Published</option>
              <option value="draft">Drafts</option>
            </select>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="ml-auto max-w-xs" />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted">No entries yet.</p>
          ) : (
            <div className="space-y-2">
              {visible.map((i) => (
                <div key={i.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline">{i.economic_code.code ?? '—'}</Badge>
                      <span className="text-muted">{i.economic_code.name_en}</span>
                      <span className="font-medium text-foreground">· {i.bill_type.name_en}</span>
                      {i.is_published ? <Badge variant="success">Published</Badge> : <Badge variant="warning">Draft</Badge>}
                    </div>
                    {i.title ? <p className="font-medium">{i.title}</p> : null}
                    <div className="flex flex-wrap gap-1.5">
                      {i.deductions.map((d) => (
                        <span key={d.deduction_type.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                          <span className="font-medium">{d.deduction_type.code || d.deduction_type.name_en}</span> {formatDeductionAmount(d)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/admin/deductions/${i.id}`}>
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
