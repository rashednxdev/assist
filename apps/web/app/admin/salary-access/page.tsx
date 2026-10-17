'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Search, X } from 'lucide-react';
import type {
  SalaryAccessListFilter,
  SalaryBillAccessAdminRow,
  SalaryBillAccessStats,
  SalaryBillUsageRecord,
  SalaryBulkSizeRecord,
  SalaryPrintStats,
} from '@ibas/shared-types';
import { SALARY_CALCS_PER_BILL, SALARY_DEFAULT_BULK_SIZE, formatTaka } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type StatusFilter = SalaryAccessListFilter | 'all';

const FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'active', label: 'Requests & approved' },
  { id: 'pending', label: 'Pending requests' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
];

const PAGE_SIZE = 20;

interface UserOption {
  id: string;
  full_name_en: string;
  email: string;
  phone: string;
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function StatusBadge({ row }: { row: SalaryBillAccessAdminRow }) {
  if (row.request.pending) {
    return row.bill_limit > 0 ? <Badge variant="warning">New bulk</Badge> : <Badge variant="warning">New request</Badge>;
  }
  if (row.status === 'approved') return <Badge variant="success">Approved</Badge>;
  if (row.status === 'rejected') return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="secondary">—</Badge>;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function addBulk(limit: string, bulkSize: number, floor: number): string {
  const current = Number(limit);
  return String((Number.isInteger(current) && current >= floor ? current : floor) + bulkSize);
}

const USAGE_LABEL: Record<SalaryBillUsageRecord['kind'], string> = {
  tr_form_13: 'T.R. Form 13',
  tr_form_15: 'T.R. Form 15',
  arrears_pdf: 'Arrears PDF',
  arrears_calc: `${SALARY_CALCS_PER_BILL} calculations without download`,
  staff_tr_form_15: 'Office staff T.R. Form 15 (1 employee)',
};

function StatCard({ title, stats }: { title: string; stats: SalaryPrintStats }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 shadow-sm">
      <p className="text-xs font-medium text-muted">{title}</p>
      <p className="text-2xl font-bold tabular-nums text-slate-900">{stats.total}</p>
      <p className="text-xs text-slate-600">
        Free <span className="font-semibold tabular-nums text-emerald-700">{stats.free}</span> · Approved{' '}
        <span className="font-semibold tabular-nums text-primary-dark">{stats.approved}</span>
      </p>
    </div>
  );
}

function CountCard({ title, value, tone }: { title: string; value: number; tone: 'amber' | 'emerald' }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 shadow-sm">
      <p className="text-xs font-medium text-muted">{title}</p>
      <p className={cn('text-2xl font-bold tabular-nums', tone === 'amber' ? 'text-amber-700' : 'text-emerald-700')}>{value}</p>
    </div>
  );
}

function StatsBar({ reloadKey }: { reloadKey: number }) {
  const [stats, setStats] = useState<SalaryBillAccessStats | null>(null);

  useEffect(() => {
    apiFetch<{ data: SalaryBillAccessStats }>('/salary/admin/access-stats')
      .then((res) => setStats(res.data))
      .catch(() => undefined);
  }, [reloadKey]);

  if (!stats) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard title="Total prints" stats={stats.all_time} />
      <StatCard title="Today's prints" stats={stats.today} />
      <CountCard title="Pending requests" value={stats.pending_requests} tone="amber" />
      <CountCard title="Approved users" value={stats.approved_users} tone="emerald" />
    </div>
  );
}

