'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pencil, RotateCcw, Search } from 'lucide-react';
import {
  SALARY_EXTRA_USER_FREE_CALCS,
  SALARY_FREE_ARREARS_CALCS,
  SALARY_OFFICE_TYPE_EXTRA_USERS,
  SALARY_OTHERS_FREE_CALCS,
  type SalaryUserOfficeAdminRow,
} from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

const PAGE_SIZE = 20;

const EXTRA_RULE = Object.entries(SALARY_OFFICE_TYPE_EXTRA_USERS)
  .map(([type, n]) => `${type} ${n}`)
  .join(' · ');

function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${s}`;
}

function OfficeRow({ row, onChanged }: { row: SalaryUserOfficeAdminRow; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [nameEn, setNameEn] = useState(row.other_office_name);
  const [nameBn, setNameBn] = useState(row.other_office_name_bn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/salary/admin/offices/${row.user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ other_office_name: nameEn.trim(), other_office_name_bn: nameBn.trim() }),
      });
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!window.confirm(`Reset the office of ${row.user.full_name_en}? They will choose it again on their next visit.`)) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/salary/admin/offices/${row.user.id}`, { method: 'DELETE' });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset');
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{row.user.full_name_en}</p>
          <p className="text-xs text-muted">{[row.user.phone, row.user.email].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {row.is_other ? <Badge variant="warning">Others</Badge> : <Badge variant="secondary">{row.office_type ?? 'Listed'}</Badge>}
          {row.office_rank ? <Badge variant="secondary">{ordinal(row.office_rank)} user of this office</Badge> : null}
          <Badge variant={row.free_calcs > 0 ? 'success' : 'destructive'}>
            {row.free_calcs > 0 ? `${row.free_calcs} free calculation${row.free_calcs === 1 ? '' : 's'}` : 'No free calculations'}
          </Badge>
        </div>
      </div>

      {editing ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`office-bn-${row.user.id}`} className="text-xs">
              Office name (Bangla) — printed on bill forms
            </Label>
            <Input id={`office-bn-${row.user.id}`} lang="bn" value={nameBn} maxLength={200} onChange={(e) => setNameBn(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`office-en-${row.user.id}`} className="text-xs">
              Office name (English)
            </Label>
            <Input id={`office-en-${row.user.id}`} value={nameEn} maxLength={200} onChange={(e) => setNameEn(e.target.value)} />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="button" size="sm" onClick={() => void save()} disabled={busy}>
              {busy ? 'Saving…' : 'Save names'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setNameEn(row.other_office_name);
                setNameBn(row.other_office_name_bn);
                setError('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-0.5">
          <p className="text-slate-800">{row.label}</p>
          {row.is_other ? (
            <p lang="bn" className="text-slate-700">
              {row.other_office_name_bn || <span className="text-rose-700">Bangla name not given yet</span>}
            </p>
          ) : null}
        </div>
      )}

      {error ? <Alert variant="error">{error}</Alert> : null}

      {editing ? null : (
        <div className="flex flex-wrap gap-2">
          {row.is_other ? (
            <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />
              Edit names
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={() => void reset()}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset office
          </Button>
        </div>
      )}
    </div>
  );
}

/** Users' salary offices: users cannot change their office after saving it, so the admin corrects it here. */
export function SalaryUserOfficesAdmin() {
  const [othersOnly, setOthersOnly] = useState(true);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<SalaryUserOfficeAdminRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (othersOnly) params.set('others', '1');
      if (query) params.set('q', query);
      const res = await apiFetch<{ data: SalaryUserOfficeAdminRow[]; meta: { total: number } }>(
        `/salary/admin/offices?${params.toString()}`,
      );
      setRows(res.data);
      setTotal(res.meta.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [othersOnly, query, page]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">User offices</CardTitle>
        <CardDescription>
          Users cannot change their office after saving it. Edit an Others office name (the Bangla name is printed on
          the bill forms), or reset the office so the user chooses again (they then count as the office&apos;s newest user).
          Free calculations per office: the first user gets {SALARY_FREE_ARREARS_CALCS}; the next users by office type (
          {EXTRA_RULE}) get {SALARY_EXTRA_USER_FREE_CALCS} each; later users need approved bills. Each Others user gets{' '}
          {SALARY_OTHERS_FREE_CALCS}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {[
            { id: true, label: 'Others offices' },
            { id: false, label: 'All offices' },
          ].map((f) => (
            <Button
              key={String(f.id)}
              type="button"
              size="sm"
              variant={othersOnly === f.id ? 'default' : 'outline'}
              onClick={() => {
                setOthersOnly(f.id);
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
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by user or office name" />
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
              <OfficeRow key={`${row.user.id}-${row.updated_at}`} row={row} onChanged={() => setReloadKey((k) => k + 1)} />
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
  );
}
