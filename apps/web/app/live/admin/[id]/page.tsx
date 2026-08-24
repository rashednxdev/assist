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
import { MarkupText } from '@/components/shared/markup-text';
import {
  MarkupInstructionsButton,
  MarkupInstructionsModal,
} from '@/components/shared/markup-instructions-modal';
import { ComparisonTableEditor } from '@/components/questions/comparison-table-editor';
import {
  ProcessStepsEditor,
  emptyExplanationProcess,
} from '@/components/questions/process-steps-editor';
import { ProcessFlowPreview } from '@/components/books/process-flow-preview';
import { ComparisonTableView } from '@/components/questions/comparison-table-view';
import {
  emptyComparisonTable,
  hasComparisonTableContent,
  hasProcessContent,
  type ComparisonTable,
  type ExplanationProcess,
  type LiveStreamSlide,
} from '@ibas/shared-types';

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
  slides?: LiveStreamSlide[];
  slide_count?: number;
  is_previous?: boolean;
  allow_guest_messages?: boolean;
}

interface GuestMessageRow {
  id: string;
  from_user_id: string;
  from_name: string;
  body: string;
  created_at: string;
}

interface SlideDraft {
  key: string;
  title: string;
  context: string;
  table?: ComparisonTable;
  process?: ExplanationProcess;
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

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  const [editTopic, setEditTopic] = useState('');
  const [editDetails, setEditDetails] = useState('');
  const [editWhen, setEditWhen] = useState('');
  const [slides, setSlides] = useState<SlideDraft[]>([]);
  const [showMarkupHelp, setShowMarkupHelp] = useState(false);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [messages, setMessages] = useState<GuestMessageRow[]>([]);
  const [msgBusy, setMsgBusy] = useState(false);
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
      setEditTopic(s.data.topic);
      setEditDetails(s.data.details ?? '');
      setEditWhen(toDatetimeLocal(s.data.scheduled_at));
      setSlides(
        (s.data.slides ?? []).map((slide, i) => ({
          key: `slide-${i}-${Date.now()}`,
          title: slide.title ?? '',
          context: slide.context ?? '',
          table: slide.table,
          process: slide.process,
        })),
      );
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

  useEffect(() => {
    if (!id) return;
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
  }, [id]);

  useEffect(() => {
    if (!id) return;
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
  }, [id]);

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

  async function saveEdits() {
    if (!editTopic.trim() || !editWhen) {
      setError('Topic and date & time are required');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/live-streams/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          topic: editTopic.trim(),
          details: editDetails.trim() || null,
          scheduled_at: new Date(editWhen).toISOString(),
          slides: slides.map((s) => ({
            title: s.title.trim(),
            context: s.context.trim(),
            ...(s.table ? { table: s.table } : {}),
            ...(s.process ? { process: s.process } : {}),
          })),
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes');
    } finally {
      setBusy(false);
    }
  }

