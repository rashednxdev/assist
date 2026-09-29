'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ExternalLink, Save } from 'lucide-react';
import {
  TOOLKIT_KINDS,
  toolkitCategoriesFor,
  type ToolkitCategoryCode,
  type ToolkitKind,
} from '@ibas/shared-constants';
import type { ToolkitAttachment, ToolkitItemDetail, ToolkitResolvedRef } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { RefPicker, type EditorRef } from '@/components/toolkit/ref-picker';
import { AttachmentsEditor, cleanAttachments } from '@/components/toolkit/attachments-editor';
import { AreaCheckboxes } from '@/components/ibas/area-checkboxes';
import {
  ChecklistEditor,
  GuideEditor,
  TemplateEditor,
  newId,
  type EditorChecklistItem,
  type EditorSection,
  type TemplateEditorValue,
} from '@/components/toolkit/toolkit-editors';

const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

interface EditorState {
  kind: ToolkitKind;
  title: string;
  title_bn: string;
  summary: string;
  areas: string[];
  category: ToolkitCategoryCode;
  tags: string;
  refs: EditorRef[];
  attachments: ToolkitAttachment[];
  is_published: boolean;
  items: EditorChecklistItem[];
  template: TemplateEditorValue;
  sections: EditorSection[];
}

function blankState(kind: ToolkitKind): EditorState {
  return {
    kind,
    title: '',
    title_bn: '',
    summary: '',
    areas: [],
    category: toolkitCategoriesFor(kind)[0]!.code,
    tags: '',
    refs: [],
    attachments: [],
    is_published: false,
    items: [],
    template: { fields: [], row_label: '', row_fields: [], row_template: '', body: '' },
    sections: kind === 'guide' ? [{ id: newId(), heading: '', body: '', refs: [] }] : [],
  };
}

const toEditorRefs = (refs: ToolkitResolvedRef[]): EditorRef[] =>
  refs.map((r) => ({ target_type: r.target_type, target_id: r.target_id, title: r.title, missing: r.missing }));

function fromDetail(d: ToolkitItemDetail): EditorState {
  return {
    kind: d.kind,
    title: d.title,
    title_bn: d.title_bn ?? '',
    summary: d.summary ?? '',
    areas: d.areas,
    category: d.category,
    tags: d.tags.join(', '),
    refs: toEditorRefs(d.refs),
    attachments: d.attachments ?? [],
    is_published: d.is_published,
    items: (d.items ?? []).map((i) => ({
      id: i.id,
      section: i.section ?? '',
      text: i.text,
      help: i.help ?? '',
      required: i.required,
      refs: toEditorRefs(i.refs),
      attachments: i.attachments ?? [],
    })),
    template: {
      fields: d.fields ?? [],
      row_label: d.row_label ?? '',
      row_fields: d.row_fields ?? [],
      row_template: d.row_template ?? '',
      body: d.body ?? '',
    },
    sections: (d.sections ?? []).map((s) => ({ id: s.id, heading: s.heading, body: s.body, refs: toEditorRefs(s.refs) })),
  };
}

const refPayload = (refs: EditorRef[]) => refs.map((r) => ({ target_type: r.target_type, target_id: r.target_id }));
const opt = (s: string) => (s.trim() ? s.trim() : undefined);

function toPayload(s: EditorState) {
  const base = {
    kind: s.kind,
    title: s.title.trim(),
    title_bn: opt(s.title_bn),
    summary: opt(s.summary),
    areas: s.areas,
    category: s.category,
    tags: s.tags.split(',').map((t) => t.trim()).filter(Boolean),
    refs: refPayload(s.refs),
    attachments: cleanAttachments(s.attachments),
    is_published: s.is_published,
  };
  if (s.kind === 'checklist') {
    return {
      ...base,
      items: s.items
        .filter((i) => i.text.trim())
        .map((i) => ({
          id: i.id,
          section: opt(i.section),
          text: i.text.trim(),
          help: opt(i.help),
          required: i.required,
          refs: refPayload(i.refs),
          attachments: cleanAttachments(i.attachments),
        })),
    };
  }
  if (s.kind === 'template') {
    const cleanField = (f: TemplateEditorValue['fields'][number]) => ({ ...f, placeholder: opt(f.placeholder ?? ''), help: opt(f.help ?? '') });
    return {
      ...base,
      fields: s.template.fields.map(cleanField),
      row_label: opt(s.template.row_label),
      row_fields: s.template.row_fields.map(cleanField),
      row_template: opt(s.template.row_template),
      body: s.template.body,
    };
  }
  return {
    ...base,
    sections: s.sections.map((x) => ({ id: x.id, heading: x.heading.trim(), body: x.body, refs: refPayload(x.refs) })),
  };
}