function UsageHistory({ userId }: { userId: string }) {
  const [items, setItems] = useState<SalaryBillUsageRecord[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ data: SalaryBillUsageRecord[] }>(`/salary/admin/access/${userId}/usage`)
      .then((res) => setItems(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load history'));
  }, [userId]);

  if (error) return <p className="text-xs text-destructive">{error}</p>;
  if (!items) return <p className="text-xs text-muted">Loading…</p>;
  if (items.length === 0) return <p className="text-xs text-muted">No bills used yet.</p>;
  return (
    <ul className="space-y-1 text-xs text-slate-700">
      {items.map((u) => (
        <li key={u.id}>
          {formatWhen(u.created_at)} · {USAGE_LABEL[u.kind]} · Grade {u.grade} · Basic{' '}
          {formatTaka(u.old_pay)} · {u.months.length} month{u.months.length === 1 ? '' : 's'} · Net ৳ {formatTaka(u.net_total)}
        </li>
      ))}
    </ul>
  );
}

function AdminNote({ row, onSaved }: { row: SalaryBillAccessAdminRow; onSaved: (row: SalaryBillAccessAdminRow) => void }) {
  const [note, setNote] = useState(row.admin_note);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function save() {
    setBusy(true);
    setStatus('');
    setError('');
    try {
      const res = await apiFetch<{ data: SalaryBillAccessAdminRow }>(`/salary/admin/access/${row.user.id}/note`, {
        method: 'PUT',
        body: JSON.stringify({ admin_note: note.trim() }),
      });
      onSaved(res.data);
      setStatus('Note saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <Label htmlFor={`note-${row.user.id}`} className="text-xs">
        Admin note <span className="font-normal text-muted">(only admins see this; not shown to the user)</span>
      </Label>
      <textarea
        id={`note-${row.user.id}`}
        rows={3}
        maxLength={500}
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setStatus('');
        }}
        className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => void save()} disabled={busy || note.trim() === row.admin_note}>
          {busy ? 'Saving…' : 'Save note'}
        </Button>
        {status ? <span className="text-xs text-emerald-700">{status}</span> : null}
      </div>
      {error ? <Alert variant="error">{error}</Alert> : null}
    </div>
  );
}

function money(n: number): string {
  return `৳ ${formatTaka(n)}`;
}

