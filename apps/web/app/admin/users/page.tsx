'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, ChevronLeft, ChevronRight, Phone, MessageCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { phoneTelHref, phoneWhatsAppHref } from '@/lib/contact';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { formatMobileAppVersion, isLatestMobileAppVersion } from '@/lib/app-version';

const PAGE_SIZE = 100;

interface UserRow {
  id: string;
  full_name_en: string;
  full_name_bn?: string;
  email: string;
  phone: string;
  user_type: string;
  status: string;
  amount_received?: number;
  client_app_version?: string | null;
  client_platform?: 'mobile' | 'web' | null;
  client_app_version_at?: string | null;
}

function statusVariant(status: string): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (status === 'active') return 'success';
  if (status === 'pending_verify') return 'warning';
  if (status === 'suspended') return 'destructive';
  return 'secondary';
}

function ContactActions({ user }: { user: UserRow }) {
  const tel = user.phone ? phoneTelHref(user.phone) : null;
  const wa = user.phone
    ? phoneWhatsAppHref(user.phone, `Hi ${user.full_name_en}, regarding ProAssist.`)
    : null;
  if (!tel && !wa) return <span className="text-xs text-muted">—</span>;
  return (
    <div className="flex items-center justify-end gap-1">
      {tel ? (
        <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0" title="Call">
          <a href={tel} aria-label={`Call ${user.full_name_en}`}>
            <Phone className="h-4 w-4 text-sky-700" />
          </a>
        </Button>
      ) : null}
      {wa ? (
        <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0" title="WhatsApp">
          <a href={wa} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${user.full_name_en}`}>
            <MessageCircle className="h-4 w-4 text-emerald-600" />
          </a>
        </Button>
      ) : null}
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [paySort, setPaySort] = useState<'paid' | 'unpaid'>('paid');

  useEffect(() => {
    setLoading(true);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        sort: paySort,
      });
      if (search.trim()) params.set('q', search.trim());
      apiFetch<{ data: UserRow[]; meta: { total: number } }>(`/users?${params.toString()}`)
        .then((res) => {
          if (cancelled) return;
          setUsers(res.data);
          setTotal(res.meta.total);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, page, paySort]);

  // Any search change starts back at page 1 — a stale page number from a previous, longer
  // result set could otherwise land past the end of a narrower search's results.
  useEffect(() => {
    setPage(1);
  }, [search, paySort]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage system users, workflow roles, and module access."
        action={
          <Button asChild>
            <Link href="/admin/users/new">
              <Plus className="h-4 w-4" />
              Add user
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-lg">All users</CardTitle>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, or phone..."
                className="pl-9"
              />
            </div>
            <select
              value={paySort}
              onChange={(e) => setPaySort(e.target.value === 'unpaid' ? 'unpaid' : 'paid')}
              className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Sort by payment"
            >
              <option value="paid">Paid first</option>
              <option value="unpaid">Unpaid first</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          <DataTable
            className="border-0 shadow-none rounded-none"
            loading={loading}
            data={users}
            emptyTitle="No users yet"
            emptyDescription="Create the first user to get started."
            columns={[
              {
                key: 'name',
                header: 'Name',
                cell: (u) => (
                  <div>
                    <div className="font-medium text-foreground">{u.full_name_en}</div>
                    {u.full_name_bn && <div className="text-xs text-muted">{u.full_name_bn}</div>}
                  </div>
                ),
              },
              { key: 'email', header: 'Email', cell: (u) => u.email },
              { key: 'phone', header: 'Phone', className: 'hidden md:table-cell', cell: (u) => u.phone },
              {
                key: 'amount_received',
                header: 'Payment',
                className: 'hidden sm:table-cell',
                cell: (u) => {
                  const paid = Number(u.amount_received ?? 0) > 0;
                  return (
                    <div className="space-y-0.5">
                      <Badge variant={paid ? 'success' : 'warning'}>{paid ? 'Paid' : 'Unpaid'}</Badge>
                      <div className="text-xs text-muted">
                        {typeof u.amount_received === 'number'
                          ? u.amount_received.toLocaleString()
                          : '0'}
                      </div>
                    </div>
                  );
                },
              },
              {
                key: 'type',
                header: 'Type',
                cell: (u) => <Badge variant="outline">{u.user_type}</Badge>,
              },
              {
                key: 'status',
                header: 'Status',
                cell: (u) => <Badge variant={statusVariant(u.status)}>{u.status}</Badge>,
              },
              {
                key: 'client_version',
                header: 'Mobile app',
                className: 'hidden lg:table-cell',
                cell: (u) => {
                  const version = formatMobileAppVersion(u.client_app_version, u.client_platform);
                  const updated = isLatestMobileAppVersion(u.client_app_version, u.client_platform);
                  return (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-foreground">{version}</span>
                      {updated ? (
                        <Badge variant="success" className="text-[10px]">
                          Updated
                        </Badge>
                      ) : null}
                    </div>
                  );
                },
              },
              {
                key: 'contact',
                header: 'Contact',
                className: 'text-right',
                cell: (u) => <ContactActions user={u} />,
              },
              {
                key: 'actions',
                header: '',
                className: 'text-right',
                cell: (u) => (
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/admin/users/${u.id}`}>Edit</Link>
                  </Button>
                ),
              },
            ]}
          />
          {!loading && users.length > 0 && (
            <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
              <span className="text-xs text-muted">
                {total} user{total === 1 ? '' : 's'} · page {page} of {totalPages} · {PAGE_SIZE} per
                page
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
