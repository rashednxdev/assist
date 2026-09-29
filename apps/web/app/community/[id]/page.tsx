'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ChevronLeft,
  Eye,
  EyeOff,
  Flag,
  Link2,
  Loader2,
  Lock,
  MessageSquare,
  Pencil,
  Pin,
  ShieldAlert,
  Trash2,
  Unlock,
} from 'lucide-react';
import type {
  CommunityAnswerRecord,
  CommunityCategoryRecord,
  CommunityLinkRecord,
  CommunityThreadDetail,
} from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { fetchMe } from '@/lib/auth';
import { timeAgo } from '@/lib/community';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { PostBody } from '@/components/community/post-body';
import { LinkChips } from '@/components/community/link-chips';
import { PostEditor } from '@/components/community/post-editor';
import { AnswerCard } from '@/components/community/answer-card';
import { Avatar, AuthorName, ReportDialog, VoteButton } from '@/components/community/community-bits';

export default function CommunityThreadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [thread, setThread] = useState<CommunityThreadDetail | null>(null);
  const [meId, setMeId] = useState('');
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState('');
  const [report, setReport] = useState<{ type: 'thread' | 'answer'; id: string } | null>(null);
  const [categories, setCategories] = useState<CommunityCategoryRecord[]>([]);
  const [copied, setCopied] = useState(false);
  const [hash, setHash] = useState('');

  const [answerBody, setAnswerBody] = useState('');
  const [answerLinks, setAnswerLinks] = useState<CommunityLinkRecord[]>([]);
  const [posting, setPosting] = useState(false);
  const [answerError, setAnswerError] = useState('');

  const load = useCallback(
    (countView: boolean) =>
      apiFetch<{ data: CommunityThreadDetail }>(`/community/threads/${id}${countView ? '' : '?view=false'}`)
        .then((r) => setThread(r.data))
        .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the discussion')),
    [id],
  );

  useEffect(() => {
    void load(true);
    fetchMe()
      .then((r) => setMeId(r.data.id))
      .catch(() => undefined);
  }, [load]);

  useEffect(() => {
    if (thread?.can_moderate && categories.length === 0) {
      apiFetch<{ data: CommunityCategoryRecord[] }>('/community/categories')
        .then((r) => setCategories(r.data))
        .catch(() => undefined);
    }
  }, [thread?.can_moderate, categories.length]);

  useEffect(() => {
    if (!thread) return;
    const h = window.location.hash.slice(1);
    if (!h) return;
    setHash(h);
    requestAnimationFrame(() => document.getElementById(h)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }, [thread?.id]);

  async function act(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setActionError('');
    try {
      await fn();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy('');
    }
  }

  const toggleFollow = () =>
    act('follow', async () => {
      const r = await apiFetch<{ data: { following: boolean; follower_count: number } }>(`/community/threads/${id}/follow`, { method: 'POST' });
      setThread((t) => (t ? { ...t, following: r.data.following, follower_count: r.data.follower_count } : t));
    });

  const deleteThread = () => {
    if (!window.confirm('Delete this discussion and all its answers?')) return;
    void act('delete', async () => {
      await apiFetch(`/community/threads/${id}`, { method: 'DELETE' });
      router.push('/community');
    });
  };

  const moderate = (key: string, patch: Record<string, unknown>) =>
    act(key, async () => {
      const r = await apiFetch<{ data: CommunityThreadDetail }>(`/community/admin/threads/${id}/moderate`, { method: 'POST', body: JSON.stringify(patch) });
      setThread(r.data);
    });

  async function accept(answerId: string, on: boolean) {
    await apiFetch(`/community/threads/${id}/accept`, { method: 'POST', body: JSON.stringify({ answer_id: on ? answerId : null }) });
    await load(false);
  }

  async function postAnswer() {
    setAnswerError('');
    if (answerBody.trim().length < 2) return setAnswerError('Write your answer first.');
    setPosting(true);
    try {
      const r = await apiFetch<{ data: CommunityAnswerRecord }>(`/community/threads/${id}/answers`, {
        method: 'POST',
        body: JSON.stringify({ body: answerBody.trim(), links: answerLinks.map((l) => ({ type: l.type, id: l.id })) }),
      });
      setAnswerBody('');
      setAnswerLinks([]);
      await load(false);
      setHash(`answer-${r.data.id}`);
      requestAnimationFrame(() => document.getElementById(`answer-${r.data.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    } catch (e) {
      setAnswerError(e instanceof Error ? e.message : 'Could not post your answer');
    } finally {
      setPosting(false);
    }
  }

  function copyLink() {
    void navigator.clipboard?.writeText(window.location.href.split('#')[0]!).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href="/community" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
          <ChevronLeft className="h-4 w-4" /> Community
        </Link>
        <Alert variant="error">{error}</Alert>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  const own = thread.author.id === meId;
  const canAnswer = !thread.is_locked || thread.can_moderate;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/community" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark">
        <ChevronLeft className="h-4 w-4" /> Community
      </Link>

      {thread.is_hidden && (
        <Alert variant="warning" title="This discussion is hidden">
          A moderator hid it from the community. Only the author and admins can see it.
        </Alert>
      )}
      {thread.is_locked && (
        <Alert variant="info" title="Locked">
          This discussion is closed for new answers.
        </Alert>
      )}
      {actionError && <Alert variant="error">{actionError}</Alert>}

      <article className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <div className="flex gap-4">
          <div className="hidden sm:block">
            <VoteButton
              path={`/community/threads/${id}/vote`}
              score={thread.vote_score}
              voted={thread.voted}
              disabled={own}
              onChange={(v) => setThread((t) => (t ? { ...t, voted: v.voted, vote_score: v.vote_score } : t))}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {thread.is_pinned && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 font-semibold text-white">
                  <Pin className="h-3 w-3" /> Pinned
                </span>
              )}
              {thread.category && (
                <Link
                  href={`/community?category=${thread.category.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 font-medium hover:bg-slate-50"
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: thread.category.color }} />
                  {thread.category.name}
                </Link>
              )}
              {thread.is_solved && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-light px-2 py-0.5 font-semibold text-success">
                  <CheckCircle2 className="h-3 w-3" /> Solved
                </span>
              )}
            </div>

            <h1 className="text-xl font-bold leading-snug tracking-tight sm:text-2xl">{thread.title}</h1>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span className="inline-flex items-center gap-2">
                <Avatar author={thread.author} size="sm" />
                <AuthorName author={thread.author} />
              </span>
              <span>asked {timeAgo(thread.created_at)}</span>
              {thread.edited_at && <span>· edited {timeAgo(thread.edited_at)}</span>}
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" /> {thread.view_count}
              </span>
              <span className="inline-flex items-center gap-1">
                <Bookmark className="h-3.5 w-3.5" /> {thread.follower_count}
              </span>
            </div>

            <PostBody text={thread.body} className="text-[15px]" />
            <LinkChips links={thread.links} />

            {thread.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {thread.tags.map((t) => (
                  <Link key={t} href={`/community?tag=${encodeURIComponent(t)}`} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-primary-light hover:text-primary-dark">
                    #{t}
                  </Link>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
              <div className="sm:hidden">
                <VoteButton
                  layout="row"
                  path={`/community/threads/${id}/vote`}
                  score={thread.vote_score}
                  voted={thread.voted}
                  disabled={own}
                  onChange={(v) => setThread((t) => (t ? { ...t, voted: v.voted, vote_score: v.vote_score } : t))}
                />
              </div>
              <Button size="sm" variant="outline" className={cn(thread.following && 'border-primary/40 bg-primary-muted text-primary-dark')} onClick={toggleFollow} disabled={busy === 'follow'}>
                {thread.following ? <BookmarkCheck className="h-3.5 w-3.5 text-primary" /> : <Bookmark className="h-3.5 w-3.5" />}
                {thread.following ? 'Following' : 'Follow'}
              </Button>
              <Button size="sm" variant="ghost" onClick={copyLink}>
                <Link2 className="h-3.5 w-3.5" /> {copied ? 'Copied!' : 'Share'}
              </Button>
              <span className="flex-1" />
              {thread.can_edit && (
                <>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/community/${id}/edit`}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Link>
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={deleteThread} disabled={busy === 'delete'}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </>
              )}
              {!own && (
                <Button size="sm" variant="ghost" className="text-muted" onClick={() => setReport({ type: 'thread', id: thread.id })}>
                  <Flag className="h-3.5 w-3.5" /> Report
                </Button>
              )}
            </div>
          </div>
        </div>
      </article>

      {thread.can_moderate && (
        <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm">
          <span className="inline-flex items-center gap-1.5 font-semibold text-amber-900">
            <ShieldAlert className="h-4 w-4" /> Moderate
          </span>
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => moderate('pin', { is_pinned: !thread.is_pinned })}>
            <Pin className="h-3.5 w-3.5" /> {thread.is_pinned ? 'Unpin' : 'Pin'}
          </Button>
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => moderate('lock', { is_locked: !thread.is_locked })}>
            {thread.is_locked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {thread.is_locked ? 'Unlock' : 'Lock'}
          </Button>
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => moderate('hide', { is_hidden: !thread.is_hidden })}>
            <EyeOff className="h-3.5 w-3.5" /> {thread.is_hidden ? 'Unhide' : 'Hide'}
          </Button>
          {categories.length > 0 && (
            <select
              aria-label="Move to category"
              className="ibas-select h-8 w-auto min-w-[10rem] text-xs"
              value={thread.category?.id ?? ''}
              disabled={!!busy}
              onChange={(e) => moderate('move', { category_id: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  Move to: {c.name}
                </option>
              ))}
            </select>
          )}
          {busy && <Loader2 className="h-4 w-4 animate-spin text-amber-800" />}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <MessageSquare className="h-5 w-5 text-primary" />
          {thread.answers.length} {thread.answers.length === 1 ? 'answer' : 'answers'}
        </h2>
        {thread.answers.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">No answers yet — share what you know.</p>
        )}
        {thread.answers.map((a) => (
          <AnswerCard
            key={a.id}
            answer={a}
            meId={meId}
            canAccept={thread.can_accept}
            canModerate={thread.can_moderate}
            highlighted={hash === `answer-${a.id}`}
            onChange={(next) => setThread((t) => (t ? { ...t, answers: t.answers.map((x) => (x.id === next.id ? next : x)) } : t))}
            onRemoved={() => void load(false)}
            onModerated={() => void load(false)}
            onAccept={(on) => accept(a.id, on)}
            onReport={() => setReport({ type: 'answer', id: a.id })}
          />
        ))}
      </section>

      <section className={cn('rounded-2xl border border-border bg-surface p-5 shadow-sm', !canAnswer && 'bg-slate-50')}>
        {canAnswer ? (
          <div className="space-y-3">
            <h2 className="text-base font-semibold">Your answer</h2>
            <PostEditor
              body={answerBody}
              onBodyChange={setAnswerBody}
              links={answerLinks}
              onLinksChange={setAnswerLinks}
              rows={5}
              placeholder="Share the steps, the rule, or your experience. Tag the workflow, checklist or circular that backs it up."
            />
            {answerError && <Alert variant="error">{answerError}</Alert>}
            <div className="flex justify-end">
              <Button onClick={postAnswer} disabled={posting}>
                {posting && <Loader2 className="h-4 w-4 animate-spin" />}
                Post answer
              </Button>
            </div>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Lock className="h-4 w-4" /> This discussion is locked, so new answers are closed.
          </p>
        )}
      </section>

      {report && <ReportDialog targetType={report.type} targetId={report.id} onClose={() => setReport(null)} />}
    </div>
  );
}
