'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Phone, MessageCircle, KeyRound } from 'lucide-react';
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

type SortMode = 'recent' | 'paid' | 'unpaid';

function matchesQuery(user: UserRow, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [user.full_name_en, user.full_name_bn, user.email, user.phone].some((value) =>
    (value ?? '').toLowerCase().includes(needle),
  );
}

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
  const [loaded, setLoaded] = useState<UserRow[]>([]);
  const [directoryTotal, setDirectoryTotal] = useState(0);
  const [pagesLoaded, setPagesLoaded] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [paySort, setPaySort] = useState<SortMode>('recent');
  const [serverMatches, setServerMatches] = useState<UserRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setLoaded([]);
    setServerMatches([]);
    setPagesLoaded(0);
    const params = new URLSearchParams({
      page: '1',
      limit: String(PAGE_SIZE),
      sort: paySort,
    });
    apiFetch<{ data: UserRow[]; meta: { total: number } }>(`/users?${params.toString()}`)
      .then((res) => {
        if (cancelled) return;
        setLoaded(res.data);
        setDirectoryTotal(res.meta.total);
        setPagesLoaded(1);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load users.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [paySort]);

  const query = search.trim();
  const haveAll = directoryTotal > 0 && loaded.length >= directoryTotal;
  const localMatches = useMemo(
    () => (query ? loaded.filter((user) => matchesQuery(user, query)) : loaded),
    [loaded, query],
  );

  useEffect(() => {
    if (query.length < 2 || haveAll) {
      setServerMatches([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({
        page: '1',
        limit: String(PAGE_SIZE),
        sort: paySort,
        q: query,
      });
      apiFetch<{ data: UserRow[]; meta: { total: number } }>(`/users?${params.toString()}`)
        .then((res) => {
          if (!cancelled) setServerMatches(res.data);
        })
        .catch(() => {
          if (!cancelled) setServerMatches([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, haveAll, paySort]);

  const users = useMemo(() => {
    if (!query) return loaded;
    if (haveAll || query.length < 2) return localMatches;
    const seen = new Set(localMatches.map((user) => user.id));
    const extra = serverMatches.filter((user) => !seen.has(user.id));
    return [...localMatches, ...extra];
  }, [query, loaded, haveAll, localMatches, serverMatches]);

  async function loadMore() {
    if (loadingMore || query || loaded.length >= directoryTotal) return;
    setLoadingMore(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(pagesLoaded + 1),
        limit: String(PAGE_SIZE),
        sort: paySort,
      });
      const res = await apiFetch<{ data: UserRow[]; meta: { total: number } }>(`/users?${params.toString()}`);
      setDirectoryTotal(res.meta.total);
      setLoaded((prev) => {
        const seen = new Set(prev.map((user) => user.id));
        return [...prev, ...res.data.filter((user) => !seen.has(user.id))];
      });
      setPagesLoaded((page) => page + 1);
    } catch {
      setError('Could not load more users.');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="User manage"
        description="Manage system users, workflow roles, and per-user module access."
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/users/blocked">
                <KeyRound className="h-4 w-4" />
                Suspended accounts
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/users/new">
                <Plus className="h-4 w-4" />
                Add user
              </Link>
            </Button>
          </div>
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
              onChange={(e) =>
                setPaySort(e.target.value === 'paid' || e.target.value === 'unpaid' ? e.target.value : 'recent')
              }
              className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Sort users"
            >
              <option value="recent">Newest</option>
              <option value="paid">Paid first</option>
              <option value="unpaid">Unpaid first</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          <DataTable
            className="border-0 shadow-none rounded-none"
            loading={loading && users.length === 0}
            data={users}
            emptyTitle={query ? 'No matching users' : 'No users yet'}
            emptyDescription={
              query ? 'Try another name, email, or mobile number.' : 'Create the first user to get started.'
            }
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
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-primary hover:bg-muted"
                  >
                    Edit
                  </Link>
                ),
              },
            ]}
          />
          {!loading || users.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
            <span className="text-xs text-muted">
              {error
                ? error
                : query
                  ? `${users.length} match${users.length === 1 ? '' : 'es'}${
                      searching ? ' · searching the full directory…' : haveAll ? ' · from loaded users' : ''
                    }`
                  : `${loaded.length} of ${directoryTotal} user${directoryTotal === 1 ? '' : 's'} loaded`}
            </span>
            {!query && loaded.length < directoryTotal ? (
              <Button type="button" variant="outline" size="sm" disabled={loadingMore} onClick={() => void loadMore()}>
                {loadingMore ? 'Loading…' : `Load ${Math.min(PAGE_SIZE, directoryTotal - loaded.length)} earlier`}
              </Button>
            ) : null}
          </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