function AccessDialog({
  row,
  bulkSize,
  bulkPrice,
  onClose,
  onSaved,
  onNoteSaved,
}: {
  row: SalaryBillAccessAdminRow;
  bulkSize: number;
  bulkPrice: number;
  onClose: () => void;
  onSaved: () => void;
  onNoteSaved: (row: SalaryBillAccessAdminRow) => void;
}) {
  const suggested = row.request.pending ? row.bills_used + (row.request.requested_bills ?? 0) : row.bill_limit;
  const suggestedCharge = row.billing.suggested_charge ?? (row.request.pending && bulkPrice > 0 ? (row.request.requested_bulks ?? 0) * bulkPrice : 0);
  const [limit, setLimit] = useState(String(suggested));
  const [charge, setCharge] = useState(String(suggestedCharge || ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(() => new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [payNote, setPayNote] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState('');
  const [localRow, setLocalRow] = useState(row);

  useEffect(() => {
    setLocalRow(row);
  }, [row]);

  async function saveLimit() {
    const value = Number(limit);
    if (!Number.isInteger(value) || value < 0) {
      setError('Enter a whole number (0 or more).');
      return;
    }
    const chargeValue = charge.trim() === '' ? 0 : Number(charge);
    if (!Number.isInteger(chargeValue) || chargeValue < 0) {
      setError('Enter a whole Taka amount for the price (0 or more).');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/salary/admin/access/${row.user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ bill_limit: value, charge_amount: chargeValue > 0 ? chargeValue : undefined }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!window.confirm(`Reject the bill request from ${row.user.full_name_en}?`)) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/salary/admin/access/${row.user.id}/reject`, { method: 'POST', body: JSON.stringify({}) });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setBusy(false);
    }
  }

  async function addPayment() {
    const amount = Number(payAmount);
    if (!Number.isInteger(amount) || amount < 1) {
      setPayError('Enter a received amount of at least 1 Taka.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payDate)) {
      setPayError('Enter the received date.');
      return;
    }
    setPayBusy(true);
    setPayError('');
    try {
      const res = await apiFetch<{ data: SalaryBillAccessAdminRow }>(`/salary/admin/access/${row.user.id}/payment`, {
        method: 'POST',
        body: JSON.stringify({ amount, received_at: payDate, note: payNote.trim() }),
      });
      setLocalRow(res.data);
      onNoteSaved(res.data);
      setPayAmount('');
      setPayNote('');
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setPayBusy(false);
    }
  }

  const billing = localRow.billing;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-surface shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold">
              {row.user.full_name_en}
              <StatusBadge row={row} />
            </h2>
            <p className="text-xs text-muted">
              {row.user.phone}
              {row.user.email ? ` · ${row.user.email}` : ''}
            </p>
            <p className="text-xs text-slate-600">
              <span className="font-medium">Office:</span> {row.office_label || 'Not selected yet'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-2 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted">Allowed</p>
              <p className="font-semibold tabular-nums">{row.bill_limit}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Used</p>
              <p className="font-semibold tabular-nums">{row.bills_used}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Remaining</p>
              <p className="font-semibold tabular-nums">{row.remaining}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Last used</p>
              <p className="text-xs">{formatWhen(row.last_used_at)}</p>
            </div>
          </div>

          <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted">Charged (admin)</p>
              <p className="font-semibold tabular-nums text-slate-900">{money(billing.charged_total)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Received (admin)</p>
              <p className="font-semibold tabular-nums text-emerald-700">{money(billing.received_total)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Due</p>
              <p className={cn('font-bold tabular-nums', billing.due > 0 ? 'text-rose-700' : 'text-emerald-700')}>
                {money(billing.due)}
              </p>
            </div>
          </div>

          <div className="space-y-0.5 text-xs text-slate-600">
            <p>
              Free calculations used: {row.calc.free_used} of {row.calc.free_limit} · Calculations toward next bill:{' '}
              {row.calc.unprinted} of {row.calc.per_bill}
            </p>
            <p>
              Free T.R. Form:{' '}
              {row.free_tr_form === 'available' ? 'available' : row.free_tr_form === 'used' ? 'used' : 'not eligible'} ·
              Approved on {formatWhen(row.approved_at)}
            </p>
          </div>

          {row.request.pending ? (
            <div className="space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
              <p>
                {row.bill_limit > 0 ? 'New bulk requested: ' : 'Requested '}
                {row.request.requested_bulks ? (
                  <>
                    <strong>{plural(row.request.requested_bulks, 'bulk')}</strong> ({plural(row.request.requested_bills ?? 0, 'bill')})
                  </>
                ) : (
                  <strong>{plural(row.request.requested_bills ?? 0, 'bill')}</strong>
                )}{' '}
                on {formatWhen(row.request.requested_at)}
              </p>
              {suggestedCharge > 0 ? (
                <p className="text-xs font-semibold text-amber-900">
                  Suggested amount to charge now: {money(suggestedCharge)}
                  {bulkPrice > 0 && row.request.requested_bulks
                    ? ` (${row.request.requested_bulks} × ${money(bulkPrice)} per bulk)`
                    : ''}
                </p>
              ) : (
                <p className="text-xs text-amber-800">Set a price per bulk in Settings to see a suggested charge.</p>
              )}
              {row.request.note ? <span className="block text-xs">User note: {row.request.note}</span> : null}
            </div>
          ) : null}

          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-56 space-y-1">
                <Label htmlFor={`limit-${row.user.id}`} className="text-xs">
                  Total bills allowed
                </Label>
                <div className="flex gap-1.5">
                  <Input
                    id={`limit-${row.user.id}`}
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 shrink-0"
                    title={`Add 1 bulk (${bulkSize} bills)`}
                    onClick={() => setLimit((l) => addBulk(l, bulkSize, row.bills_used))}
                  >
                    +1 bulk
                  </Button>
                </div>
              </div>
              <div className="w-40 space-y-1">
                <Label htmlFor={`charge-${row.user.id}`} className="text-xs">
                  Price to charge (৳)
                </Label>
                <Input
                  id={`charge-${row.user.id}`}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={charge}
                  placeholder="0"
                  onChange={(e) => setCharge(e.target.value)}
                />
              </div>
              <Button type="button" onClick={() => void saveLimit()} disabled={busy}>
                {row.request.pending ? 'Approve' : 'Save'}
              </Button>
              {row.request.pending ? (
                <Button type="button" variant="outline" onClick={() => void reject()} disabled={busy}>
                  Reject
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted">
              1 bulk = {plural(bulkSize, 'bill')}. Total includes bills already used ({row.bills_used}). Price is added to
              this user&apos;s charged total (admin only). Leave price 0 to change bills without charging.
            </p>
            {error ? <Alert variant="error">{error}</Alert> : null}
          </div>

          <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
            <p className="text-xs font-semibold text-emerald-950">
              Received amount <span className="font-normal text-muted">(admins only · date-wise)</span>
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-32 space-y-1">
                <Label htmlFor={`pay-amt-${row.user.id}`} className="text-xs">
                  Amount (৳)
                </Label>
                <Input
                  id={`pay-amt-${row.user.id}`}
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </div>
              <div className="w-40 space-y-1">
                <Label htmlFor={`pay-date-${row.user.id}`} className="text-xs">
                  Received date
                </Label>
                <Input
                  id={`pay-date-${row.user.id}`}
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                />
              </div>
              <div className="min-w-[10rem] flex-1 space-y-1">
                <Label htmlFor={`pay-note-${row.user.id}`} className="text-xs">
                  Note
                </Label>
                <Input
                  id={`pay-note-${row.user.id}`}
                  value={payNote}
                  maxLength={200}
                  placeholder="Optional"
                  onChange={(e) => setPayNote(e.target.value)}
                />
              </div>
              <Button type="button" variant="outline" onClick={() => void addPayment()} disabled={payBusy}>
                {payBusy ? 'Saving…' : 'Add received'}
              </Button>
            </div>
            {payError ? <Alert variant="error">{payError}</Alert> : null}
            {billing.payments.length === 0 ? (
              <p className="text-xs text-muted">No payments recorded yet.</p>
            ) : (
              <ul className="divide-y divide-emerald-100 rounded-md border border-emerald-200 bg-white text-xs">
                {billing.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
                    <span className="font-medium tabular-nums text-slate-800">
                      {p.received_at.split('-').reverse().join('-')}
                    </span>
                    <span className="font-semibold tabular-nums text-emerald-800">{money(p.amount)}</span>
                    {p.note ? <span className="w-full text-muted">{p.note}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <AdminNote
            row={localRow}
            onSaved={(next) => {
              setLocalRow(next);
              onNoteSaved(next);
            }}
          />

          <div>
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => setShowHistory((v) => !v)}
            >
              {showHistory ? 'Hide bill history' : 'Show bill history'}
            </button>
            {showHistory ? (
              <div className="mt-2">
                <UsageHistory userId={row.user.id} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function AccessTable({ rows, onOpen }: { rows: SalaryBillAccessAdminRow[]; onOpen: (row: SalaryBillAccessAdminRow) => void }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[48rem] text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
          <tr>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2 text-right">Allowed</th>
            <th className="px-3 py-2 text-right">Used</th>
            <th className="px-3 py-2 text-right">Remaining</th>
            <th className="px-3 py-2 text-right">Charged</th>
            <th className="px-3 py-2 text-right">Received</th>
            <th className="px-3 py-2 text-right">Due</th>
            <th className="px-3 py-2">Status</th>
            <th className="w-8 px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.user.id}
              onClick={() => onOpen(row)}
              className={cn(
                'cursor-pointer border-t border-border align-top hover:bg-slate-50',
                row.request.pending && 'bg-amber-50/60 hover:bg-amber-50',
              )}
            >
              <td className="px-3 py-2">
                <span className="block font-semibold text-slate-900">{row.user.full_name_en}</span>
                <span className="block text-xs text-muted">{row.user.phone}</span>
                <span className="block text-[10px] leading-tight text-slate-500">{row.office_label || 'Office not selected'}</span>
                {row.admin_note ? <span className="block text-[11px] text-slate-500">Note: {row.admin_note}</span> : null}
                {row.billing.suggested_charge != null ? (
                  <span className="block text-[11px] font-medium text-amber-800">
                    Suggest now: {money(row.billing.suggested_charge)}
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{row.bill_limit}</td>
              <td className="px-3 py-2 text-right tabular-nums">{row.bills_used}</td>
              <td
                className={cn(
                  'px-3 py-2 text-right font-semibold tabular-nums',
                  row.remaining > 0 ? 'text-emerald-700' : 'text-red-700',
                )}
              >
                {row.remaining}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-700">{money(row.billing.charged_total)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{money(row.billing.received_total)}</td>
              <td
                className={cn(
                  'px-3 py-2 text-right font-semibold tabular-nums',
                  row.billing.due > 0 ? 'text-rose-700' : 'text-emerald-700',
                )}
              >
                {money(row.billing.due)}
              </td>
              <td className="px-3 py-2">
                <StatusBadge row={row} />
                {row.request.pending ? (
                  <span className="mt-0.5 block text-[11px] text-amber-900">
                    +{plural(row.request.requested_bills ?? 0, 'bill')}
                  </span>
                ) : null}
              </td>
              <td className="px-2 py-2 text-muted">
                <ChevronRight className="h-4 w-4" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GrantUser({ bulkSize, bulkPrice, onSaved }: { bulkSize: number; bulkPrice: number; onSaved: () => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<UserOption[]>([]);
  const [selected, setSelected] = useState<UserOption | null>(null);
  const [limit, setLimit] = useState(String(bulkSize));
  const [charge, setCharge] = useState(bulkPrice > 0 ? String(bulkPrice) : '');

  useEffect(() => setLimit(String(bulkSize)), [bulkSize]);
  useEffect(() => {
    if (bulkPrice > 0) setCharge(String(bulkPrice));
  }, [bulkPrice]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  async function search() {
    if (!q.trim()) return;
    setError('');
    try {
      const res = await apiFetch<{ data: UserOption[] }>(`/users?q=${encodeURIComponent(q.trim())}&limit=10`);
      setResults(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    }
  }

  async function grant() {
    if (!selected) return;
    const value = Number(limit);
    if (!Number.isInteger(value) || value < 1) {
      setError('Enter a whole number of bills (1 or more).');
      return;
    }
    const chargeValue = charge.trim() === '' ? 0 : Number(charge);
    if (!Number.isInteger(chargeValue) || chargeValue < 0) {
      setError('Enter a whole Taka amount for the price (0 or more).');
      return;
    }
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await apiFetch(`/salary/admin/access/${selected.id}`, {
        method: 'PUT',
        body: JSON.stringify({ bill_limit: value, charge_amount: chargeValue > 0 ? chargeValue : undefined }),
      });
      setStatus(
        `${selected.full_name_en} can now use up to ${value} arrears bills in total${
          chargeValue > 0 ? ` · charged ${money(chargeValue)}` : ''
        }.`,
      );
      setSelected(null);
      setResults([]);
      setQ('');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Approve a user directly</CardTitle>
        <CardDescription>For users who contacted you without sending a request.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {status ? <Alert variant="success">{status}</Alert> : null}
        {error ? <Alert variant="error">{error}</Alert> : null}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void search();
          }}
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, mobile or email" />
          <Button type="submit" variant="outline" className="gap-1.5">
            <Search className="h-4 w-4" />
            Search
          </Button>
        </form>
        {results.length > 0 && !selected ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {results.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => setSelected(u)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <span className="font-medium">{u.full_name_en}</span>
                  <span className="ml-2 text-xs text-muted">
                    {u.phone}
                    {u.email ? ` · ${u.email}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {selected ? (
          <div className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_9rem_auto_auto]">
            <div>
              <p className="text-xs text-muted">Selected user</p>
              <p className="text-sm font-semibold">{selected.full_name_en}</p>
              <p className="text-xs text-muted">{selected.phone}</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="grant-limit" className="text-xs">
                Total bills allowed
              </Label>
              <div className="flex gap-1.5">
                <Input id="grant-limit" type="number" min={1} value={limit} onChange={(e) => setLimit(e.target.value)} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 shrink-0"
                  title={`Add 1 bulk (${bulkSize} bills)`}
                  onClick={() => setLimit((l) => addBulk(l, bulkSize, 0))}
                >
                  +1 bulk
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="grant-charge" className="text-xs">
                Price (৳)
              </Label>
              <Input
                id="grant-charge"
                type="number"
                min={0}
                value={charge}
                placeholder="0"
                onChange={(e) => setCharge(e.target.value)}
              />
            </div>
            <Button type="button" onClick={() => void grant()} disabled={busy}>
              Approve
            </Button>
            <Button type="button" variant="outline" onClick={() => setSelected(null)}>
              Cancel
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function SalaryAccessAdminPage() {
  const [filter, setFilter] = useState<StatusFilter>('active');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<SalaryBillAccessAdminRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [bulkSize, setBulkSize] = useState(SALARY_DEFAULT_BULK_SIZE);
  const [bulkPrice, setBulkPrice] = useState(0);
  const [openRow, setOpenRow] = useState<SalaryBillAccessAdminRow | null>(null);

  useEffect(() => {
    apiFetch<{ data: SalaryBulkSizeRecord }>('/salary/admin/bulk-size')
      .then((res) => {
        setBulkSize(res.data.bulk_size);
        setBulkPrice(res.data.bulk_price ?? 0);
      })
      .catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (filter !== 'all') params.set('status', filter);
      if (query) params.set('q', query);
      const res = await apiFetch<{ data: SalaryBillAccessAdminRow[]; meta: { total: number } }>(
        `/salary/admin/access?${params.toString()}`,
      );
      setRows(res.data);
      setTotal(res.meta.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [filter, query, page]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function noteSaved(row: SalaryBillAccessAdminRow) {
    setRows((list) => list.map((r) => (r.user.id === row.user.id ? row : r)));
    setOpenRow(row);
  }

  return (
    <div className="space-y-6">
      <StatsBar reloadKey={reloadKey} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Requests & approvals</CardTitle>
          <CardDescription>
            Pending requests are marked &quot;New request&quot; or &quot;New bulk&quot;. Open a row to approve, change the bills
            allowed, or add an admin note.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Button
                key={f.id}
                type="button"
                size="sm"
                variant={filter === f.id ? 'default' : 'outline'}
                onClick={() => {
                  setFilter(f.id);
                  setPage(1);
                }}
              >
                {f.label}
              </Button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setQuery(q.trim());
            }}
          >
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, mobile or email" />
            <Button type="submit" variant="outline" className="gap-1.5">
              <Search className="h-4 w-4" />
              Search
            </Button>
          </form>

          {error ? <Alert variant="error">{error}</Alert> : null}
          {loading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted">Nothing here.</p>
          ) : (
            <AccessTable rows={rows} onOpen={setOpenRow} />
          )}

          {pages > 1 ? (
            <div className="flex items-center justify-between text-sm">
              <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-muted">
                Page {page} of {pages} · {total} users
              </span>
              <Button type="button" size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <GrantUser bulkSize={bulkSize} bulkPrice={bulkPrice} onSaved={reload} />

      {openRow ? (
        <AccessDialog
          key={`${openRow.user.id}-${openRow.updated_at}`}
          row={openRow}
          bulkSize={bulkSize}
          bulkPrice={bulkPrice}
          onClose={() => setOpenRow(null)}
          onSaved={() => {
            setOpenRow(null);
            reload();
          }}
          onNoteSaved={noteSaved}
        />
      ) : null}
    </div>
  );
}
