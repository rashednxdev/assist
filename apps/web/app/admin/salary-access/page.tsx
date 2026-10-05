'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import type {
  SalaryBillAccessAdminRow,
  SalaryBillUsageRecord,
  SalaryContactNumber,
  SalaryContactsRecord,
} from '@ibas/shared-types';
import { formatTaka } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all';

const FILTERS: Array<{ id: StatusFilter; label: string }> = [
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
  if (row.request.pending) return <Badge variant="warning">Pending</Badge>;
  if (row.status === 'approved') return <Badge variant="success">Approved</Badge>;
  if (row.status === 'rejected') return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="secondary">—</Badge>;
}

function ContactsEditor() {
  const [contacts, setContacts] = useState<SalaryContactNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ data: SalaryContactsRecord }>('/salary/admin/contacts')
      .then((res) => setContacts(res.data.contacts))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load contacts'))
      .finally(() => setLoading(false));
  }, []);

  function update(index: number, patch: Partial<SalaryContactNumber>) {
    setContacts((list) => list.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  async function save() {
    setSaving(true);
    setStatus('');
    setError('');
    try {
      const cleaned = contacts
        .map((c) => ({ label: c.label.trim(), number: c.number.trim(), whatsapp: c.whatsapp }))
        .filter((c) => c.number);
      const res = await apiFetch<{ data: SalaryContactsRecord }>('/salary/admin/contacts', {
        method: 'PUT',
        body: JSON.stringify({ contacts: cleaned }),
      });
      setContacts(res.data.contacts);
      setStatus('Contact numbers saved. Users see them on /salary when they need approval.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Contact numbers</CardTitle>
        <CardDescription>Shown on the salary page so users can reach you for bill approval.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {status ? <Alert variant="success">{status}</Alert> : null}
        {error ? <Alert variant="error">{error}</Alert> : null}
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <>
            {contacts.length === 0 ? <p className="text-sm text-muted">No contact numbers yet.</p> : null}
            {contacts.map((c, i) => (
              <div key={i} className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
                <div className="space-y-1">
                  <Label htmlFor={`contact-label-${i}`} className="text-xs">
                    Label (optional)
                  </Label>
                  <Input
                    id={`contact-label-${i}`}
                    value={c.label}
                    maxLength={80}
                    placeholder="e.g. Accounts Section"
                    onChange={(e) => update(i, { label: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`contact-number-${i}`} className="text-xs">
                    Number
                  </Label>
                  <Input
                    id={`contact-number-${i}`}
                    value={c.number}
                    maxLength={30}
                    inputMode="tel"
                    placeholder="01XXXXXXXXX"
                    onChange={(e) => update(i, { number: e.target.value })}
                  />
                </div>
                <label className="flex h-10 items-center gap-2 text-sm">
                  <input type="checkbox" checked={c.whatsapp} onChange={(e) => update(i, { whatsapp: e.target.checked })} />
                  WhatsApp
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Remove number"
                  onClick={() => setContacts((list) => list.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setContacts((list) => [...list, { label: '', number: '', whatsapp: true }])}
                disabled={contacts.length >= 20}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Add number
              </Button>
              <Button type="button" onClick={() => void save()} disabled={saving}>
                {saving ? 'Saving…' : 'Save contact numbers'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
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
          {formatWhen(u.created_at)} · {u.kind === 'tr_form_13' ? 'T.R. Form 13' : 'Arrears PDF'} · Grade {u.grade} · Basic{' '}
          {formatTaka(u.old_pay)} · {u.months.length} month{u.months.length === 1 ? '' : 's'} · Net ৳ {formatTaka(u.net_total)}
        </li>
      ))}
    </ul>
  );
}

function AccessRow({ row, onSaved }: { row: SalaryBillAccessAdminRow; onSaved: () => void }) {
  const suggested = row.request.pending
    ? row.bills_used + (row.request.requested_bills ?? 0)
    : row.bill_limit;
  const [limit, setLimit] = useState(String(suggested));
  const [note, setNote] = useState(row.admin_note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  async function saveLimit() {
    const value = Number(limit);
    if (!Number.isInteger(value) || value < 0) {
      setError('Enter a whole number (0 or more).');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/salary/admin/access/${row.user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ bill_limit: value, admin_note: note.trim() }),
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
      await apiFetch(`/salary/admin/access/${row.user.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ admin_note: note.trim() }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">{row.user.full_name_en}</p>
          <p className="text-xs text-muted">
            {row.user.phone}
            {row.user.email ? ` · ${row.user.email}` : ''}
          </p>
          <p className="text-xs text-slate-600">
            <span className="font-medium">Office:</span> {row.office_label || 'Not selected yet'}
          </p>
        </div>
        <StatusBadge row={row} />
      </div>

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

      {row.request.pending ? (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Requested <strong>{row.request.requested_bills}</strong> bill{row.request.requested_bills === 1 ? '' : 's'} on{' '}
          {formatWhen(row.request.requested_at)}
          {row.request.note ? <span className="block text-xs">Note: {row.request.note}</span> : null}
        </div>
      ) : null}

      <div className="grid items-end gap-2 sm:grid-cols-[10rem_minmax(0,1fr)_auto]">
        <div className="space-y-1">
          <Label htmlFor={`limit-${row.user.id}`} className="text-xs">
            Total bills allowed
          </Label>
          <Input
            id={`limit-${row.user.id}`}
            type="number"
            min={0}
            inputMode="numeric"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`note-${row.user.id}`} className="text-xs">
            Note to user (optional)
          </Label>
          <Input id={`note-${row.user.id}`} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={() => void saveLimit()} disabled={busy}>
            {row.request.pending ? 'Approve' : 'Save'}
          </Button>
          {row.request.pending ? (
            <Button type="button" variant="outline" onClick={() => void reject()} disabled={busy}>
              Reject
            </Button>
          ) : null}
        </div>
      </div>
      <p className="text-xs text-muted">
        Total includes bills already used ({row.bills_used}). Set it to {row.bills_used} to stop further bills.
      </p>
      {error ? <Alert variant="error">{error}</Alert> : null}

      <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setShowHistory((v) => !v)}>
        {showHistory ? 'Hide bill history' : 'Show bill history'}
      </button>
      {showHistory ? <UsageHistory userId={row.user.id} /> : null}
    </div>
  );
}

function GrantUser({ onSaved }: { onSaved: () => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<UserOption[]>([]);
  const [selected, setSelected] = useState<UserOption | null>(null);
  const [limit, setLimit] = useState('5');
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
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await apiFetch(`/salary/admin/access/${selected.id}`, {
        method: 'PUT',
        body: JSON.stringify({ bill_limit: value }),
      });
      setStatus(`${selected.full_name_en} can now use up to ${value} arrears bills in total.`);
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
          <div className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto_auto]">
            <div>
              <p className="text-xs text-muted">Selected user</p>
              <p className="text-sm font-semibold">{selected.full_name_en}</p>
              <p className="text-xs text-muted">{selected.phone}</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="grant-limit" className="text-xs">
                Total bills allowed
              </Label>
              <Input id="grant-limit" type="number" min={1} value={limit} onChange={(e) => setLimit(e.target.value)} />
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
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<SalaryBillAccessAdminRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Salary arrears bill access"
        description="The salary page is for signed-in users only. Each arrears bill PDF download or T.R. Form 13 print uses one approved bill."
      />

      <ContactsEditor />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Requests & approvals</CardTitle>
          <CardDescription>Approve requests, change how many bills a user may use, or stop further bills.</CardDescription>
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
            <div className="space-y-3">
              {rows.map((row) => (
                <AccessRow key={`${row.user.id}-${row.updated_at}`} row={row} onSaved={reload} />
              ))}
            </div>
          )}

          {pages > 1 ? (
            <div className="flex items-center justify-between text-sm">
              <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-muted">
                Page {page} of {pages}
              </span>
              <Button type="button" size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <GrantUser onSaved={reload} />
    </div>
  );
}
