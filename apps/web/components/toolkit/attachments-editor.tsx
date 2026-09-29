'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, FileText, ListPlus, Plus, Trash2 } from 'lucide-react';
import type { ToolkitAttachment } from '@ibas/shared-types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const isValidUrl = (url: string) => url.startsWith('/') || /^https?:\/\/\S+$/i.test(url);

/** "…/Bill%20Form-3.pdf?x=1" → "Bill Form-3" — used when a link is pasted without a title. */
function titleFromUrl(url: string): string {
  try {
    const last = decodeURIComponent(url.split(/[?#]/)[0]!.split('/').filter(Boolean).pop() ?? '');
    const name = last.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_+]+/g, ' ').trim();
    return name && !/^(view|edit|preview)$/i.test(name) ? name.slice(0, 200) : 'Document';
  } catch {
    return 'Document';
  }
}

/** Trims rows, drops empty ones and fills a missing title from the link. */
export function cleanAttachments(list: ToolkitAttachment[]): ToolkitAttachment[] {
  return list
    .map((a) => ({ title: a.title.trim(), url: a.url.trim() }))
    .filter((a) => a.url)
    .map((a) => ({ title: a.title || titleFromUrl(a.url), url: a.url }));
}

/** Editable list of PDF / document links with a "paste many" box (one `Title | link` per line). */
export function AttachmentsEditor({
  value,
  onChange,
  max,
  compact = false,
}: {
  value: ToolkitAttachment[];
  onChange: (next: ToolkitAttachment[]) => void;
  max: number;
  compact?: boolean;
}) {
  const [bulk, setBulk] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const full = value.length >= max;

  const update = (idx: number, patch: Partial<ToolkitAttachment>) =>
    onChange(value.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  const moveRow = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[idx], next[j]] = [next[j]!, next[idx]!];
    onChange(next);
  };

  function addBulk() {
    const added: ToolkitAttachment[] = [];
    for (const raw of bulk.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const bar = line.lastIndexOf('|');
      const url = (bar >= 0 ? line.slice(bar + 1) : line).trim();
      const title = bar >= 0 ? line.slice(0, bar).trim() : '';
      added.push({ title: title || titleFromUrl(url), url });
    }
    if (added.length) onChange([...value, ...added].slice(0, max));
    setBulk('');
    setShowBulk(false);
  }

  if (compact && value.length === 0) {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs font-medium text-primary"
        onClick={() => onChange([{ title: '', url: '' }])}
      >
        <FileText className="h-3 w-3" /> Attach PDF / file link
      </button>
    );
  }

  return (
    <div className={cn('space-y-2', !compact && 'rounded-lg border border-dashed border-border p-3')}>
      {value.map((a, idx) => {
        const badUrl = a.url.trim() !== '' && !isValidUrl(a.url.trim());
        return (
          <div key={idx} className="flex flex-wrap items-start gap-2">
            <FileText className="mt-2 h-4 w-4 shrink-0 text-red-600" />
            <Input
              value={a.title}
              onChange={(e) => update(idx, { title: e.target.value })}
              placeholder="Title, e.g. TR Form 21"
              className={cn('min-w-[140px] flex-1', compact && 'h-8 text-xs')}
            />
            <div className="min-w-[200px] flex-[2]">
              <Input
                value={a.url}
                onChange={(e) => update(idx, { url: e.target.value })}
                placeholder="https://drive.google.com/… or https://…/file.pdf"
                className={cn(compact && 'h-8 text-xs', badUrl && 'border-red-400')}
              />
              {badUrl && <p className="mt-0.5 text-xs text-red-600">Link must start with https:// (or / for a site path)</p>}
            </div>
            <div className="flex shrink-0 gap-0.5">
              <Button type="button" size="sm" variant="ghost" disabled={idx === 0} onClick={() => moveRow(idx, -1)} aria-label="Move up">
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={idx === value.length - 1}
                onClick={() => moveRow(idx, 1)}
                aria-label="Move down"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => onChange(value.filter((_, i) => i !== idx))}
                aria-label="Remove file link"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}

      {showBulk && (
        <div className="space-y-2">
          <p className="text-xs text-muted">
            One file per line as <code>Title | link</code>. A line with only a link uses the file name as its title.
          </p>
          <textarea
            rows={4}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={'Bill form (TR-21) | https://…/tr21.pdf\nhttps://drive.google.com/file/d/…/view'}
          />
          <Button type="button" size="sm" onClick={addBulk} disabled={!bulk.trim()}>
            Add links
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" disabled={full} onClick={() => onChange([...value, { title: '', url: '' }])}>
          <Plus className="h-4 w-4" /> File link
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={full} onClick={() => setShowBulk((v) => !v)}>
          <ListPlus className="h-4 w-4" /> Paste many
        </Button>
        <span className="text-xs text-muted">
          {value.length}/{max}
        </span>
      </div>
    </div>
  );
}
