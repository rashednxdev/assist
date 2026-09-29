'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { CircularTagCount } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';

/**
 * Chip-style tag editor. Suggests tags already used on other circulars so the same tag is reused
 * (matching is case-insensitive; the existing spelling wins).
 */
export function TagInput({
  value,
  onChange,
  max = 30,
  placeholder = 'Type a tag and press Enter…',
}: {
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  placeholder?: string;
}) {
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState<CircularTagCount[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const term = text.trim();
    const t = setTimeout(() => {
      apiFetch<{ data: CircularTagCount[] }>(`/circulars/tags?limit=12${term ? `&q=${encodeURIComponent(term)}` : ''}`)
        .then((r) => {
          setSuggestions(r.data.filter((s) => !value.some((v) => v.toLowerCase() === s.tag.toLowerCase())));
          setHighlight(0);
        })
        .catch(() => setSuggestions([]));
    }, 200);
    return () => clearTimeout(t);
  }, [text, value]);

  function add(raw: string) {
    const tag = raw.replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!tag || value.length >= max) return;
    if (value.some((v) => v.toLowerCase() === tag.toLowerCase())) {
      setText('');
      return;
    }
    const existing = suggestions.find((s) => s.tag.toLowerCase() === tag.toLowerCase());
    onChange([...value, existing?.tag ?? tag]);
    setText('');
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (open && suggestions[highlight] && text.trim() && suggestions[highlight]!.tag.toLowerCase().includes(text.trim().toLowerCase())) {
        add(suggestions[highlight]!.tag);
      } else {
        add(text);
      }
    } else if (e.key === 'Backspace' && !text && value.length) {
      onChange(value.slice(0, -1));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <div
        className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
            #{t}
            <button
              type="button"
              aria-label={`Remove tag ${t}`}
              onClick={(e) => {
                e.stopPropagation();
                onChange(value.filter((v) => v !== t));
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={text}
          disabled={value.length >= max}
          onChange={(e) => {
            const v = e.target.value;
            if (v.includes(',')) {
              v.split(',').slice(0, -1).forEach(add);
              setText(v.split(',').pop() ?? '');
            } else {
              setText(v);
            }
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          placeholder={value.length ? '' : placeholder}
          className="min-w-[140px] flex-1 bg-transparent py-0.5 text-sm outline-none"
        />
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-background shadow-lg">
          <p className="px-3 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted">
            {text.trim() ? 'Existing tags' : 'Popular tags'}
          </p>
          {suggestions.map((s, i) => (
            <button
              key={s.tag}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                add(s.tag);
              }}
              className={cn(
                'flex w-full items-center justify-between px-3 py-1.5 text-left text-sm',
                i === highlight ? 'bg-primary/10' : 'hover:bg-slate-50',
              )}
            >
              <span>#{s.tag}</span>
              <span className="text-xs text-muted">
                {s.count} circular{s.count === 1 ? '' : 's'}
              </span>
            </button>
          ))}
        </div>
      )}
      <p className="mt-1 text-xs text-muted">
        Press Enter or comma to add. Pick an existing tag where possible so users find related circulars together.
      </p>
    </div>
  );
}
