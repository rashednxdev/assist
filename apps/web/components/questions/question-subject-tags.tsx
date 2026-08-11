'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';

export interface QuestionSubjectTag {
  id: string;
  name: string;
  name_bn?: string;
}

export interface SubjectCatalogItem {
  id: string;
  name: string;
  name_bn?: string;
  label: string;
}

interface QuestionSubjectTagsProps {
  questionId: string;
  subjects: QuestionSubjectTag[];
  catalog: SubjectCatalogItem[];
  disabled?: boolean;
  onChange: (subjects: QuestionSubjectTag[]) => void;
}

function subjectLabel(s: { name: string; name_bn?: string }) {
  return s.name_bn?.trim() || s.name;
}

/** Inline multi-subject tags on the Question Bank row — add via select, remove with one click. */
export function QuestionSubjectTags({
  questionId,
  subjects,
  catalog,
  disabled,
  onChange,
}: QuestionSubjectTagsProps) {
  const [busy, setBusy] = useState(false);
  const taggedIds = new Set(subjects.map((s) => s.id));
  const available = catalog.filter((c) => !taggedIds.has(c.id));

  async function addSubject(examSubjectId: string) {
    if (!examSubjectId || busy || disabled) return;
    setBusy(true);
    try {
      const res = await apiFetch<{
        data: { exam_subject_id: string; name: string; name_bn?: string };
      }>(`/questions/${questionId}/subject-links`, {
        method: 'POST',
        body: JSON.stringify({ exam_subject_id: examSubjectId }),
      });
      const next = [
        ...subjects.filter((s) => s.id !== res.data.exam_subject_id),
        {
          id: res.data.exam_subject_id,
          name: res.data.name,
          name_bn: res.data.name_bn,
        },
      ];
      onChange(next);
    } finally {
      setBusy(false);
    }
  }

  async function removeSubject(examSubjectId: string) {
    if (busy || disabled) return;
    setBusy(true);
    try {
      await apiFetch(`/questions/${questionId}/subject-links/${examSubjectId}`, {
        method: 'DELETE',
      });
      onChange(subjects.filter((s) => s.id !== examSubjectId));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-1.5"
      onClick={(e) => e.preventDefault()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {subjects.map((s) => (
        <Badge key={s.id} variant="secondary" className="gap-1 pr-1">
          <span>{subjectLabel(s)}</span>
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
          className="h-7 max-w-[220px] rounded-md border border-input bg-background px-2 text-xs"
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
  );
}
