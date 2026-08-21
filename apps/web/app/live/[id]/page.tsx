'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { LivePermissionStatus, LiveStreamStatus } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  status: LiveStreamStatus;
  host_name?: string;
  permission_status: LivePermissionStatus;
  can_join: boolean;
}

interface JoinPayload {
  app_id: string;
  channel: string;
  token: string;
  uid: number;
  role: 'host' | 'audience';
}

function permissionCopy(status: LivePermissionStatus) {
  if (status === 'host') {
    return {
      title: 'You can join as host',
      body: 'You are the session host or an admin. You may start or watch this live class.',
      tone: 'bg-amber-50 border-amber-100 text-amber-900',
    };
  }
  if (status === 'permitted') {
    return {
      title: 'You are permitted to join',
      body: 'An admin invited you to this live class. Join when the session is live.',
      tone: 'bg-emerald-50 border-emerald-100 text-emerald-900',
    };
  }
  return {
    title: 'You are not permitted',
    body: 'You can see this session, but only invited users can enter the video room. Ask an admin for access.',
    tone: 'bg-rose-50 border-rose-100 text-rose-900',
  };
}

export default function LiveStreamWatchPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [join, setJoin] = useState<JoinPayload | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: SessionDetail }>(`/live-streams/${id}`);
      setSession(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function joinSession() {
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch<{ data: JoinPayload }>(`/live-streams/${id}/join`, { method: 'POST' });
      setJoin(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join');
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <div className="space-y-4">
        <PageHeader title="Live class" description={error || 'Loading…'} />
        {error ? <Alert variant="error">{error}</Alert> : null}
      </div>
    );
  }

  const perm = permissionCopy(session.permission_status);

  return (
    <div className="space-y-6">
      <PageHeader
        title={session.topic}
        description={`${new Date(session.scheduled_at).toLocaleString()} · ${session.status}`}
      />
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className={`rounded-2xl border p-4 ${perm.tone}`}>
        <div className="text-base font-bold">{perm.title}</div>
        <p className="mt-1 text-sm opacity-90">{perm.body}</p>
      </div>

      {session.details ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-slate-600">{session.details}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Video room</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!join ? (
            <Button
              disabled={busy || !session.can_join || session.permission_status === 'not_permitted'}
              onClick={() => void joinSession()}
            >
              {busy ? 'Joining…' : session.permission_status === 'not_permitted' ? 'Join locked' : 'Join live class'}
            </Button>
          ) : (
            <AgoraLiveRoom
              appId={join.app_id}
              channel={join.channel}
              token={join.token}
              uid={join.uid}
              role={join.role}
              onError={setError}
            />
          )}
          {session.host_name ? (
            <p className="text-xs text-muted-foreground">Host: {session.host_name}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
