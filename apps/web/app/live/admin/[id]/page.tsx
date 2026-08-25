'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Radio } from 'lucide-react';
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
  host_user_id?: string;
  host_name?: string;
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
  amount_received?: number;
}

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function openLiveRoom(sessionId: string) {
  window.open(`/live-room/${sessionId}`, '_blank', 'noopener,noreferrer');
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
  const [busy, setBusy] = useState(false);
  const [editTopic, setEditTopic] = useState('');
  const [editDetails, setEditDetails] = useState('');
  const [editWhen, setEditWhen] = useState('');
  const [slides, setSlides] = useState<SlideDraft[]>([]);
  const [showMarkupHelp, setShowMarkupHelp] = useState(false);
  const [paySort, setPaySort] = useState<'paid' | 'unpaid'>('paid');
  const limit = 100;

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

  const loadUsers = useCallback(async (q: string, p: number, sort: 'paid' | 'unpaid') => {
    try {
      const params = new URLSearchParams({
        status: 'active',
        limit: String(limit),
        page: String(p),
        sort,
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
    void loadUsers(query, page, paySort);
  }, [loadUsers, query, page, paySort]);

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

  async function assignHost(userId: string) {
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/live-streams/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ host_user_id: userId }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not assign host');
    } finally {
      setBusy(false);
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

      <Card className="border-pink-200 bg-pink-50/60">
        <CardHeader>
          <CardTitle className="text-base">Live control room</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <p className="max-w-xl text-sm text-pink-950/90">
            Mic, screen share, allow/disallow messages, guest list with totals, inbox, pause /
            restart / end open in a separate tab for a cleaner host workspace.
          </p>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button type="button" onClick={() => openLiveRoom(String(id))}>
              <Radio className="h-4 w-4" />
              Open control room
            </Button>
            <Button asChild variant="outline">
              <Link href={`/live-room/${id}`} target="_blank" rel="noreferrer">
                Open in new tab
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Session host</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Assign a user as host. After login they see this class under{' '}
            <Link href="/live/hosting" className="font-medium text-pink-700 underline-offset-2 hover:underline">
              Host live classes
            </Link>{' '}
            and open the control room directly.
          </p>
          <div className="rounded-xl border bg-slate-50 px-3 py-2.5 text-sm">
            <span className="text-slate-500">Current host: </span>
            <span className="font-semibold text-slate-900">
              {session.host_name || 'Not set'}
            </span>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="host-search">Search user to assign as host</Label>
            <Input
              id="host-search"
              value={query}
              onChange={(e) => {
                setPage(1);
                setQuery(e.target.value);
              }}
              placeholder="Name, email, or phone"
            />
          </div>
          <div className="max-h-56 overflow-y-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Contact</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const isHost = session.host_user_id === u.id;
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80">
                        <td className="px-3 py-2 font-medium">
                          {u.full_name_bn?.trim() || u.full_name_en}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {u.email}
                          {u.phone ? ` · ${u.phone}` : ''}
                        </td>
                        <td className="px-3 py-2">
                          {isHost ? (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                              Host
                            </span>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => void assignHost(u.id)}
                            >
                              Make host
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">User access (batch)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[14rem] flex-1 space-y-1.5">
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
            <div className="space-y-1.5">
              <Label htmlFor="pay-sort">Sort</Label>
              <select
                id="pay-sort"
                value={paySort}
                onChange={(e) => {
                  setPage(1);
                  setPaySort(e.target.value === 'unpaid' ? 'unpaid' : 'paid');
                }}
                className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="paid">Paid first</option>
                <option value="unpaid">Unpaid first</option>
              </select>
            </div>
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
              {invites.length} currently allowed · {usersTotal} users total · {limit} per page
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
                  <th className="px-3 py-2">Payment</th>
                  <th className="px-3 py-2">Access</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const allowed = invitedSet.has(u.id);
                    const paid = Number(u.amount_received ?? 0) > 0;
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
                          {paid ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                              Paid
                              {typeof u.amount_received === 'number'
                                ? ` · ${u.amount_received.toLocaleString()}`
                                : ''}
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                              Unpaid
                            </span>
                          )}
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
              {usersTotal > 0
                ? ` · showing ${Math.min((page - 1) * limit + 1, usersTotal)}–${Math.min(page * limit, usersTotal)} of ${usersTotal}`
                : ''}
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
