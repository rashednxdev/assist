'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, KeyRound, RefreshCw, Search } from 'lucide-react';
import { BLOCKED_ACCOUNT_REASON_LABELS, type BlockedAccountReason, type BlockedAccountRecord } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { TempPasswordDialog } from '@/components/admin/temp-password-dialog';

const REASON_VARIANT: Record<BlockedAccountReason, 'destructive' | 'secondary' | 'warning'> = {
  suspended: 'destructive',
  inactive: 'secondary',
  locked: 'warning',
  temp_password: 'warning',
};

const FILTERS: Array<{ id: BlockedAccountReason | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'suspended', label: 'Suspended' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'locked', label: 'Locked' },
  { id: 'temp_password', label: 'Waiting for new password' },
];

function when(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function BlockedAccountsPage() {
  const [items, setItems] = useState<BlockedAccountRecord[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<BlockedAccountReason | 'all'>('all');
  const [target, setTarget] = useState<BlockedAccountRecord | null>(null);

  const load = useCallback(async (q: string) => {
    try {
      const params = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
      const r = await apiFetch<{ data: BlockedAccountRecord[] }>(`/users/blocked${params}`);
      setItems(r.data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load accounts');
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void load(search), 300);
    return () => window.clearTimeout(t);
  }, [search, load]);

  const shown = (items ?? []).filter((u) => filter === 'all' || u.reasons.includes(filter));
  const count = (id: BlockedAccountReason | 'all') =>
    id === 'all' ? (items ?? []).length : (items ?? []).filter((u) => u.reasons.includes(id)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suspended accounts"
        description="Accounts that can't sign in. Set a temporary password to let the user back in — they choose their own password right after."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void load(search)}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/users">
                <ArrowLeft className="h-4 w-4" />
                All users
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone or email" className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                filter === f.id ? 'bg-primary text-white' : 'border border-border bg-surface hover:bg-slate-50'
              }`}
            >
              {f.label} ({count(f.id)})
            </button>
          ))}
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {!items && !error ? (
        <Skeleton className="h-64 w-full" />
      ) : shown.length === 0 ? (
        <EmptyState title="No accounts here" description="Every account in this list can sign in normally." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Why</th>
                    <th className="px-4 py-3">Details</th>
                    <th className="px-4 py-3">Last sign-in</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shown.map((u) => (
                    <tr key={u.id} className="align-top">
                      <td className="px-4 py-3">
                        <Link href={`/admin/users/${u.id}`} className="font-medium hover:underline">
                          {u.full_name_en}
                        </Link>
                        <p className="text-xs text-muted">
                          {u.phone} · {u.user_type}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.reasons.map((r) => (
                            <Badge key={r} variant={REASON_VARIANT[r]}>
                              {BLOCKED_ACCOUNT_REASON_LABELS[r]}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {u.reasons.includes('locked') && (
                          <p>
                            {u.failed_attempts} wrong passwords · locked until {when(u.locked_until)}
                          </p>
                        )}
                        {u.reasons.includes('temp_password') && u.temp_password_expires_at && (
                          <p>
                            Temporary password set {when(u.temp_password_set_at)} ·{' '}
                            {new Date(u.temp_password_expires_at).getTime() < Date.now()
                              ? 'expired — set a new one'
                              : `works until ${when(u.temp_password_expires_at)}`}
                          </p>
                        )}
                        {u.bound_device_label && <p>Device: {u.bound_device_label}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">{when(u.last_login)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" onClick={() => setTarget(u)}>
                          <KeyRound className="h-4 w-4" />
                          {u.reasons.includes('temp_password') ? 'New temporary password' : 'Set temporary password'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {target && (
        <TempPasswordDialog
          user={target}
          onClose={() => {
            setTarget(null);
            void load(search);
          }}
        />
      )}
    </div>
  );
}
