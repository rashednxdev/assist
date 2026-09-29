'use client';

import { useState } from 'react';
import { ChevronUp, Flag, Loader2, ShieldCheck, X } from 'lucide-react';
import {
  COMMUNITY_REPORT_REASONS,
  COMMUNITY_REPORT_REASON_LABELS,
  type CommunityAuthor,
  type CommunityReportReason,
} from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

const AVATAR_COLORS = ['bg-teal-600', 'bg-blue-600', 'bg-violet-600', 'bg-rose-600', 'bg-amber-600', 'bg-emerald-600', 'bg-sky-600', 'bg-fuchsia-600'];

function colorFor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}

export function Avatar({ author, size = 'md' }: { author: CommunityAuthor; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        colorFor(author.id),
        size === 'sm' ? 'h-7 w-7 text-[11px]' : 'h-9 w-9 text-sm',
      )}
      aria-hidden
    >
      {author.initials}
    </span>
  );
}

export function AuthorName({ author }: { author: CommunityAuthor }) {
  return (
    <span className="inline-flex items-center gap-1 font-medium text-foreground">
      {author.name}
      {author.is_admin && (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-primary-muted px-1.5 py-0.5 text-[10px] font-semibold text-primary-dark">
          <ShieldCheck className="h-3 w-3" />
          Admin
        </span>
      )}
    </span>
  );
}

/** Upvote toggle. Disabled for your own posts. */
export function VoteButton({
  path,
  score,
  voted,
  disabled,
  layout = 'column',
  onChange,
}: {
  path: string;
  score: number;
  voted: boolean;
  disabled?: boolean;
  layout?: 'column' | 'row';
  onChange: (v: { voted: boolean; vote_score: number }) => void;
}) {
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    const optimistic = { voted: !voted, vote_score: score + (voted ? -1 : 1) };
    onChange(optimistic);
    try {
      const r = await apiFetch<{ data: { voted: boolean; vote_score: number } }>(path, { method: 'POST' });
      onChange(r.data);
    } catch {
      onChange({ voted, vote_score: score });
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || busy}
      title={disabled ? "You can't vote on your own post" : voted ? 'Remove upvote' : 'Upvote — this is useful'}
      className={cn(
        'inline-flex items-center justify-center rounded-xl border font-semibold transition',
        layout === 'column' ? 'h-14 w-12 flex-col text-sm' : 'h-8 gap-1 px-2.5 text-xs',
        voted ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-foreground hover:border-primary/50 hover:text-primary',
        disabled && 'cursor-not-allowed opacity-60 hover:border-border hover:text-foreground',
      )}
    >
      <ChevronUp className={layout === 'column' ? 'h-5 w-5' : 'h-4 w-4'} />
      {score}
    </button>
  );
}

export function ReportDialog({
  targetType,
  targetId,
  onClose,
}: {
  targetType: 'thread' | 'answer';
  targetId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<CommunityReportReason>('spam');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await apiFetch('/community/reports', {
        method: 'POST',
        body: JSON.stringify({ target_type: targetType, target_id: targetId, reason, note }),
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the report');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm space-y-4 rounded-2xl bg-surface p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Flag className="h-4 w-4 text-destructive" />
            Report {targetType === 'thread' ? 'discussion' : 'answer'}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-slate-100" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {done ? (
          <>
            <Alert variant="success">Thanks — a moderator will review it.</Alert>
            <Button className="w-full" onClick={onClose}>
              Close
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              {COMMUNITY_REPORT_REASONS.map((r) => (
                <label key={r} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                  <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} />
                  {COMMUNITY_REPORT_REASON_LABELS[r]}
                </label>
              ))}
            </div>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything the moderator should know? (optional)"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            {error && <Alert variant="error">{error}</Alert>}
            <Button className="w-full" variant="destructive" onClick={submit} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Send report
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
