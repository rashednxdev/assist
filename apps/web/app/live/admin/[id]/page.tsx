'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';

const AgoraLiveRoom = dynamic(
  () => import('@/components/live/agora-live-room').then((m) => m.AgoraLiveRoom),
  { ssr: false },
);

interface SessionDetail {
  id: string;
  topic: string;
  details?: string;
  scheduled_at: string;
  status: string;
  invite_count?: number;
}

interface InviteRow {
  id: string;
  user_id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface UserPick {
  id: string;
  full_name_en: string;
  full_name_bn?: string;
  email: string;
  phone?: string;
  status?: string;
}

interface JoinPayload {
  app_id: string;
  channel: string;
  token: string;
  uid: number;
  role: 'host' | 'audience';
  topic: string;
  status: string;
}

export default function LiveStreamAdminDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserPick[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [join, setJoin] = useState<JoinPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const limit = 25;

  const invitedSet = useMemo(() => new Set(invites.map((i) => i.user_id)), [invites]);

  const load = useCallback(async () => {
    setError('');
    try {
      const [s, inv] = await Promise.all([
        apiFetch<{ data: SessionDetail }>(`/live-streams/${id}`),
        apiFetch<{ data: InviteRow[] }>(`/live-streams/${id}/invites`),
      ]);
      setSession(s.data);
      setInvites(inv.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, [id]);

  const loadUsers = useCallback(async (q: string, p: number) => {
    try {
      const params = new URLSearchParams({
        status: 'active',
        limit: String(limit),
        page: String(p),
      });
      if (q.trim()) params.set('q', q.trim());
      const res = await apiFetch<{ data: UserPick[]; meta?: { total?: number } }>(`/users?${params}`);
      setUsers(res.data);
      setUsersTotal(res.meta?.total ?? res.data.length);
      setSelectedIds([]);
    } catch {
      setUsers([]);
      setUsersTotal(0);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadUsers(query, page);
  }, [loadUsers, query, page]);

  function toggleSelect(userId: string) {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((x) => x !== userId) : [...prev, userId],
    );
  }

  function toggleSelectAllOnPage() {
    const pageIds = users.map((u) => u.id);
    const allSelected = pageIds.length > 0 && pageIds.every((uid) => selectedIds.includes(uid));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((uid) => !pageIds.includes(uid)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...pageIds])]);
    }
  }

