'use client';

import { useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { chapterHeading } from '@/lib/book-display';
import { STATIC_REF_PAGE_OPTIONS } from '@/lib/static-ref-pages';

function wrapHtml(text: string) {
  const t = text.trim();
  if (!t) return '';
  return t.startsWith('<') ? t : `<p>${t}</p>`;
}

function stripHtml(html?: string) {
  return html?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ?? '';
}

export type ChapterOption = {
  id: string;
  chapter_number: string;
  name: string;
  sub_name?: string;
};

export function InlineEditTrigger({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'default' : 'outline'}
      className="shrink-0"
      title={label}
      onClick={onClick}
    >
      {active ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
      <span className="hidden sm:inline">{active ? 'Close' : 'Edit'}</span>
    </Button>
  );
}

export function ChapterInlineEdit({
  chapterId,
  initial,
  onCancel,
  onSaved,
}: {
  chapterId: string;
  initial: {
    chapter_number: string;
    name: string;
    sub_name?: string;
    description?: string;
  };
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    chapter_number: initial.chapter_number,
    name: initial.name,
    sub_name: initial.sub_name ?? '',
    description: stripHtml(initial.description),
  });

  async function save() {
    if (!form.chapter_number.trim() || !form.name.trim()) {
      setError('Chapter number and name are required');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/books/chapters/${chapterId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          chapter_number: form.chapter_number.trim(),
          name: form.name.trim(),
          sub_name: form.sub_name.trim() || undefined,
          description: form.description.trim() ? wrapHtml(form.description) : '',
        }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update chapter');
    } finally {
      setBusy(false);
    }
  }

  return (
    <InlineFormShell title="Edit chapter" error={error} busy={busy} onCancel={onCancel} onSave={save}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Chapter no.">
          <Input
            disabled={busy}
            value={form.chapter_number}
            onChange={(e) => setForm({ ...form, chapter_number: e.target.value })}
          />
        </Field>
        <Field label="Name">
          <Input
            disabled={busy}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Sub-name (optional)">
        <Input
          disabled={busy}
          value={form.sub_name}
          onChange={(e) => setForm({ ...form, sub_name: e.target.value })}
        />
      </Field>
      <Field label="Description">
        <textarea
          className="ibas-textarea text-sm min-h-[88px]"
          disabled={busy}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </Field>
    </InlineFormShell>
  );
}

