'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Calendar, ChevronRight, Clock, Radio, UserCheck, Video } from 'lucide-react';
import {
  type LiveClassPackageBrief,
  type LivePermissionStatus,
  type LiveStreamPresentation,
  type LiveStreamRecordedContent,
  type LiveStreamSlide,
  type LiveStreamStatus,
  type ZoomLiveStreamJoinPayload,
} from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { liveDeviceId } from '@/lib/live-device';
import { toBanglaDigits } from '@/lib/bangla-format';
import { MarkupText } from '@/components/shared/markup-text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { LiveClassPresentations } from '@/components/live/live-class-presentations';
import { LiveClassRecordedVideos } from '@/components/live/live-class-recorded-videos';
import { LivePackageCta } from '@/components/live/live-package-cta';

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
  exam_subject_name?: string;
  permission_status: LivePermissionStatus;
  can_join: boolean;
  can_host?: boolean;
  is_previous?: boolean;
  slides?: LiveStreamSlide[];
  presentations?: LiveStreamPresentation[];
  recorded_contents?: LiveStreamRecordedContent[];
  slide_count?: number;
  presentation_count?: number;
  allow_guest_messages?: boolean;
  can_view_presentation?: boolean;
  access_type?: 'free' | 'paid';
  payment_blocked?: boolean;
  payment_required_message?: string;
  packages?: LiveClassPackageBrief[];
  video_platform?: 'agora' | 'zoom';
}

type JoinPayload = ZoomLiveStreamJoinPayload;

function bn(n: number | string): string {
  return toBanglaDigits(String(n));
}

function formatCountdown(scheduledIso: string, nowMs: number): string | null {
  const target = new Date(scheduledIso).getTime();
  if (Number.isNaN(target)) return null;
  const diffSec = Math.max(0, Math.floor((target - nowMs) / 1000));
  if (diffSec <= 0) return '০০ : ০০ : ০০';
  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  const pad = (v: number) => bn(String(v).padStart(2, '0'));
  return `${pad(hrs)} : ${pad(mins)} : ${pad(secs)}`;
}

function formatBanglaSchedule(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return toBanglaDigits(
    d.toLocaleString('bn-BD', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),
  );
}

function permissionCopy(status: LivePermissionStatus, canHost?: boolean, accessType?: 'free' | 'paid') {
  if (status === 'host' || canHost) {
    return {
      title: 'আপনি এই ক্লাসটি হোস্ট করতে পারবেন',
      body: 'ফোন বা ল্যাপটপ থেকে হোস্ট হিসেবে যোগ দিন। সংযুক্ত হয়ে মাইক চালু করলে সবাই আপনার কথা শুনতে পাবে।',
      tone: 'border-amber-200 bg-amber-50 text-amber-900',
    };
  }
  if (accessType !== 'paid' && status === 'permitted') {
    return {
      title: 'ফ্রি ক্লাস — সবার জন্য উন্মুক্ত',
      body: 'ক্লাসটি লাইভ শুরু হলে কোনো এনরোলমেন্ট ছাড়াই সরাসরি যোগ দিতে পারবেন।',
      tone: 'border-[#9fe0e8] bg-[#e6f6f8] text-[#0a2f5b]',
    };
  }
  if (status === 'permitted') {
    return {
      title: 'আপনার যোগদানের অনুমতি রয়েছে',
      body: 'ক্লাসটি লাইভ শুরু হলে টু-ওয়ে অডিও ও ভিডিওসহ অংশ নিতে পারবেন।',
      tone: 'border-[#bde5d4] bg-[#e8f8ef] text-[#14593d]',
    };
  }
  return {
    title: 'এই ক্লাসে প্রবেশাধিকার সীমিত',
    body: 'শুধুমাত্র অনুমোদিত বা সংশ্লিষ্ট প্যাকেজে এনরোল করা শিক্ষার্থীরা ভিডিও রুমে প্রবেশ করতে পারবেন।',
    tone: 'border-rose-200 bg-rose-50 text-rose-900',
  };
}

