'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { MarkupText } from '@/components/shared/markup-text';
import { ComparisonTableView } from '@/components/questions/comparison-table-view';
import { ProcessFlowPreview } from '@/components/books/process-flow-preview';
import {
  hasComparisonTableContent,
  hasProcessContent,
  type LivePermissionStatus,
  type LiveStreamSlide,
  type LiveStreamStatus,
} from '@ibas/shared-types';
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
  is_previous?: boolean;
  slides?: LiveStreamSlide[];
  slide_count?: number;
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
      title: 'You can join as host on the admin page',
      body: 'Host broadcasting is only from Live admin on web. Here you can watch as a viewer.',
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
      const res = await apiFetch<{ data: JoinPayload }>(`/live-streams/${id}/join`, {
        method: 'POST',
        body: JSON.stringify({ as_host: false }),
      });
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
  const isPrevious = Boolean(session.is_previous) || session.status === 'ended';
  const slides = session.slides ?? [];
  const isPermitted = session.permission_status !== 'not_permitted';

  if (isPrevious) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title={session.topic}
          description={`${new Date(session.scheduled_at).toLocaleString()} · Previous class`}
        />
        {error ? <Alert variant="error">{error}</Alert> : null}
        {!isPermitted ? (
          <div className={`rounded-2xl border p-4 ${perm.tone}`}>
            <div className="text-base font-bold">Presentation locked</div>
            <p className="mt-1 text-sm opacity-90">
              Everyone can see this class in the list. An admin must invite you to open the
              presentation.
            </p>
          </div>
        ) : slides.length === 0 ? (
          <p className="text-sm text-muted-foreground">No presentation slides published yet.</p>
        ) : (
          <div className="space-y-8">
            <p className="text-center text-xs font-bold uppercase tracking-wide text-pink-800">
              Class presentation · {slides.length} slide{slides.length === 1 ? '' : 's'}
            </p>
            {slides.map((slide, index) => (
              <Card key={`slide-${index}`} className="border-pink-100 shadow-sm">
                <CardContent className="space-y-4 px-6 py-10 sm:px-10">
                  <p className="text-center text-xs font-bold text-slate-400">
                    {index + 1} / {slides.length}
                  </p>
                  {slide.title?.trim() ? (
                    <div className="text-center text-2xl font-extrabold leading-snug text-slate-900 sm:text-3xl">
                      <MarkupText text={slide.title} />
                    </div>
                  ) : null}
                  {slide.context?.trim() ? (
                    <div className="text-base leading-8 text-slate-800 sm:text-lg">
                      <MarkupText text={slide.context} />
                    </div>
                  ) : null}
                  {hasComparisonTableContent(slide.table) ? (
                    <ComparisonTableView table={slide.table} label="" />
                  ) : null}
                  {hasProcessContent(slide.process) ? (
                    <div className="space-y-3 rounded-xl border border-border bg-slate-50 p-4">
                      {slide.process?.title?.trim() ? (
                        <p className="text-lg font-bold text-slate-900">{slide.process.title}</p>
                      ) : null}
                      {slide.process?.details?.trim() ? (
                        <div className="text-sm text-slate-700">
                          <MarkupText text={slide.process.details} />
                        </div>
                      ) : null}
                      <ProcessFlowPreview steps={slide.process?.steps ?? []} />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
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

      <div className={`rounded-2xl border p-4 ${perm.tone}`}>
        <div className="text-base font-bold">{perm.title}</div>
        <p className="mt-1 text-sm opacity-90">{perm.body}</p>
      </div>

      {session.status === 'paused' ? (
        <Alert variant="warning">
          This class is paused. You can join again when the host resumes.
        </Alert>
      ) : null}

      {session.details ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-700">
            <MarkupText text={session.details} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Video room</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!join ? (
            <Button
              disabled={
                busy ||
                !session.can_join ||
                session.permission_status === 'not_permitted' ||
                session.status === 'paused' ||
                session.status === 'ended'
              }
              onClick={() => void joinSession()}
            >
              {busy
                ? 'Joining…'
                : session.permission_status === 'not_permitted'
                  ? 'Join locked'
                  : session.status === 'paused'
                    ? 'Waiting for resume'
                    : session.status === 'ended'
                      ? 'Session ended'
                      : 'Join live class'}
            </Button>
          ) : (
            <AgoraLiveRoom
              appId={join.app_id}
              channel={join.channel}
              token={join.token}
              uid={join.uid}
              role="audience"
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
