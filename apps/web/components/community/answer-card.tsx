'use client';

import { useState } from 'react';
import { CheckCircle2, EyeOff, Flag, Loader2, Pencil, Trash2 } from 'lucide-react';
import type { CommunityAnswerRecord, CommunityLinkRecord } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { timeAgo } from '@/lib/community';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { PostBody } from '@/components/community/post-body';
import { LinkChips } from '@/components/community/link-chips';
import { PostEditor } from '@/components/community/post-editor';
import { Avatar, AuthorName, AuthorWork, VoteButton } from '@/components/community/community-bits';

export function AnswerCard({
  answer,
  meId,
  canAccept,
  canModerate,
  highlighted,
  onChange,
  onRemoved,
  onAccept,
  onReport,
  onModerated,
}: {
  answer: CommunityAnswerRecord;
  meId: string;
  canAccept: boolean;
  canModerate: boolean;
  highlighted?: boolean;
  onChange: (a: CommunityAnswerRecord) => void;
  onRemoved: () => void;
  onAccept: (accept: boolean) => Promise<void>;
  onReport: () => void;
  onModerated: () => void;
}) {
  const own = answer.author.id === meId;
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(answer.body);
  const [links, setLinks] = useState<CommunityLinkRecord[]>(answer.links);
  const [busy, setBusy] = useState<'' | 'save' | 'delete' | 'accept' | 'hide'>('');
  const [error, setError] = useState('');

  async function run(kind: typeof busy, fn: () => Promise<void>) {
    setBusy(kind);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy('');
    }
  }

  const save = () =>
    run('save', async () => {
      const r = await apiFetch<{ data: CommunityAnswerRecord }>(`/community/answers/${answer.id}`, {
        method: 'PUT',
        body: JSON.stringify({ body, links: links.map((l) => ({ type: l.type, id: l.id })) }),
      });
      onChange(r.data);
      setEditing(false);
    });

  const remove = () => {
    if (!window.confirm('Delete this answer?')) return;
    void run('delete', async () => {
      await apiFetch(`/community/answers/${answer.id}`, { method: 'DELETE' });
      onRemoved();
    });
  };

  const toggleHidden = () =>
    run('hide', async () => {
      await apiFetch(`/community/admin/answers/${answer.id}/moderate`, { method: 'POST', body: JSON.stringify({ is_hidden: !answer.is_hidden }) });
      onModerated();
    });

  return (
    <article
      id={`answer-${answer.id}`}
      className={cn(
        'scroll-mt-24 rounded-2xl border bg-surface p-4 shadow-sm transition sm:p-5',
        answer.is_accepted ? 'border-success/50 ring-1 ring-success/30' : 'border-border',
        answer.is_hidden && 'border-dashed bg-slate-50',
        highlighted && 'ring-2 ring-primary/40',
      )}
    >
      {answer.is_accepted && (
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-success-light px-2.5 py-1 text-xs font-semibold text-success">
          <CheckCircle2 className="h-3.5 w-3.5" /> Accepted answer
        </p>
      )}
      {answer.is_hidden && (
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-destructive-light px-2.5 py-1 text-xs font-semibold text-destructive">
          <EyeOff className="h-3.5 w-3.5" /> Hidden by a moderator — only the author and admins can see it
        </p>
      )}

      <div className="flex items-center gap-2.5 text-sm">
        <Avatar author={answer.author} />
        <div className="min-w-0 leading-tight">
          <AuthorName author={answer.author} />
          <AuthorWork author={answer.author} className="block text-xs" />
          <p className="text-xs text-muted">
            answered {timeAgo(answer.created_at)}
            {answer.edited_at && ` · edited ${timeAgo(answer.edited_at)}`}
          </p>
        </div>
      </div>

      <div className="mt-3">
        {editing ? (
          <div className="space-y-2">
            <PostEditor body={body} onBodyChange={setBody} links={links} onLinksChange={setLinks} rows={5} />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setBody(answer.body);
                  setLinks(answer.links);
                }}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={save} disabled={busy === 'save' || body.trim().length < 2}>
                {busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        ) : (
          <>
            <PostBody text={answer.body} />
            <LinkChips links={answer.links} className="mt-3" />
          </>
        )}
      </div>

      {error && (
        <Alert variant="error" className="mt-3">
          {error}
        </Alert>
      )}

      {!editing && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
          <VoteButton
            layout="row"
            path={`/community/answers/${answer.id}/vote`}
            score={answer.vote_score}
            voted={answer.voted}
            disabled={own}
            onChange={(v) => onChange({ ...answer, voted: v.voted, vote_score: v.vote_score })}
          />
          {canAccept && !answer.is_hidden && (
            <Button
              size="sm"
              variant="outline"
              className={cn(answer.is_accepted ? 'text-muted' : 'border-success/40 text-success hover:bg-success-light')}
              disabled={busy === 'accept'}
              onClick={() => run('accept', () => onAccept(!answer.is_accepted))}
            >
              {busy === 'accept' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {answer.is_accepted ? 'Unmark solution' : 'Mark as solution'}
            </Button>
          )}
          <span className="flex-1" />
          {answer.can_edit && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={remove} disabled={busy === 'delete'}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </>
          )}
          {canModerate && (
            <Button size="sm" variant="ghost" onClick={toggleHidden} disabled={busy === 'hide'}>
              <EyeOff className="h-3.5 w-3.5" /> {answer.is_hidden ? 'Unhide' : 'Hide'}
            </Button>
          )}
          {!own && (
            <Button size="sm" variant="ghost" className="text-muted" onClick={onReport}>
              <Flag className="h-3.5 w-3.5" /> Report
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