function Editor() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const isNew = id === 'new';
  const kindParam = params.get('kind') as ToolkitKind | null;
  const [state, setState] = useState<EditorState | null>(
    isNew ? blankState(kindParam && TOOLKIT_KINDS.some((k) => k.code === kindParam) ? kindParam : 'checklist') : null,
  );
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) return;
    apiFetch<{ data: ToolkitItemDetail }>(`/toolkit/${id}`)
      .then((r) => setState(fromDetail(r.data)))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [id, isNew]);

  if (!state) {
    return error ? <Alert variant="error">{error}</Alert> : <Skeleton className="h-64 w-full" />;
  }

  const set = <K extends keyof EditorState>(key: K, value: EditorState[K]) => setState((s) => (s ? { ...s, [key]: value } : s));
  const kindInfo = TOOLKIT_KINDS.find((k) => k.code === state.kind)!;

  async function save(publish?: boolean) {
    if (!state) return;
    setError('');
    setSaved('');
    const payload = toPayload(publish === undefined ? state : { ...state, is_published: publish });
    setSaving(true);
    try {
      const r = await apiFetch<{ data: ToolkitItemDetail }>(isNew ? '/toolkit' : `/toolkit/${id}`, {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify(payload),
      });
      setState(fromDetail(r.data));
      setSaved(r.data.is_published ? 'Saved and published.' : 'Saved as draft.');
      if (isNew) router.replace(`/admin/toolkit/${r.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title={isNew ? `New ${kindInfo.label.toLowerCase()}` : `Edit ${kindInfo.label.toLowerCase()}`}
        description={kindInfo.description}
        backHref="/admin/toolkit"
        backLabel="Toolkit admin"
        action={
          !isNew && (
            <Button asChild variant="outline">
              <Link href={`/toolkit/${id}`} target="_blank">
                <ExternalLink className="h-4 w-4" /> View as user
              </Link>
            </Button>
          )
        }
      />

      {error && <Alert variant="error">{error}</Alert>}
      {saved && <Alert variant="success">{saved}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tk-title">Title *</Label>
              <Input id="tk-title" value={state.title} onChange={(e) => set('title', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tk-title-bn">Title (Bangla)</Label>
              <Input id="tk-title-bn" value={state.title_bn} onChange={(e) => set('title_bn', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tk-cat">Category *</Label>
              <select
                id="tk-cat"
                className={selectClass}
                value={state.category}
                onChange={(e) => set('category', e.target.value as ToolkitCategoryCode)}
              >
                {toolkitCategoriesFor(state.kind).map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tk-tags">Tags (comma separated)</Label>
              <Input id="tk-tags" value={state.tags} onChange={(e) => set('tags', e.target.value)} placeholder="e.g. works, supply, GPF" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tk-summary">Summary / when to use</Label>
            <textarea
              id="tk-summary"
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={state.summary}
              onChange={(e) => set('summary', e.target.value)}
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">iBAS++ areas * (who can open it, and which drawers show it)</legend>
            <AreaCheckboxes layout="wrap" value={state.areas} onChange={(areas) => set('areas', areas)} />
          </fieldset>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Governing rules & circulars (shown at the top)</p>
            <RefPicker max={20} value={state.refs} onChange={(refs) => set('refs', refs)} />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">PDF / document files</p>
            <p className="text-xs text-muted">
              Forms, circular PDFs or sample documents users can open from this {kindInfo.label.toLowerCase()}. Paste a
              Google Drive, office website or other link.
            </p>
            <AttachmentsEditor max={20} value={state.attachments} onChange={(attachments) => set('attachments', attachments)} />
          </div>
        </CardContent>
      </Card>

      {state.kind === 'checklist' && <ChecklistEditor items={state.items} onChange={(items) => set('items', items)} />}
      {state.kind === 'template' && (
        <TemplateEditor value={state.template} category={state.category} onChange={(template) => set('template', template)} />
      )}
      {state.kind === 'guide' && <GuideEditor sections={state.sections} onChange={(sections) => set('sections', sections)} />}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:pl-72">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-end gap-2">
          <span className="mr-auto text-sm text-muted">{state.is_published ? 'Currently published' : 'Draft — hidden from users'}</span>
          <Button variant="outline" disabled={saving} onClick={() => void save()}>
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
          </Button>
          {state.is_published ? (
            <Button variant="outline" disabled={saving} onClick={() => void save(false)}>
              Unpublish
            </Button>
          ) : (
            <Button disabled={saving} onClick={() => void save(true)}>
              Save & publish
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ToolkitEditorPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <Editor />
    </Suspense>
  );
}
