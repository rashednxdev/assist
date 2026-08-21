'use client';

import { useCallback, useEffect, useState } from 'react';
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
  email: string;
  phone?: string;
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
  const [results, setResults] = useState<UserPick[]>([]);
  const [join, setJoin] = useState<JoinPayload | null>(null);
  const [busy, setBusy] = useState(false);

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

  useEffect(() => {
    void load();
  }, [load]);

  async function searchUsers(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    try {
      const params = new URLSearchParams({ q: q.trim(), limit: '12' });
      const res = await apiFetch<{ data: UserPick[] }>(`/users?${params}`);
      setResults(res.data);
    } catch {
      setResults([]);
    }
  }

  async function addInvite(userId: string) {
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch<{ data: InviteRow[] }>(`/live-streams/${id}/invites`, {
        method: 'POST',
        body: JSON.stringify({ user_ids: [userId] }),
      });
      setInvites(res.data);
      setQuery('');
      setResults([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not invite');
    } finally {
      setBusy(false);
    }
  }

  async function removeInvite(userId: string) {
    setBusy(true);
    try {
      await apiFetch(`/live-streams/${id}/invites/${userId}`, { method: 'DELETE' });
      setInvites((prev) => prev.filter((i) => i.user_id !== userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove');
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(action: 'start' | 'end') {
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/live-streams/${id}/${action}`, { method: 'POST' });
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
      if (session?.status === 'scheduled') {
        await apiFetch(`/live-streams/${id}/start`, { method: 'POST' });
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
    if (!confirm('Delete this live session?')) return;
    setBusy(true);
    try {
      await apiFetch(`/live-streams/${id}`, { method: 'DELETE' });
      router.push('/live/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setBusy(false);
    }
  }

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
        description={`${new Date(session.scheduled_at).toLocaleString()} · ${session.status}`}
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
            {session.status !== 'live' && session.status !== 'ended' ? (
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
              <Button variant="outline" disabled={busy} onClick={() => void setStatus('end')}>
                End session
              </Button>
            ) : null}
            <Button variant="outline" disabled={busy} onClick={() => void removeSession()}>
              Delete
            </Button>
          </div>
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
          <CardTitle className="text-base">Allowed users</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-search">Search users to invite</Label>
            <Input
              id="invite-search"
              value={query}
              onChange={(e) => void searchUsers(e.target.value)}
              placeholder="Name, email, or phone"
            />
          </div>
          {results.length > 0 ? (
            <div className="rounded-xl border divide-y">
              {results.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  disabled={busy || invites.some((i) => i.user_id === u.id)}
                  onClick={() => void addInvite(u.id)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  <span>
                    <span className="font-medium">{u.full_name_en}</span>
                    <span className="block text-xs text-slate-500">
                      {u.email}
                      {u.phone ? ` · ${u.phone}` : ''}
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-pink-700">Invite</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="space-y-2">
            {invites.length === 0 ? (
              <p className="text-sm text-muted-foreground">No one invited yet — only you (host/admin) can join.</p>
            ) : (
              invites.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{inv.name}</div>
                    <div className="text-xs text-slate-500">
                      {inv.email}
                      {inv.phone ? ` · ${inv.phone}` : ''}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void removeInvite(inv.user_id)}
                  >
                    Remove
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
