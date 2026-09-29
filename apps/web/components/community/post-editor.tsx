'use client';

import { useRef, useState } from 'react';
import { Bold, Code, Eye, List, ListOrdered, Paperclip, PenLine, X } from 'lucide-react';
import { COMMUNITY_LINK_KIND_LABELS, type CommunityLinkRecord } from '@ibas/shared-types';
import { LINK_KIND_STYLE } from '@/lib/community';
import { cn } from '@/lib/utils';
import { PostBody } from '@/components/community/post-body';
import { LinkPicker } from '@/components/community/link-picker';

function ToolButton({ label, onClick, children, active }: { label: string; onClick: () => void; children: React.ReactNode; active?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn('inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted hover:bg-slate-100 hover:text-foreground', active && 'bg-slate-100 text-foreground')}
    >
      {children}
    </button>
  );
}

/** Textarea with light formatting, preview, and workflow / toolkit / circular tagging. */
export function PostEditor({
  body,
  onBodyChange,
  links,
  onLinksChange,
  placeholder,
  rows = 6,
  autoFocus,
}: {
  body: string;
  onBodyChange: (v: string) => void;
  links: CommunityLinkRecord[];
  onLinksChange: (v: CommunityLinkRecord[]) => void;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);
  const [picking, setPicking] = useState(false);

  function wrap(before: string, after = before, fallback = 'text') {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = body.slice(s, e) || fallback;
    const next = body.slice(0, s) + before + selected + after + body.slice(e);
    onBodyChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + selected.length);
    });
  }

  function prefixLines(marker: (i: number) => string) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const lineStart = body.lastIndexOf('\n', s - 1) + 1;
    const chunk = body.slice(lineStart, e) || 'item';
    const lines = chunk.split('\n').map((l, i) => `${marker(i)}${l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')}`);
    const next = body.slice(0, lineStart) + lines.join('\n') + body.slice(e);
    onBodyChange(next);
    requestAnimationFrame(() => el.focus());
  }

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-xl border border-input bg-background focus-within:ring-2 focus-within:ring-primary/30">
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-slate-50/70 px-1.5 py-1">
          <ToolButton label="Write" onClick={() => setPreview(false)} active={!preview}>
            <PenLine className="h-3.5 w-3.5" /> Write
          </ToolButton>
          <ToolButton label="Preview" onClick={() => setPreview(true)} active={preview}>
            <Eye className="h-3.5 w-3.5" /> Preview
          </ToolButton>
          <span className="mx-1 h-5 w-px bg-border" />
          {!preview && (
            <>
              <ToolButton label="Bold" onClick={() => wrap('**')}>
                <Bold className="h-3.5 w-3.5" />
              </ToolButton>
              <ToolButton label="Bulleted list" onClick={() => prefixLines(() => '- ')}>
                <List className="h-3.5 w-3.5" />
              </ToolButton>
              <ToolButton label="Numbered list" onClick={() => prefixLines((i) => `${i + 1}. `)}>
                <ListOrdered className="h-3.5 w-3.5" />
              </ToolButton>
              <ToolButton label="Code / reference number" onClick={() => wrap('`', '`', 'code')}>
                <Code className="h-3.5 w-3.5" />
              </ToolButton>
            </>
          )}
          <span className="flex-1" />
          <ToolButton label="Tag workflow, toolkit or circular" onClick={() => setPicking((v) => !v)} active={picking}>
            <Paperclip className="h-3.5 w-3.5" /> Tag
            {links.length > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-white">{links.length}</span>}
          </ToolButton>
        </div>
        {preview ? (
          <div className="min-h-[9rem] px-3 py-2.5">
            {body.trim() ? <PostBody text={body} /> : <p className="text-sm text-muted">Nothing to preview yet.</p>}
          </div>
        ) : (
          <textarea
            ref={ref}
            rows={rows}
            autoFocus={autoFocus}
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            placeholder={placeholder}
            className="block w-full resize-y border-0 bg-transparent px-3 py-2.5 text-[15px] leading-relaxed outline-none placeholder:text-muted"
          />
        )}
      </div>

      {links.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {links.map((l) => {
            const style = LINK_KIND_STYLE[l.kind];
            const Icon = style.icon;
            return (
              <span key={`${l.type}:${l.id}`} className={cn('inline-flex max-w-full items-center gap-1.5 rounded-lg border py-1 pl-2 pr-1 text-xs', style.className)}>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="font-semibold">{COMMUNITY_LINK_KIND_LABELS[l.kind]}:</span>
                <span className="min-w-0 truncate">{l.title}</span>
                <button
                  type="button"
                  className="rounded p-0.5 hover:bg-black/10"
                  aria-label={`Remove ${l.title}`}
                  onClick={() => onLinksChange(links.filter((x) => !(x.type === l.type && x.id === l.id)))}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {picking && <LinkPicker value={links} onChange={onLinksChange} onClose={() => setPicking(false)} />}
    </div>
  );
}
