'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ExternalLink, Users, MessageSquare, Radio } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

const AgoraLiveRoom = dynamic(
  () => import('@/components/live/agora-live-room').then((m) => m.AgoraLiveRoom),
  { ssr: false },
);

interface SessionDetail {
  id: string;
  topic: string;
  scheduled_at: string;
  status: string;
  allow_guest_messages?: boolean;
  can_host?: boolean;
  permission_status?: string;
  video_platform?: 'agora' | 'zoom';
}

interface JoinPayload {
  video_platform?: 'agora' | 'zoom';
  app_id: string;
  channel: string;
  token: string;
  uid: number;
  role: 'host' | 'audience';
  topic: string;
  status: string;
}

interface GuestRow {
  id: string;
  user_id: string;
  name: string;
  email?: string;
  phone?: string;
  role: 'host' | 'audience';
  joined_at: string;
  last_seen_at: string;
}

interface GuestMessageRow {
  id: string;
  from_user_id: string;
  from_name: string;
  body: string;
  created_at: string;
}

function statusTone(status: string) {
  if (status === 'live') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  if (status === 'paused') return 'bg-amber-500/20 text-amber-200 border-amber-500/40';
  if (status === 'ended' || status === 'cancelled') return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
  return 'bg-sky-500/20 text-sky-200 border-sky-500/40';
}

