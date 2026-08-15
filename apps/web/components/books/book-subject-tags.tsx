'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

export interface BookSubjectTag {
  id: string;
  name: string;
  name_bn?: string;
  sort_order: number;
}

export interface SubjectCatalogItem {
  id: string;
  name: string;
  name_bn?: string;
  label: string;
}

interface BookSubjectTagsProps {
  bookId: string;
  subjects: BookSubjectTag[];
  catalog: SubjectCatalogItem[];
  disabled?: boolean;
  onChange: (subjects: BookSubjectTag[]) => void;
}

function subjectLabel(s: { name: string; name_bn?: string }) {
  return s.name_bn?.trim() || s.name;
}

/** Inline subject tags + per-subject sort order for Rule Library books (mirrors Question Bank tags). */
export function BookSubjectTags({
  bookId,
  subjects,
  catalog,
  disabled,
  onChange,
}: BookSubjectTagsProps) {
  const [busy, setBusy] = useState(false);
  const taggedIds = new Set(subjects.map((s) => s.id));
  const available = catalog.filter((c) => !taggedIds.has(c.id));

  async function addSubject(examSubjectId: string) {
    if (!examSubjectId || busy || disabled) return;
    setBusy(true);
    try {
      const res = await apiFetch<{
        data: { id: string; name: string; name_bn?: string; sort_order: number };
      }>(`/books/${bookId}/subject-links`, {
        method: 'POST',
        body: JSON.stringify({ exam_subject_id: examSubjectId }),
      });
      const next = [
        ...subjects.filter((s) => s.id !== res.data.id),
        {
          id: res.data.id,
          name: res.data.name,
          name_bn: res.data.name_bn,
          sort_order: res.data.sort_order,
        },
      ].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
      onChange(next);
    } finally {
      setBusy(false);
    }
  }

  async function removeSubject(examSubjectId: string) {
    if (busy || disabled) return;
    setBusy(true);
    try {
      await apiFetch(`/books/${bookId}/subject-links/${examSubjectId}`, {
        method: 'DELETE',
      });
      onChange(subjects.filter((s) => s.id !== examSubjectId));
    } finally {
      setBusy(false);
    }
  }

  async function updateSort(examSubjectId: string, sortOrder: number) {
    if (busy || disabled || Number.isNaN(sortOrder)) return;
    setBusy(true);
    try {
      const res = await apiFetch<{
        data: { id: string; name: string; name_bn?: string; sort_order: number };
      }>(`/books/${bookId}/subject-links/${examSubjectId}`, {
        method: 'PATCH',
        body: JSON.stringify({ sort_order: sortOrder }),
      });
      onChange(
        subjects
          .map((s) =>
            s.id === res.data.id
              ? {
                  id: res.data.id,
                  name: res.data.name,
                  name_bn: res.data.name_bn,
                  sort_order: res.data.sort_order,
                }
              : s,
          )
          .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="mt-2 flex flex-col gap-2"
      onClick={(e) => e.preventDefault()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {subjects.map((s) => (
          <Badge key={s.id} variant="secondary" className="gap-1.5 pr-1">
            <span>{subjectLabel(s)}</span>
            {!disabled ? (
              <Input
                type="number"
                min={0}
                className="h-6 w-14 px-1 text-xs"
                value={s.sort_order}
                disabled={busy}
                title="Sort order on this subject"
                aria-label={`Sort order for ${subjectLabel(s)}`}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  onChange(
                    subjects.map((row) =>
                      row.id === s.id ? { ...row, sort_order: Number.isFinite(next) ? next : 0 } : row,
                    ),
                  );
                }}
                onBlur={(e) => {
                  const next = Number(e.target.value);
                  if (!Number.isFinite(next) || next === s.sort_order) return;
                  void updateSort(s.id, Math.max(0, Math.floor(next)));
                }}
              />
            ) : (
              <span className="text-[10px] opacity-70">#{s.sort_order}</span>
            )}
            {!disabled ? (
              <button
                type="button"
                className="rounded p-0.5 hover:bg-black/10"
                aria-label={`Remove ${subjectLabel(s)}`}
                disabled={busy}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void removeSubject(s.id);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </Badge>
        ))}
        {!disabled && available.length > 0 ? (
          <select
            className="h-7 max-w-[240px] rounded-md border border-input bg-background px-2 text-xs"
            disabled={busy}
            value=""
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const id = e.target.value;
              e.target.value = '';
              void addSubject(id);
            }}
            aria-label="Add subject tag"
          >
            <option value="">+ Subject…</option>
            {available.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        ) : null}
        {!disabled && available.length === 0 && subjects.length === 0 ? (
          <span className="text-xs text-muted-foreground">No subjects in catalog</span>
        ) : null}
      </div>
      {!disabled && subjects.length > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Sort number controls book order for that subject (lower first) in web and mobile Books &amp; Tools.
        </p>
      ) : null}
    </div>
  );
}