export function TopicInlineEdit({
  topicId,
  currentChapterId,
  chapters,
  initial,
  onCancel,
  onSaved,
}: {
  topicId: string;
  currentChapterId: string;
  chapters: ChapterOption[];
  initial: {
    rule_number: string;
    name?: string;
    sub_name?: string;
    description?: string;
    note?: string;
    content_link?: string;
  };
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    rule_number: initial.rule_number,
    name: initial.name ?? '',
    sub_name: initial.sub_name ?? '',
    description: stripHtml(initial.description),
    note: initial.note ?? '',
    content_link: initial.content_link ?? '',
    book_chapter_id: currentChapterId,
  });

  async function save() {
    if (!form.rule_number.trim()) {
      setError('Rule number is required');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const body: Record<string, string | undefined> = {
        rule_number: form.rule_number.trim(),
        name: form.name.trim() || undefined,
        sub_name: form.sub_name.trim() || undefined,
        description: form.description.trim() ? wrapHtml(form.description) : '',
        note: form.note.trim() || undefined,
        content_link: form.content_link.trim(),
      };
      if (form.book_chapter_id !== currentChapterId) {
        body.book_chapter_id = form.book_chapter_id;
      }
      await apiFetch(`/books/topics/${topicId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rule');
    } finally {
      setBusy(false);
    }
  }

  return (
    <InlineFormShell title="Edit rule" error={error} busy={busy} onCancel={onCancel} onSave={save}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Rule no.">
          <Input
            disabled={busy}
            value={form.rule_number}
            onChange={(e) => setForm({ ...form, rule_number: e.target.value })}
          />
        </Field>
        <Field label="Title (optional)">
          <Input
            disabled={busy}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Sub-name (optional)">
        <Input
          disabled={busy}
          value={form.sub_name}
          onChange={(e) => setForm({ ...form, sub_name: e.target.value })}
        />
      </Field>
      <Field label="Move to chapter">
        <select
          className="ibas-select text-sm"
          disabled={busy}
          value={form.book_chapter_id}
          onChange={(e) => setForm({ ...form, book_chapter_id: e.target.value })}
        >
          {chapters.map((c) => (
            <option key={c.id} value={c.id}>
              {chapterHeading(c)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Page link (optional)">
        <select
          className="ibas-select text-sm mb-2"
          disabled={busy}
          value={
            STATIC_REF_PAGE_OPTIONS.some((o) => o.href === form.content_link)
              ? form.content_link
              : form.content_link
                ? '__custom__'
                : ''
          }
          onChange={(e) => {
            const v = e.target.value;
            if (v === '__custom__') return;
            setForm({ ...form, content_link: v });
          }}
        >
          <option value="">No linked page</option>
          {STATIC_REF_PAGE_OPTIONS.map((o) => (
            <option key={o.href} value={o.href}>
              {o.label}
            </option>
          ))}
          {form.content_link &&
            !STATIC_REF_PAGE_OPTIONS.some((o) => o.href === form.content_link) && (
              <option value="__custom__">Custom path</option>
            )}
        </select>
        <Input
          disabled={busy}
          value={form.content_link}
          placeholder="/static-ref/jsi-2016-p"
          onChange={(e) => setForm({ ...form, content_link: e.target.value })}
        />
        <p className="mt-1 text-[11px] text-muted">
          Shown as an embedded page in Full book view (like Static Ref).
        </p>
      </Field>
      <Field label="Details">
        <textarea
          className="ibas-textarea text-sm min-h-[88px]"
          disabled={busy}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </Field>
      <Field label="Note / cross-ref">
        <Input
          disabled={busy}
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
        />
      </Field>
    </InlineFormShell>
  );
}

export function SubTopicInlineEdit({
  subTopicId,
  initial,
  onCancel,
  onSaved,
}: {
  subTopicId: string;
  initial: {
    rule_number?: string;
    name?: string;
    description?: string;
    note?: string;
  };
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    rule_number: initial.rule_number ?? '',
    name: initial.name ?? '',
    description: stripHtml(initial.description),
    note: initial.note ?? '',
  });

  async function save() {
    if (!form.rule_number.trim() && !form.name.trim()) {
      setError('Sub-rule number or title is required');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/books/sub-topics/${subTopicId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          rule_number: form.rule_number.trim() || undefined,
          name: form.name.trim() || undefined,
          description: form.description.trim() ? wrapHtml(form.description) : '',
          note: form.note.trim() || undefined,
        }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update sub-rule');
    } finally {
      setBusy(false);
    }
  }

  return (
    <InlineFormShell title="Edit sub-rule" error={error} busy={busy} onCancel={onCancel} onSave={save}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Sub-rule no.">
          <Input
            disabled={busy}
            value={form.rule_number}
            onChange={(e) => setForm({ ...form, rule_number: e.target.value })}
          />
        </Field>
        <Field label="Title (optional)">
          <Input
            disabled={busy}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Details">
        <textarea
          className="ibas-textarea text-sm min-h-[88px]"
          disabled={busy}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </Field>
      <Field label="Note / cross-ref">
        <Input
          disabled={busy}
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
        />
      </Field>
    </InlineFormShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted">{label}</Label>
      {children}
    </div>
  );
}

function InlineFormShell({
  title,
  error,
  busy,
  onCancel,
  onSave,
  children,
}: {
  title: string;
  error: string;
  busy: boolean;
  onCancel: () => void;
  onSave: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 space-y-3 rounded-lg border border-primary/20 bg-surface p-3 sm:p-4">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {children}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" size="sm" disabled={busy} onClick={onSave}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