  async function grantSelected() {
    if (selectedIds.length === 0) return;
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch<{ data: InviteRow[] }>(`/live-streams/${id}/invites`, {
        method: 'POST',
        body: JSON.stringify({ user_ids: selectedIds }),
      });
      setInvites(res.data);
      setSelectedIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not grant access');
    } finally {
      setBusy(false);
    }
  }

  async function revokeSelected() {
    if (selectedIds.length === 0) return;
    if (!confirm(`Revoke access for ${selectedIds.length} user(s)?`)) return;
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch<{ data: { invites: InviteRow[]; removed: number } }>(
        `/live-streams/${id}/invites/revoke`,
        {
          method: 'POST',
          body: JSON.stringify({ user_ids: selectedIds }),
        },
      );
      setInvites(res.data.invites);
      setSelectedIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke access');
    } finally {
      setBusy(false);
    }
  }

  async function setLifecycle(
    action: 'start' | 'pause' | 'resume' | 'restart' | 'end',
  ) {
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/live-streams/${id}/${action}`, { method: 'POST' });
      if (action === 'pause' || action === 'end') setJoin(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function goLiveAsHost() {
    setBusy(true);
    setError('');
    try {
      if (session?.status === 'scheduled' || session?.status === 'paused') {
        await apiFetch(
          `/live-streams/${id}/${session.status === 'paused' ? 'resume' : 'start'}`,
          { method: 'POST' },
        );
      }
      if (session?.status === 'ended' || session?.status === 'cancelled') {
        await apiFetch(`/live-streams/${id}/restart`, { method: 'POST' });
      }
      const res = await apiFetch<{ data: JoinPayload }>(`/live-streams/${id}/join`, { method: 'POST' });
      setJoin(res.data);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start stream');
    } finally {
      setBusy(false);
    }
  }

  async function removeSession() {
    if (!confirm('Delete this live session? Invites will no longer work.')) return;
    setBusy(true);
    try {
      await apiFetch(`/live-streams/${id}`, { method: 'DELETE' });
      router.push('/live/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setBusy(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(usersTotal / limit));
  const pageAllSelected =
    users.length > 0 && users.every((u) => selectedIds.includes(u.id));

  if (!session) {
    return (
      <div className="space-y-4">
        <PageHeader title="Live session" description={error || 'Loading…'} />
        {error ? <Alert variant="error">{error}</Alert> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={session.topic}
        description={`${new Date(session.scheduled_at).toLocaleString()} · ${session.status} · ${invites.length} allowed`}
      />
      {error ? <Alert variant="error">{error}</Alert> : null}

      {session.details ? (
        <Card>
          <CardContent className="pt-6 text-sm text-slate-600 whitespace-pre-wrap">{session.details}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Broadcast</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {session.status === 'scheduled' ? (
              <Button disabled={busy} onClick={() => void goLiveAsHost()}>
                Start &amp; go live
              </Button>
            ) : null}
            {session.status === 'live' && !join ? (
              <Button disabled={busy} onClick={() => void goLiveAsHost()}>
                Join as host
              </Button>
            ) : null}
            {session.status === 'live' ? (
              <Button variant="outline" disabled={busy} onClick={() => void setLifecycle('pause')}>
                Pause class
              </Button>
            ) : null}
            {session.status === 'paused' ? (
              <>
                <Button disabled={busy} onClick={() => void goLiveAsHost()}>
                  Resume &amp; go live
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => void setLifecycle('resume')}>
                  Resume (mark live)
                </Button>
              </>
            ) : null}
            {session.status === 'ended' || session.status === 'cancelled' ? (
              <Button disabled={busy} onClick={() => void goLiveAsHost()}>
                Restart class
              </Button>
            ) : null}
            {session.status === 'live' || session.status === 'paused' ? (
              <Button variant="outline" disabled={busy} onClick={() => void setLifecycle('end')}>
                End session
              </Button>
            ) : null}
            <Button variant="outline" disabled={busy} onClick={() => void removeSession()}>
              Delete
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Pause keeps the session and invites. Resume or restart without deleting. Mic carries your speech to all
            viewers; Agora live mode has no fixed viewer limit in the app.
          </p>
          {join ? (
            <AgoraLiveRoom
              appId={join.app_id}
              channel={join.channel}
              token={join.token}
              uid={join.uid}
              role="host"
              onError={setError}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">User access (batch)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="access-search">Search users</Label>
            <Input
              id="access-search"
              value={query}
              onChange={(e) => {
                setPage(1);
                setQuery(e.target.value);
              }}
              placeholder="Name, email, or phone"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={busy || selectedIds.length === 0} onClick={() => void grantSelected()}>
              Grant access ({selectedIds.length})
            </Button>
            <Button
              variant="outline"
              disabled={busy || selectedIds.length === 0}
              onClick={() => void revokeSelected()}
            >
              Revoke access ({selectedIds.length})
            </Button>
            <span className="text-xs text-muted-foreground">
              {invites.length} currently allowed · {usersTotal} users in list
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 w-10">
                    <input
                      type="checkbox"
                      checked={pageAllSelected}
                      onChange={toggleSelectAllOnPage}
                      aria-label="Select all on page"
                    />
                  </th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email / phone</th>
                  <th className="px-3 py-2">Access</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const allowed = invitedSet.has(u.id);
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(u.id)}
                            onChange={() => toggleSelect(u.id)}
                            aria-label={`Select ${u.full_name_en}`}
                          />
                        </td>
                        <td className="px-3 py-2 font-medium">
                          {u.full_name_bn?.trim() || u.full_name_en}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {u.email}
                          {u.phone ? ` · ${u.phone}` : ''}
                        </td>
                        <td className="px-3 py-2">
                          {allowed ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                              Allowed
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                              Not allowed
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || busy}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || busy}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