export default function ZoomStreamWatchPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [join, setJoin] = useState<JoinPayload | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [msgBody, setMsgBody] = useState('');
  const [msgBusy, setMsgBusy] = useState(false);
  const [msgHint, setMsgHint] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: SessionDetail }>(`/live-streams/${id}`);
      setSession(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ক্লাসের তথ্য লোড করা যায়নি');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

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
              ? 'ক্লাসে বিরতি চলছে — হোস্ট পুনরায় শুরু করলে আবার যোগ দিতে পারবেন।'
              : 'ক্লাস সমাপ্ত হয়েছে।',
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
        body: JSON.stringify({ as_host: asHost, device_id: liveDeviceId() }),
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
      setError(err instanceof Error ? err.message : 'ক্লাসে যোগ দেওয়া যায়নি');
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
      setMsgHint('হোস্টের কাছে পাঠানো হয়েছে');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'বার্তা পাঠানো যায়নি');
    } finally {
      setMsgBusy(false);
    }
  }

  if (!session) {
    return (
      <div className="space-y-4">
        {error ? <Alert variant="error">{error}</Alert> : <Skeleton className="h-72 w-full rounded-2xl" />}
      </div>
    );
  }

  const perm = permissionCopy(session.permission_status, session.can_host, session.access_type);
  const isPrevious = Boolean(session.is_previous) || session.status === 'ended';
  const slides = session.slides ?? [];
  const presentations = session.presentations ?? [];
  const recordedContents = session.recorded_contents ?? [];
  const canViewPresentation = Boolean(session.can_view_presentation);
  const canHost = Boolean(session.can_host);
  const hostLabel = session.host_name?.trim() || 'নির্ধারিত প্রশিক্ষক';
  const countdown = formatCountdown(session.scheduled_at, nowMs);

  /* Active Zoom Room View */
  if (join) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#d7e4ee] bg-white px-4 py-3">
          <div>
            <p className="text-xs font-semibold text-[#1566b8]">সরাসরি ক্লাস রুম</p>
            <h1 className="text-base font-bold text-[#0a2f5b]">{session.topic}</h1>
          </div>
          <span className="text-xs text-slate-500">হোস্ট: {join.host_name?.trim() || hostLabel}</span>
        </div>

        {error ? <Alert variant="error">{error}</Alert> : null}

        <div className="relative overflow-hidden rounded-2xl border border-[#d7e4ee] bg-slate-950">
          <ZoomMeetingRoom
            config={{
              webClientUrl: join.web_client_url,
              meetingNumber: join.meeting_number,
              password: join.password,
              userName: join.user_name,
              userEmail: join.user_email,
              zak: join.zak,
              sdkKey: join.sdk_key,
              signature: join.signature,
              role: join.role,
            }}
            onError={setError}
            onLeave={() => setJoin(null)}
          />
          {join.role === 'audience' && session.allow_guest_messages ? (
            <div className="absolute inset-x-0 top-0 z-10 space-y-2 rounded-b-xl border-b border-[#1566b8]/50 bg-[#0a2f5b]/90 p-3 backdrop-blur-sm">
              <p className="text-xs font-semibold text-[#9ed8eb]">হোস্টকে প্রশ্ন বা বার্তা পাঠান</p>
              <div className="flex gap-2">
                <Input
                  value={msgBody}
                  onChange={(e) => setMsgBody(e.target.value)}
                  placeholder="সংক্ষিপ্ত প্রশ্ন লিখুন…"
                  maxLength={500}
                  disabled={msgBusy}
                  className="border-white/20 bg-slate-900/90 text-slate-100"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                />
                <Button
                  className="bg-[#1566b8] text-white hover:bg-[#0f5294]"
                  disabled={msgBusy || !msgBody.trim()}
                  onClick={() => void sendMessage()}
                >
                  {msgBusy ? '…' : 'পাঠান'}
                </Button>
              </div>
              {msgHint ? <p className="text-xs text-emerald-300">{msgHint}</p> : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  /* PDF Page 14 Layout: Breadcrumb + 2-Column (Navy Hero Box + Right Details Sidebar) */
  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500">
        <Link href="/learning" className="hover:text-[#1566b8]">হোম</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/live" className="hover:text-[#1566b8]">লাইভ ক্লাস</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-semibold text-[#0a2f5b]">{session.topic}</span>
      </nav>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left Main Area */}
        <div className="space-y-5">
          {/* Deep Navy Countdown / Live Hero Card (PDF p14) */}
          <div className="rounded-2xl bg-[#0a2f5b] p-6 text-center text-white shadow-sm sm:p-8">
            <div className="mx-auto flex max-w-md flex-col items-center">
              {isPrevious ? (
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white/90">
                  সম্পন্ন ক্লাস · রেকর্ডিং ও স্লাইড
                </span>
              ) : session.status === 'live' ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3.5 py-1 text-xs font-bold text-emerald-300">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                  এখন সরাসরি ক্লাস চলছে
                </span>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#9ed8eb]">ক্লাস শুরু হবে</p>
                  {countdown ? (
                    <p className="mt-2 font-mono text-3xl font-extrabold tracking-widest text-white sm:text-4xl">
                      {countdown}
                    </p>
                  ) : null}
                </>
              )}

              <h1 className="mt-4 text-xl font-bold leading-snug sm:text-2xl">{session.topic}</h1>
              <p className="mt-1.5 text-xs text-white/75">{formatBanglaSchedule(session.scheduled_at)}</p>

              {!isPrevious ? (
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  {canHost ? (
                    <Button
                      disabled={busy || session.status === 'cancelled'}
                      onClick={() => void joinSession(true)}
                      className="h-11 rounded-xl bg-[#2aabb8] px-5 text-sm font-semibold text-white hover:bg-[#22929e]"
                    >
                      <Radio className="h-4 w-4" />
                      {busy ? 'শুরু হচ্ছে…' : 'হোস্ট হিসেবে শুরু করুন'}
                    </Button>
                  ) : null}

                  <Button
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
                    className="h-11 rounded-xl bg-[#1566b8] px-6 text-sm font-semibold text-white hover:bg-[#1c77d4] disabled:bg-white/15 disabled:text-white/70"
                  >
                    <Video className="h-4 w-4" />
                    {busy
                      ? 'যুক্ত হচ্ছে…'
                      : session.payment_blocked
                        ? 'প্যাকেজ প্রয়োজন'
                        : session.permission_status === 'not_permitted'
                          ? 'অনুমতি প্রয়োজন'
                          : session.status === 'paused'
                            ? 'বিরতি চলছে'
                            : session.status === 'scheduled'
                              ? 'শুরু হলে যোগ দিন'
                              : 'ক্লাসে যোগ দিন'}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          {session.status === 'paused' ? (
            <Alert variant="warning">ক্লাসটি সাময়িক বিরতিতে আছে। হোস্ট পুনরায় শুরু করলে যোগ দিতে পারবেন।</Alert>
          ) : null}

          {/* Payment / Package CTA */}
          {session.payment_blocked && session.packages?.length ? (
            <LivePackageCta packages={session.packages} message={session.payment_required_message} />
          ) : session.payment_blocked ? (
            <Alert variant="warning" className="border-amber-200 bg-amber-50 text-amber-950">
              <p className="text-base font-bold">পেইড লাইভ ক্লাস — এনরোলমেন্ট প্রয়োজন</p>
              <p className="mt-1 text-sm leading-relaxed">
                {session.payment_required_message ?? 'এই ক্লাসে অংশ নিতে সংশ্লিষ্ট লাইভ ক্লাস প্যাকেজে এনরোল করুন।'}
              </p>
            </Alert>
          ) : null}

          {!isPrevious ? (
            <div className={`rounded-2xl border p-4 ${perm.tone}`}>
              <p className="text-sm font-bold">{perm.title}</p>
              <p className="mt-1 text-xs leading-relaxed opacity-90">{perm.body}</p>
            </div>
          ) : null}

          {session.details ? (
            <section className="rounded-2xl border border-[#d7e4ee] bg-white p-5 shadow-xs">
              <h2 className="text-base font-bold text-[#0a2f5b]">ক্লাসের আলোচ্য বিষয়</h2>
              <div className="mt-2 text-sm leading-relaxed text-slate-700">
                <MarkupText text={session.details} />
              </div>
            </section>
          ) : null}

          {/* Recordings & Slides */}
          {isPrevious && !canViewPresentation ? (
            session.payment_blocked && session.packages?.length ? null : (
              <div className="rounded-2xl border border-[#d7e4ee] bg-white p-5">
                <p className="font-bold text-[#0a2f5b]">রেকর্ডিং ও স্লাইড সংরক্ষিত</p>
                <p className="mt-1 text-sm text-slate-600">
                  পূর্ববর্তী ক্লাসের রেকর্ডিং ও স্লাইড সংশ্লিষ্ট প্যাকেজে এনরোল করা শিক্ষার্থীদের জন্য উন্মুক্ত।
                </p>
              </div>
            )
          ) : canViewPresentation && (recordedContents.length > 0 || presentations.length > 0 || slides.length > 0) ? (
            <div className="space-y-6">
              {recordedContents.length > 0 ? <LiveClassRecordedVideos items={recordedContents} /> : null}
              <LiveClassPresentations presentations={presentations} slides={slides} />
            </div>
          ) : null}
        </div>

        {/* Right Sidebar: বিবরণ (PDF p14) */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-[#d7e4ee] bg-white p-5 shadow-xs">
            <h2 className="text-base font-bold text-[#0a2f5b]">বিবরণ</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#1566b8]" />
                <div>
                  <dt className="text-xs text-slate-500">প্রশিক্ষক / হোস্ট</dt>
                  <dd className="font-semibold text-[#0a2f5b]">{hostLabel}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-[#1566b8]" />
                <div>
                  <dt className="text-xs text-slate-500">সময়সূচি</dt>
                  <dd className="font-medium text-[#0a2f5b]">{formatBanglaSchedule(session.scheduled_at)}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#1566b8]" />
                <div>
                  <dt className="text-xs text-slate-500">অ্যাক্সেস ধরন</dt>
                  <dd className="font-semibold text-[#0a2f5b]">
                    {session.access_type !== 'paid' ? 'ফ্রি ক্লাস (সবার জন্য উন্মুক্ত)' : 'পেইড প্যাকেজ ক্লাস'}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Video className="mt-0.5 h-4 w-4 shrink-0 text-[#1566b8]" />
                <div>
                  <dt className="text-xs text-slate-500">মাধ্যম</dt>
                  <dd className="font-medium text-[#0a2f5b]">Zoom লাইভ অডিও ও ভিডিও</dd>
                </div>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-[#d7e4ee] bg-white p-5 shadow-xs">
            <h3 className="text-sm font-bold text-[#0a2f5b]">অন্যান্য ক্লাস ও রেকর্ডিং</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              সকল বিষয়ের আসন্ন ফ্রি ও পেইড ক্লাস এবং পূর্ববর্তী রেকর্ডিং এক তালিকা থেকে দেখুন।
            </p>
            <Link
              href="/live"
              className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-[#d7e4ee] bg-[#f4f9fd] py-2 text-xs font-semibold text-[#1566b8] hover:bg-[#e5f0fb]"
            >
              সব লাইভ ক্লাস দেখুন →
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
