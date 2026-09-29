'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, RefreshCw } from 'lucide-react';
import { ACCESS_PACKAGE_KINDS, type AccessPackageKind } from '@ibas/shared-constants';
import {
  ACCESS_PACKAGE_KIND_LABELS,
  formatBdt,
  ORDER_STATUSES,
  PAYMENT_METHOD_LABELS,
  type AccessPackageRecord,
  type OrderStatus,
  type PaymentOrderRecord,
} from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { accessDate, accessDateTime, ORDER_STATUS_BADGE } from '@/lib/billing-format';
import { UserPicker } from '@/components/users/user-picker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';

const SELECT = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
const PAGE_SIZE = 30;

interface OrdersResponse {
  total: number;
  items: PaymentOrderRecord[];
  revenue: {
    total: number;
    charges: number;
    last_30_days: number;
    paid_orders: number;
    by_kind: Partial<Record<AccessPackageKind, number>>;
  };
}

function ManualGrant({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [packages, setPackages] = useState<AccessPackageRecord[]>([]);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [packageId, setPackageId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ data: AccessPackageRecord[] }>('/billing/admin/packages')
      .then((r) => setPackages(r.data))
      .catch(() => setPackages([]));
  }, []);

  function pickPackage(id: string) {
    setPackageId(id);
    const p = packages.find((x) => x.id === id);
    if (p) setAmount(String(p.price));
  }

  async function save() {
    if (userIds.length === 0) return setError('Select at least one user');
    if (!packageId) return setError('Select a package');
    setBusy(true);
    setError('');
    try {
      for (const user_id of userIds) {
        await apiFetch('/billing/admin/grants', {
          method: 'POST',
          body: JSON.stringify({ user_id, package_id: packageId, amount: Number(amount || 0), note }),
        });
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Grant failed');
      setBusy(false);
    }
  }

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="text-base">Record a payment / grant a package</CardTitle>
        <p className="text-sm text-muted">
          For payments received outside the app (cash, WhatsApp bKash). Access starts right away, or when the user&apos;s current access of
          the same kind ends. The user gets a notification.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Users</Label>
          <UserPicker selectedIds={userIds} onChange={setUserIds} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="mg-pkg">Package</Label>
            <select id="mg-pkg" className={SELECT} value={packageId} onChange={(e) => pickPackage(e.target.value)}>
              <option value="">Select…</option>
              {ACCESS_PACKAGE_KINDS.map((k) => (
                <optgroup key={k} label={ACCESS_PACKAGE_KIND_LABELS[k]}>
                  {packages
                    .filter((p) => p.kind === k)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.exam_subject_name ? ` (${p.exam_subject_name})` : ''} — {formatBdt(p.price)} / {p.duration_days} days
                        {p.is_active ? '' : ' [hidden]'}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mg-amount">Amount received (৳)</Label>
            <Input id="mg-amount" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mg-note">Note (optional)</Label>
          <Input id="mg-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. bKash TrxID 9ABC… via WhatsApp" />
        </div>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="flex gap-2">
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Grant{userIds.length > 1 ? ` to ${userIds.length} users` : ''}
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function PaymentsAdmin() {
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [status, setStatus] = useState<OrderStatus | ''>('paid');
  const [kind, setKind] = useState<AccessPackageKind | ''>('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [granting, setGranting] = useState(false);
  const [message, setMessage] = useState('');

  async function load(p = page) {
    const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) });
    if (status) params.set('status', status);
    if (kind) params.set('kind', kind);
    if (q.trim()) params.set('q', q.trim());
    try {
      const r = await apiFetch<{ data: OrdersResponse }>(`/billing/admin/orders?${params.toString()}`);
      setData(r.data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders');
    }
  }

  useEffect(() => {
    const t = window.setTimeout(() => {
      setPage(1);
      void load(1);
    }, 250);
    return () => window.clearTimeout(t);
  }, [status, kind, q]);

  async function revoke(o: PaymentOrderRecord) {
    const note = window.prompt(`Revoke access from "${o.package_name}" for ${o.user?.name ?? 'this user'}? Optional reason:`, '');
    if (note === null) return;
    try {
      await apiFetch(`/billing/admin/orders/${o.id}/revoke`, { method: 'POST', body: JSON.stringify({ note }) });
      setMessage('Access revoked.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Revoke failed');
    }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-4">
      {data && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs uppercase text-muted">Total collected</p>
              <p className="text-2xl font-bold">{formatBdt(data.revenue.total)}</p>
              <p className="text-xs text-muted">{data.revenue.paid_orders} paid orders</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs uppercase text-muted">Last 30 days</p>
              <p className="text-2xl font-bold">{formatBdt(data.revenue.last_30_days)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs uppercase text-muted">Charges collected</p>
              <p className="text-2xl font-bold">{formatBdt(data.revenue.charges)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-0.5 pt-5 text-sm">
              <p className="text-xs uppercase text-muted">By type</p>
              {ACCESS_PACKAGE_KINDS.map((k) => (
                <p key={k} className="flex justify-between">
                  <span className="text-muted">{ACCESS_PACKAGE_KIND_LABELS[k]}</span>
                  <span className="font-medium">{formatBdt(data.revenue.by_kind[k] ?? 0)}</span>
                </p>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="w-40">
          <Label htmlFor="po-status" className="text-xs">
            Status
          </Label>
          <select id="po-status" className={SELECT} value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | '')}>
            <option value="">All</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="w-44">
          <Label htmlFor="po-kind" className="text-xs">
            Type
          </Label>
          <select id="po-kind" className={SELECT} value={kind} onChange={(e) => setKind(e.target.value as AccessPackageKind | '')}>
            <option value="">All</option>
            {ACCESS_PACKAGE_KINDS.map((k) => (
              <option key={k} value={k}>
                {ACCESS_PACKAGE_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[200px] flex-1">
          <Label htmlFor="po-q" className="text-xs">
            Search
          </Label>
          <Input id="po-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="User, invoice, TrxID or package" />
        </div>
        <Button variant="outline" onClick={() => load()} aria-label="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button
          onClick={() => {
            setMessage('');
            setGranting(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Manual grant
        </Button>
      </div>

      {granting && (
        <ManualGrant
          onCancel={() => setGranting(false)}
          onDone={() => {
            setGranting(false);
            setMessage('Package granted.');
            void load(1);
          }}
        />
      )}
      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      {!data ? (
        <Skeleton className="h-64 w-full" />
      ) : data.items.length === 0 ? (
        <EmptyState title="No orders" description="Orders matching these filters will appear here." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Package</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Method</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Access</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.items.map((o) => (
                <tr key={o.id} className="align-top">
                  <td className="whitespace-nowrap px-3 py-2">
                    {accessDateTime(o.paid_at ?? o.created_at)}
                    <p className="font-mono text-xs text-muted">{o.invoice_no}</p>
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{o.user?.name ?? '—'}</p>
                    <p className="text-xs text-muted">{o.user?.phone || o.user?.email}</p>
                  </td>
                  <td className="px-3 py-2">
                    <p>{o.package_name}</p>
                    <p className="text-xs text-muted">
                      {ACCESS_PACKAGE_KIND_LABELS[o.kind]}
                      {o.exam_subject_name ? ` · ${o.exam_subject_name}` : ''}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <p className="font-medium">{formatBdt(o.total)}</p>
                    {o.charge > 0 && <p className="text-xs text-muted">incl. {formatBdt(o.charge)} charge</p>}
                  </td>
                  <td className="px-3 py-2">
                    <p>{PAYMENT_METHOD_LABELS[o.method]}</p>
                    {o.trx_id && <p className="font-mono text-xs text-muted">{o.trx_id}</p>}
                    {o.payer_account && <p className="text-xs text-muted">{o.payer_account}</p>}
                    {o.note && <p className="text-xs text-muted">{o.note}</p>}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={ORDER_STATUS_BADGE[o.status]} className="capitalize">
                      {o.status}
                    </Badge>
                    {o.access_revoked && (
                      <Badge variant="destructive" className="mt-1">
                        Revoked
                      </Badge>
                    )}
                    {o.failure_reason && <p className="mt-1 text-xs text-muted">{o.failure_reason}</p>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">
                    {o.status === 'paid' ? `${accessDate(o.access_starts_at)} → ${accessDate(o.access_ends_at)}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {o.status === 'paid' && !o.access_revoked && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => revoke(o)}>
                        Revoke
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => {
              setPage(page - 1);
              void load(page - 1);
            }}
          >
            Previous
          </Button>
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pages}
            onClick={() => {
              setPage(page + 1);
              void load(page + 1);
            }}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