  function addSlide() {
    setSlides((prev) => [
      ...prev,
      { key: `slide-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: '', context: '' },
    ]);
  }

  function updateSlide(key: string, patch: Partial<Omit<SlideDraft, 'key'>>) {
    setSlides((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function removeSlide(key: string) {
    setSlides((prev) => prev.filter((s) => s.key !== key));
  }

  function moveSlide(key: string, dir: -1 | 1) {
    setSlides((prev) => {
      const idx = prev.findIndex((s) => s.key === key);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      const row = copy[idx];
      if (!row) return prev;
      copy.splice(idx, 1);
      copy.splice(next, 0, row);
      return copy;
    });
  }

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
      const res = await apiFetch<{ data: JoinPayload }>(`/live-streams/${id}/join`, {
        method: 'POST',
        body: JSON.stringify({ as_host: true }),
      });
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
      <MarkupInstructionsModal open={showMarkupHelp} onClose={() => setShowMarkupHelp(false)} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Edit class</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="edit-topic">Topic</Label>
            <Input id="edit-topic" value={editTopic} onChange={(e) => setEditTopic(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-when">Date &amp; time</Label>
            <Input
              id="edit-when"
              type="datetime-local"
              value={editWhen}
              onChange={(e) => setEditWhen(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="edit-details">Details</Label>
              <MarkupInstructionsButton onClick={() => setShowMarkupHelp(true)} />
            </div>
            <textarea
              id="edit-details"
              value={editDetails}
              onChange={(e) => setEditDetails(e.target.value)}
              rows={5}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Use markup markers — see Markup guide"
            />
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button disabled={busy} onClick={() => void saveEdits()}>
              Save changes
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void removeSession()}>
              Delete class
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Class presentation slides</CardTitle>
          <div className="flex items-center gap-2">
            <MarkupInstructionsButton onClick={() => setShowMarkupHelp(true)} />
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={addSlide}>
              Add slide
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted">
            Publish title + context for each slide, plus optional comparison tables and step
            processes (same as Books / Questions). Invited users see these as stacked pages on
            previous classes.
          </p>
          {slides.length === 0 ? (
            <p className="text-sm text-muted">No slides yet. Add a slide to publish class content.</p>
          ) : null}
          {slides.map((slide, index) => (
            <div
              key={slide.key}
              className="space-y-3 rounded-xl border border-border bg-background p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-muted">
                  Slide {index + 1}
                </span>
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy || index === 0}
                    onClick={() => moveSlide(slide.key, -1)}
                  >
                    Up
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy || index === slides.length - 1}
                    onClick={() => moveSlide(slide.key, 1)}
                  >
                    Down
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => removeSlide(slide.key)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`slide-title-${slide.key}`}>Title</Label>
                <Input
                  id={`slide-title-${slide.key}`}
                  value={slide.title}
                  onChange={(e) => updateSlide(slide.key, { title: e.target.value })}
                  placeholder="Slide title (markup allowed)"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`slide-context-${slide.key}`}>Context</Label>
                <textarea
                  id={`slide-context-${slide.key}`}
                  value={slide.context}
                  onChange={(e) => updateSlide(slide.key, { context: e.target.value })}
                  rows={6}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Slide context — use // /// //// /--- *bold* []"
                />
              </div>

              <div className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-xs">Comparison table (optional)</Label>
                  {hasComparisonTableContent(slide.table) ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => updateSlide(slide.key, { table: undefined })}
                    >
                      Remove table
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => updateSlide(slide.key, { table: emptyComparisonTable(2) })}
                    >
                      Add table
                    </Button>
                  )}
                </div>
                {slide.table ? (
                  <ComparisonTableEditor
                    value={slide.table}
                    onChange={(table) => updateSlide(slide.key, { table })}
                    disabled={busy}
                  />
                ) : (
                  <p className="text-xs text-muted">
                    Add a Differences-style table under this slide (same as Questions / Books).
                  </p>
                )}
              </div>

              <div className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-xs">Process steps (optional)</Label>
                  {hasProcessContent(slide.process) || slide.process ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => updateSlide(slide.key, { process: undefined })}
                    >
                      Remove process
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => updateSlide(slide.key, { process: emptyExplanationProcess() })}
                    >
                      Add process
                    </Button>
                  )}
                </div>
                {slide.process ? (
                  <ProcessStepsEditor
                    value={slide.process}
                    onChange={(process) => updateSlide(slide.key, { process })}
                    disabled={busy}
                  />
                ) : (
                  <p className="text-xs text-muted">
                    Add a step-by-step process under this slide (same as Books / model answers).
                  </p>
                )}
              </div>

              {(slide.title.trim() ||
                slide.context.trim() ||
                hasComparisonTableContent(slide.table) ||
                hasProcessContent(slide.process)) && (
                <div className="space-y-3 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-sm">
                  <p className="text-xs font-bold uppercase text-muted">Preview</p>
                  {slide.title.trim() ? (
                    <div className="text-lg font-bold text-foreground">
                      <MarkupText text={slide.title} />
                    </div>
                  ) : null}
                  {slide.context.trim() ? <MarkupText text={slide.context} /> : null}
                  {hasComparisonTableContent(slide.table) ? (
                    <ComparisonTableView table={slide.table} label="" />
                  ) : null}
                  {hasProcessContent(slide.process) ? (
                    <div className="space-y-2">
                      {slide.process?.title?.trim() ? (
                        <p className="font-semibold text-foreground">{slide.process.title}</p>
                      ) : null}
                      {slide.process?.details?.trim() ? (
                        <MarkupText text={slide.process.details} />
                      ) : null}
                      <ProcessFlowPreview steps={slide.process?.steps ?? []} />
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
          <Button disabled={busy} onClick={() => void saveEdits()}>
            Save slides &amp; class
          </Button>
        </CardContent>
      </Card>

      {session.details ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details preview</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-700">
            <MarkupText text={session.details} />
          </CardContent>
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
          <p className="text-xs text-muted-foreground">
            Pause keeps invites but guests cannot watch until you resume. Always <strong>End session</strong> when
            finished so Agora channel minutes stop. Mic carries speech to viewers; screen share is desktop-only.
          </p>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-pink-200 bg-pink-50 px-3 py-2.5">
            <div>
              <div className="text-sm font-semibold text-pink-950">Guest messages (during live)</div>
              <p className="text-xs text-pink-800/80">
                {session.allow_guest_messages
                  ? 'Allowed — guests can write to you from the app'
                  : 'Disallowed — turn on when you want questions from guests'}
              </p>
            </div>
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                variant={session.allow_guest_messages ? 'default' : 'outline'}
                disabled={msgBusy || Boolean(session.allow_guest_messages)}
                onClick={() => void toggleGuestMessages(true)}
              >
                Allow
              </Button>
              <Button
                size="sm"
                variant={!session.allow_guest_messages ? 'default' : 'outline'}
                disabled={msgBusy || !session.allow_guest_messages}
                onClick={() => void toggleGuestMessages(false)}
              >
                Disallow
              </Button>
            </div>
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
          <CardTitle className="text-base">
            Guest messages
            <span className="ml-2 text-xs font-medium text-muted-foreground">
              {messages.length} · host only
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No guest messages yet. Turn on “Allow” above so invited viewers can write to you.
            </p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto rounded-xl border bg-white p-3">
              {messages.map((m) => (
                <li key={m.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-slate-900">{m.from_name}</span>
                    <span className="shrink-0 text-[11px] text-slate-500">
                      {new Date(m.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-slate-700">{m.body}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Guest list
            <span className="ml-2 text-xs font-medium text-muted-foreground">
              {guests.filter((g) => g.role === 'audience').length} guests
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {guests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No one has joined yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Email / phone</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {guests.map((g) => (
                    <tr key={g.id}>
                      <td className="px-3 py-2 font-medium">{g.name}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {g.email}
                        {g.phone ? ` · ${g.phone}` : ''}
                      </td>
                      <td className="px-3 py-2">
                        {g.role === 'host' ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            Host
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                            Guest
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {new Date(g.joined_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
