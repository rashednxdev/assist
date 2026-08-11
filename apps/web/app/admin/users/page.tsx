'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';

const PAGE_SIZE = 20;

interface UserRow {
  id: string;
  full_name_en: string;
  full_name_bn?: string;
  email: string;
  phone: string;
  user_type: string;
  status: string;
  amount_received?: number;
}

function statusVariant(status: string): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (status === 'active') return 'success';
  if (status === 'pending_verify') return 'warning';
  if (status === 'suspended') return 'destructive';
  return 'secondary';
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
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
  }, [search, page]);

  // Any search change starts back at page 1 — a stale page number from a previous, longer
  // result set could otherwise land past the end of a narrower search's results.
  useEffect(() => {
    setPage(1);
  }, [search]);

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
          <div className="relative mt-3 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or phone..."
              className="pl-9"
            />
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
                header: 'Amount received',
                className: 'hidden sm:table-cell',
                cell: (u) =>
                  typeof u.amount_received === 'number'
                    ? u.amount_received.toLocaleString()
                    : '0',
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
                {total} user{total === 1 ? '' : 's'} · page {page} of {totalPages}
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