export default function LiveRoomManagePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [join, setJoin] = useState<JoinPayload | null>(null);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [messages, setMessages] = useState<GuestMessageRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [msgBusy, setMsgBusy] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [denied, setDenied] = useState(false);
  const messagesListRef = useRef<HTMLUListElement>(null);
  const prevMessageCountRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: SessionDetail }>(`/live-streams/${id}`);
      if (res.data.video_platform === 'zoom') {
        router.replace(`/live/zoom-room/${id}`);
        return;
      }
      if (!res.data.can_host) {
        setDenied(true);
        setSession(null);
        return;
      }
      setDenied(false);
      setSession(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, [id, router]);

  useEffect(() => {
    void import('@/lib/auth').then(({ fetchMe }) =>
      fetchMe()
        .then((me) => {
          const u = me.data;
          setIsAdmin(
            Boolean(
              u.is_super_admin || u.user_type === 'system_admin' || u.user_type === 'admin',
            ),
          );
        })
        .catch(() => setIsAdmin(false)),
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!id || denied) return;
    let cancelled = false;
    async function loadGuests() {
      try {
        const res = await apiFetch<{ data: GuestRow[] }>(`/live-streams/${id}/guests`);
        if (!cancelled) setGuests(res.data);
      } catch {
        // ignore poll errors
      }
    }
    void loadGuests();
    const timer = window.setInterval(() => void loadGuests(), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [id, denied]);

  useEffect(() => {
    if (!id || denied) return;
    let cancelled = false;
    let afterId: string | undefined;

    async function loadMessages(initial: boolean) {
      try {
        const qs = afterId && !initial ? `?after=${encodeURIComponent(afterId)}` : '';
        const res = await apiFetch<{ data: GuestMessageRow[] }>(`/live-streams/${id}/messages${qs}`);
        if (cancelled) return;
        if (initial) {
          setMessages(res.data);
        } else if (res.data.length) {
          setMessages((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            const next = [...prev];
            for (const m of res.data) {
              if (!seen.has(m.id)) next.push(m);
            }
            return next.slice(-200);
          });
        }
        if (res.data.length) {
          afterId = res.data[res.data.length - 1]?.id ?? afterId;
        }
      } catch {
        // ignore poll errors
      }
    }

    void loadMessages(true);
    const timer = window.setInterval(() => void loadMessages(false), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [id, denied]);

  const messagesNewestFirst = useMemo(
    () =>
      [...messages].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [messages],
  );

  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && messagesListRef.current) {
      messagesListRef.current.scrollTop = 0;
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  async function toggleGuestMessages(allow: boolean) {
    if (!id) return;
    setMsgBusy(true);
    setError('');
    try {
      const res = await apiFetch<{ data: SessionDetail }>(`/live-streams/${id}/guest-messages`, {
        method: 'PATCH',
        body: JSON.stringify({ allow_guest_messages: allow }),
      });
      setSession((prev) =>
        prev
          ? { ...prev, allow_guest_messages: res.data.allow_guest_messages ?? allow }
          : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update messaging');
    } finally {
      setMsgBusy(false);
    }
  }

  async function setLifecycle(action: 'start' | 'pause' | 'resume' | 'restart' | 'end') {
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
      const res = await apiFetch<{ data: JoinPayload }>(`/live-streams/${id}/join`, {
        method: 'POST',
        body: JSON.stringify({ as_host: true }),
      });
      if (res.data.video_platform === 'zoom') {
        router.replace(`/live/zoom-room/${id}`);
        return;
      }
      setJoin(res.data);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start stream');
    } finally {
      setBusy(false);
    }
  }

  const guestCount = guests.filter((g) => g.role === 'audience').length;

  if (denied) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        <Alert variant="error">You are not the host for this class.</Alert>
        <Button asChild variant="outline" className="border-slate-700 bg-slate-950 text-slate-200">
          <Link href="/live/hosting">Back to my host classes</Link>
        </Button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-slate-400">{error || 'Loading live control room…'}</p>
        {error ? <Alert variant="error" className="mt-4">{error}</Alert> : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-6 sm:py-6">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Radio className="h-4 w-4 shrink-0 text-pink-400" />
            <h1 className="truncate text-lg font-bold text-white sm:text-xl">{session.topic}</h1>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${statusTone(session.status)}`}
            >
              {session.status}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {new Date(session.scheduled_at).toLocaleString()} · Live control room
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin ? (
            <Button asChild variant="outline" size="sm" className="border-slate-700 bg-slate-950 text-slate-200">
              <Link href={`/live/admin/${id}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Edit class
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm" className="border-slate-700 bg-slate-950 text-slate-200">
              <Link href="/live/hosting">My host classes</Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm" className="border-slate-700 bg-slate-950 text-slate-200">
            <Link href={`/live/${id}`} target="_blank" rel="noreferrer">
              Guest view
            </Link>
          </Button>
        </div>
      </header>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-300">Session controls</h2>
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
            <Button
              variant="outline"
              className="border-slate-600 bg-slate-950 text-slate-100"
              disabled={busy}
              onClick={() => void setLifecycle('pause')}
            >
              Pause class
            </Button>
          ) : null}
          {session.status === 'paused' ? (
            <>
              <Button disabled={busy} onClick={() => void goLiveAsHost()}>
                Resume &amp; go live
              </Button>
              <Button
                variant="outline"
                className="border-slate-600 bg-slate-950 text-slate-100"
                disabled={busy}
                onClick={() => void setLifecycle('resume')}
              >
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
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    'End this live session now? Guests will be disconnected and Agora minutes stop (saves cost). You can restart later without deleting.',
                  )
                ) {
                  void setLifecycle('end');
                }
              }}
            >
              End session (stop billing)
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-slate-400">
          Pause keeps invites; guests cannot watch until you resume. Always end when finished so Agora
          minutes stop. Screen share works on desktop Chrome/Edge.
        </p>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-pink-500/30 bg-pink-950/40 px-3 py-2.5">
          <div>
            <div className="text-sm font-semibold text-pink-100">Guest messages</div>
            <p className="text-xs text-pink-200/80">
              {session.allow_guest_messages
                ? 'Allowed — guests can write to you'
                : 'Disallowed — turn on when you want questions'}
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant={session.allow_guest_messages ? 'default' : 'outline'}
              className={!session.allow_guest_messages ? 'border-slate-600 bg-slate-950 text-slate-100' : undefined}
              disabled={msgBusy || Boolean(session.allow_guest_messages)}
              onClick={() => void toggleGuestMessages(true)}
            >
              Allow
            </Button>
            <Button
              size="sm"
              variant={!session.allow_guest_messages ? 'default' : 'outline'}
              className={
                session.allow_guest_messages ? 'border-slate-600 bg-slate-950 text-slate-100' : undefined
              }
              disabled={msgBusy || !session.allow_guest_messages}
              onClick={() => void toggleGuestMessages(false)}
            >
              Disallow
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-300">
            Broadcast · mic · screen share
          </h2>
          {join ? (
            <div className="rounded-xl bg-white p-3 text-slate-900">
              <AgoraLiveRoom
                appId={join.app_id}
                channel={join.channel}
                token={join.token}
                uid={join.uid}
                role="host"
                onError={setError}
              />
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Use Start / Join as host above, then tap <strong>Start mic &amp; go live</strong> in the room.
            </p>
          )}
        </section>

        <div className="flex min-h-0 flex-col gap-4 lg:max-h-[calc(100vh-10rem)]">
          <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="mb-2 flex shrink-0 items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-300">
              <MessageSquare className="h-4 w-4" />
              Messages
              <span className="ml-auto text-xs font-medium normal-case tracking-normal text-slate-400">
                {messages.length} total · newest first
              </span>
            </h2>
            {messages.length === 0 ? (
              <p className="text-sm text-slate-400">No guest messages yet.</p>
            ) : (
              <ul
                ref={messagesListRef}
                className="min-h-[21rem] max-h-[min(42rem,calc(100vh-14rem))] flex-1 space-y-2 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 p-3"
              >
                {messagesNewestFirst.map((m) => (
                  <li key={m.id} className="rounded-lg bg-slate-900 px-3 py-2.5 text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold text-slate-100">{m.from_name}</span>
                      <span className="shrink-0 text-[11px] text-slate-500">
                        {new Date(m.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-slate-300">{m.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="shrink-0 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-300">
              <Users className="h-4 w-4" />
              Guests
              <span className="ml-auto text-xs font-medium normal-case tracking-normal text-slate-400">
                {guestCount} guest{guestCount === 1 ? '' : 's'} · {guests.length} in room
              </span>
            </h2>
            {guests.length === 0 ? (
              <p className="text-sm text-slate-400">No one has joined yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-sm">
                  <thead className="bg-slate-950 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Contact</th>
                      <th className="px-3 py-2">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {guests.map((g) => (
                      <tr key={g.id}>
                        <td className="px-3 py-2 font-medium text-slate-100">{g.name}</td>
                        <td className="px-3 py-2 text-slate-400">
                          {g.email}
                          {g.phone ? ` · ${g.phone}` : ''}
                        </td>
                        <td className="px-3 py-2">
                          {g.role === 'host' ? (
                            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-200">
                              Host
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-200">
                              Guest
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
