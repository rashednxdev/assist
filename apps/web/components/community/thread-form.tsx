'use client';

import { useEffect, useState } from 'react';
import { Hash, Loader2, X } from 'lucide-react';
import {
  COMMUNITY_MAX_TAGS,
  PROFILE_WORK_IDENTITY_REQUIRED,
  type CommunityCategoryRecord,
  type CommunityLinkRecord,
} from '@ibas/shared-types';
import { ApiError, apiFetch } from '@/lib/api-client';
import { useWorkIdentity } from '@/lib/use-work-identity';
import { PostingAs, useCanPost } from '@/components/community/posting-as';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { PostEditor } from '@/components/community/post-editor';

export interface ThreadFormValues {
  title: string;
  body: string;
  category_id: string;
  tags: string[];
  links: CommunityLinkRecord[];
}

function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-').slice(0, 30);
}

export function ThreadForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  requireIdentity = true,
}: {
  initial?: Partial<ThreadFormValues>;
  submitLabel: string;
  onSubmit: (payload: { title: string; body: string; category_id: string; tags: string[]; links: Array<{ type: string; id: string }> }) => Promise<void>;
  onCancel?: () => void;
  /** New posts need the author's office + designation; edits keep the ones saved with the post. */
  requireIdentity?: boolean;
}) {
  const { ready: canPost } = useCanPost();
  const { refresh: refreshIdentity } = useWorkIdentity();
  const [categories, setCategories] = useState<CommunityCategoryRecord[]>([]);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? '');
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagDraft, setTagDraft] = useState('');
  const [links, setLinks] = useState<CommunityLinkRecord[]>(initial?.links ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ data: CommunityCategoryRecord[] }>('/community/categories')
      .then((r) => {
        setCategories(r.data);
        setCategoryId((cur) => cur || r.data[0]?.id || '');
      })
      .catch(() => setCategories([]));
  }, []);

  function addTag(raw: string) {
    const t = normalizeTag(raw);
    if (t.length < 2 || tags.includes(t) || tags.length >= COMMUNITY_MAX_TAGS) return;
    setTags([...tags, t]);
  }

  function onTagKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagDraft);
      setTagDraft('');
    } else if (e.key === 'Backspace' && !tagDraft && tags.length) {
      setTags(tags.slice(0, -1));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const finalTags = tagDraft.trim() ? [...new Set([...tags, normalizeTag(tagDraft)])].filter((t) => t.length >= 2).slice(0, COMMUNITY_MAX_TAGS) : tags;
    if (title.trim().length < 8) return setError('Give your discussion a clear title (8+ characters).');
    if (body.trim().length < 10) return setError('Add a few more details (10+ characters).');
    if (!categoryId) return setError('Pick a category.');
    if (requireIdentity && !canPost) return setError('Add your designation and office above before publishing.');
    setBusy(true);
    try {
      await onSubmit({
        title: title.trim(),
        body: body.trim(),
        category_id: categoryId,
        tags: finalTags,
        links: links.map((l) => ({ type: l.type, id: l.id })),
      });
    } catch (err) {
      if (err instanceof ApiError && err.code === PROFILE_WORK_IDENTITY_REQUIRED) void refreshIdentity();
      setError(err instanceof Error ? err.message : 'Could not save');
      setBusy(false);
    }
  }

  const selected = categories.find((c) => c.id === categoryId);

  return (
    <form onSubmit={submit}>
      <Card>
        <CardContent className="space-y-5 p-5 sm:p-6">
          {requireIdentity && <PostingAs />}
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              maxLength={160}
              autoFocus={!initial?.title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. How do I correct a wrong economic code after a bill is passed in iBAS++?"
              className="h-11 text-base"
            />
            <p className="text-xs text-muted">Ask a question or share something new — be specific so others can find it.</p>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition',
                    categoryId === c.id ? 'border-transparent text-white shadow-sm' : 'border-border bg-surface text-foreground hover:bg-slate-50',
                  )}
                  style={categoryId === c.id ? { backgroundColor: c.color } : undefined}
                >
                  {categoryId !== c.id && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />}
                  {c.name}
                </button>
              ))}
            </div>
            {selected?.description && <p className="text-xs text-muted">{selected.description}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Details</Label>
            <PostEditor
              body={body}
              onBodyChange={setBody}
              links={links}
              onLinksChange={setLinks}
              rows={8}
              placeholder={'Explain the situation, what you tried, and what you need.\n\nTip: use "Tag" to attach the related workflow, checklist, template or circular.'}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tags">Hashtags</Label>
            <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1.5 focus-within:ring-2 focus-within:ring-primary/30">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-2 pr-1 text-xs font-medium">
                  #{t}
                  <button type="button" className="rounded-full p-0.5 hover:bg-slate-200" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {tags.length < COMMUNITY_MAX_TAGS && (
                <span className="flex flex-1 items-center gap-1">
                  <Hash className="h-3.5 w-3.5 text-muted" />
                  <input
                    id="tags"
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={onTagKey}
                    onBlur={() => {
                      if (tagDraft.trim()) {
                        addTag(tagDraft);
                        setTagDraft('');
                      }
                    }}
                    placeholder={tags.length ? 'Add another' : 'e.g. pension, bill-pass, gpf'}
                    className="min-w-[8rem] flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted"
                  />
                </span>
              )}
            </div>
            <p className="text-xs text-muted">Press Enter or comma to add · up to {COMMUNITY_MAX_TAGS}.</p>
          </div>

          {error && <Alert variant="error">{error}</Alert>}

          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={busy || (requireIdentity && !canPost)}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
