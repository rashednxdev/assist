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
  type ZoomLiveStreamJoinPayload,
} from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';

const ZoomMeetingRoom = dynamic(
  () => import('@/components/live/zoom-meeting-room').then((m) => m.ZoomMeetingRoom),
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
  can_host?: boolean;
  is_previous?: boolean;
  slides?: LiveStreamSlide[];
  slide_count?: number;
  allow_guest_messages?: boolean;
  can_view_presentation?: boolean;
  access_type?: 'free' | 'paid';
  payment_blocked?: boolean;
  payment_required_message?: string;
}

type JoinPayload = ZoomLiveStreamJoinPayload;

function permissionCopy(status: LivePermissionStatus, canHost?: boolean) {
  if (status === 'host' || canHost) {
    return {
      title: 'You can host from this browser',
      body: 'Join as host on phone or laptop. Tap “Start mic & go live” after connecting so guests hear you.',
      tone: 'bg-amber-50 border-amber-100 text-amber-900',
    };
  }
  if (status === 'permitted') {
    return {
      title: 'You are permitted to join',
      body: 'An admin invited you to this Zoom class. Join when live for two-way audio and video.',
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
  const [msgBody, setMsgBody] = useState('');
  const [msgBusy, setMsgBusy] = useState(false);
  const [msgHint, setMsgHint] = useState('');

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

  useEffect(() => {
    if (!join || !id) return;
    const currentJoin = join;
    let cancelled = false;
    async function poll() {
      try {
        const res = await apiFetch<{ data: SessionDetail }>(`/live-streams/${id}`);
        if (cancelled) return;
        setSession(res.data);
        if (currentJoin.role === 'audience' && res.data.status !== 'live') {
          setJoin(null);
          setError(
            res.data.status === 'paused'
              ? 'Class paused — left video room to save connection time.'
              : 'Class ended — left video room.',
          );
        }
      } catch {
        // ignore poll errors
      }
    }
    const timer = window.setInterval(() => void poll(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [join, id]);

  async function joinSession(asHost: boolean) {
    setBusy(true);
    setError('');
    try {
      if (asHost) {
        if (session?.status === 'scheduled' || session?.status === 'paused') {
          await apiFetch(
            `/live-streams/${id}/${session.status === 'paused' ? 'resume' : 'start'}`,
            { method: 'POST' },
          );
        }
        if (session?.status === 'ended' || session?.status === 'cancelled') {
          await apiFetch(`/live-streams/${id}/restart`, { method: 'POST' });
        }
      }
      const res = await apiFetch<{ data: JoinPayload }>(`/live-streams/${id}/join`, {
        method: 'POST',
        body: JSON.stringify({ as_host: asHost }),
      });
      setJoin(res.data);
      setSession((prev) =>
        prev
          ? {
              ...prev,
              status: res.data.status ?? (asHost ? 'live' : prev.status),
              allow_guest_messages:
                res.data.allow_guest_messages ?? prev.allow_guest_messages,
            }
          : prev,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join');
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage() {
    if (!id || !msgBody.trim()) return;
    setMsgBusy(true);
    setMsgHint('');
    setError('');
    try {
      await apiFetch(`/live-streams/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: msgBody.trim() }),
      });
      setMsgBody('');
      setMsgHint('Sent to host');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send message');
    } finally {
      setMsgBusy(false);
    }
  }

  if (!session) {
    return (
      <div className="space-y-4">
        <PageHeader title="Zoom class" description={error || 'Loading…'} />
        {error ? <Alert variant="error">{error}</Alert> : null}
      </div>
    );
  }

  const perm = permissionCopy(session.permission_status, session.can_host);
  const isPrevious = Boolean(session.is_previous) || session.status === 'ended';
  const slides = session.slides ?? [];
  const canViewPresentation = Boolean(session.can_view_presentation);
  const canHost = Boolean(session.can_host);

  if (isPrevious) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title={session.topic}
          description={`${new Date(session.scheduled_at).toLocaleString()} · Previous class`}
        />
        {error ? <Alert variant="error">{error}</Alert> : null}
        {!canViewPresentation ? (
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

      {session.payment_blocked ? (
        <Alert variant="warning" className="border-amber-200 bg-amber-50 text-amber-950">
          <p className="text-base font-bold">Paid class — payment required</p>
          <p className="mt-2 text-sm leading-relaxed">
            {session.payment_required_message ??
              'This Live Class only for Paid User. You are unpaid Mode. Pay to Enjoy Live Class.'}
          </p>
        </Alert>
      ) : null}

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
          <CardTitle className="text-base">Zoom meeting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!join ? (
            <div className="flex flex-wrap gap-2">
              {canHost ? (
                <Button
                  disabled={busy || session.status === 'cancelled'}
                  onClick={() => void joinSession(true)}
                >
                  {busy ? 'Starting…' : 'Join as host'}
                </Button>
              ) : null}
              <Button
                variant={canHost ? 'outline' : 'default'}
                disabled={
                  busy ||
                  !session.can_join ||
                  session.payment_blocked ||
                  session.permission_status === 'not_permitted' ||
                  session.status === 'paused' ||
                  session.status === 'ended' ||
                  session.status === 'scheduled'
                }
                onClick={() => void joinSession(false)}
              >
                {busy
                  ? 'Joining…'
                  : session.permission_status === 'not_permitted'
                    ? 'Join locked'
                    : session.payment_blocked
                      ? 'Payment required'
                      : session.status === 'paused'
                      ? 'Waiting for resume'
                      : session.status === 'ended'
                        ? 'Session ended'
                        : session.status === 'scheduled'
                          ? 'Waiting for live'
                          : 'Join as guest'}
              </Button>
            </div>
          ) : (
            <div className="relative">
              <ZoomMeetingRoom
                config={{
                  sdkKey: join.sdk_key,
                  signature: join.signature,
                  meetingNumber: join.meeting_number,
                  password: join.password,
                  userName: join.user_name,
                  userEmail: join.user_email,
                  zak: join.zak,
                  role: join.role,
                }}
                onError={setError}
                onLeave={() => setJoin(null)}
              />
              {join.role === 'audience' && session.allow_guest_messages ? (
                <div className="absolute inset-x-0 top-0 z-10 space-y-2 rounded-b-xl border-b border-pink-200/80 bg-slate-950/85 p-3 backdrop-blur-sm">
                  <p className="text-xs font-semibold text-pink-100">Message the host</p>
                  <div className="flex gap-2">
                    <Input
                      value={msgBody}
                      onChange={(e) => setMsgBody(e.target.value)}
                      placeholder="Write a short message…"
                      maxLength={500}
                      disabled={msgBusy}
                      className="border-slate-600 bg-slate-900 text-slate-100"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void sendMessage();
                        }
                      }}
                    />
                    <Button disabled={msgBusy || !msgBody.trim()} onClick={() => void sendMessage()}>
                      {msgBusy ? '…' : 'Send'}
                    </Button>
                  </div>
                  {msgHint ? <p className="text-xs text-emerald-300">{msgHint}</p> : null}
                </div>
              ) : null}
            </div>
          )}
          {join && join.role === 'audience' && !session.allow_guest_messages ? (
            <p className="text-xs text-muted-foreground">
              Guest messaging is off. The host can allow messages from the admin page.
            </p>
          ) : null}
          {session.host_name ? (
            <p className="text-xs text-muted-foreground">Host: {session.host_name}</p>
          ) : null}
        </CardContent>
      </Card>

      {canViewPresentation && slides.length > 0 ? (
        <div className="space-y-6">
          <PageHeader
            title="Class content (review)"
            description="Admins can preview slides and context for upcoming sessions."
          />
          <p className="text-center text-xs font-bold uppercase tracking-wide text-pink-800">
            {slides.length} slide{slides.length === 1 ? '' : 's'}
          </p>
          {slides.map((slide, index) => (
            <Card key={`review-slide-${index}`} className="border-pink-100 shadow-sm">
              <CardContent className="space-y-4 px-6 py-8 sm:px-10">
                <p className="text-center text-xs font-bold text-slate-400">
                  {index + 1} / {slides.length}
                </p>
                {slide.title?.trim() ? (
                  <div className="text-center text-xl font-extrabold leading-snug text-slate-900 sm:text-2xl">
                    <MarkupText text={slide.title} />
                  </div>
                ) : null}
                {slide.context?.trim() ? (
                  <div className="text-base leading-7 text-slate-800">
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
      ) : null}
    </div>
  );
}
