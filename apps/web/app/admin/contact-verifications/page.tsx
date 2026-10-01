'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { ContactPersonRef, ContactVerificationAdminRow, ContactVerificationStatus } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';

const LIMIT = 30;

const STATUS: Record<ContactVerificationStatus, { label: string; variant: 'success' | 'warning' | 'secondary' }> = {
  verified: { label: 'Verified', variant: 'success' },
  legacy: { label: 'Existing member', variant: 'secondary' },
  pending: { label: 'Pending', variant: 'warning' },
};

function Person({ p }: { p: ContactPersonRef }) {
  return (
    <div>
      <Link href={`/admin/users/${p.id}`} className="font-medium hover:text-primary hover:underline">
        {p.name}
      </Link>
      <div className="text-xs text-muted">{[p.designation, p.office].filter(Boolean).join(', ')}</div>
    </div>
  );
}

export default function ContactVerificationsPage() {
  const [rows, setRows] = useState<ContactVerificationAdminRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ContactVerificationStatus | ''>('');
  const [verifier, setVerifier] = useState<ContactPersonRef | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (search) params.set('q', search);
    if (status) params.set('status', status);
    if (verifier) params.set('verifier_id', verifier.id);
    try {
      const r = await apiFetch<{ data: ContactVerificationAdminRow[]; meta: { total: number } }>(`/users/contact-verifications?${params}`);
      setRows(r.data);
      setTotal(r.meta.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load verifications');
    } finally {
      setLoading(false);
    }
  }, [page, search, status, verifier]);

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(row: ContactVerificationAdminRow) {
    if (!window.confirm(`Revoke contacts verification for ${row.user.name}? They will need a colleague to verify them again.`)) return;
    setBusyId(row.id);
    try {
      await apiFetch(`/users/${row.user.id}/contact-verification/revoke`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not revoke');
    } finally {
      setBusyId('');
    }
  }

  const pages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contact verifications"
        description="Users open the contact directory after a verified grade 1–11 colleague confirms their 8-digit code. See who verified whom."
      />

      <Card>
        <CardHeader className="space-y-3 border-b border-border pb-4">
          <CardTitle className="text-lg">{total} records</CardTitle>
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setSearch(q.trim());
            }}
          >
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, phone or 8-digit code" className="max-w-xs" />
            <select
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value as ContactVerificationStatus | '');
              }}
              className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="legacy">Existing member</option>
            </select>
            <Button type="submit" variant="outline">
              Search
            </Button>
            {verifier && (
              <Badge variant="default" className="gap-1">
                Verified by {verifier.name}
                <button type="button" onClick={() => setVerifier(null)} aria-label="Clear verifier filter">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </form>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <div className="p-4">
              <Alert variant="error">{error}</Alert>
            </div>
          )}
          <DataTable
            className="rounded-none border-0 shadow-none"
            loading={loading}
            data={rows}
            emptyTitle="No records"
            emptyDescription="Verification records appear once users set their office and designation."
            columns={[
              { key: 'user', header: 'User', cell: (r) => <Person p={r.user} /> },
              {
                key: 'status',
                header: 'Status',
                cell: (r) => (
                  <div className="space-y-1">
                    <Badge variant={STATUS[r.status].variant}>{STATUS[r.status].label}</Badge>
                    {r.code && <div className="font-mono text-xs text-muted">{r.code}</div>}
                  </div>
                ),
              },
              {
                key: 'verifier',
                header: 'Verified by',
                cell: (r) =>
                  r.verifier ? (
                    <div className="space-y-1">
                      <Person p={r.verifier} />
                      <button type="button" className="text-xs text-primary hover:underline" onClick={() => { setPage(1); setVerifier(r.verifier); }}>
                        All verified by them
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  ),
              },
              {
                key: 'when',
                header: 'When',
                className: 'whitespace-nowrap',
                cell: (r) => (
                  <span className="text-xs text-muted">{new Date(r.verified_at ?? r.created_at).toLocaleString()}</span>
                ),
              },
              {
                key: 'actions',
                header: '',
                cell: (r) =>
                  r.status === 'pending' ? null : (
                    <Button size="sm" variant="ghost" disabled={busyId === r.id} onClick={() => void revoke(r)}>
                      Revoke
                    </Button>
                  ),
              },
            ]}
          />
          {pages > 1 && (
            <div className="flex items-center justify-between border-t border-border p-3 text-sm">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="text-muted">
                Page {page} of {pages}
              </span>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
