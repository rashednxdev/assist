'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { HelpCircle, Pencil, Plus, Search, Trash2, Upload, Download } from 'lucide-react';
import { QUESTION_DIFFICULTIES } from '@ibas/shared-constants';
import { apiFetch } from '@/lib/api-client';
import { confirmDelete, confirmBatchTrash } from '@/lib/confirm-action';
import { fetchMe } from '@/lib/auth';
import { isPlatformAdmin } from '@/lib/capabilities';
import { RowActions } from '@/components/shared/row-actions';
import { QuestionEditModal } from '@/components/questions/question-edit-modal';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/shared/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

interface QuestionType {
  id: string;
  code: string;
  name: string;
  has_options: boolean;
  note?: string;
  question_count: number;
}

interface QuestionItem {
  id: string;
  question_type_code: string;
  question_type_name?: string;
  body_en: string;
  difficulty: string;
  marks: number;
  time_seconds: number;
  is_published: boolean;
  book_chapter_id?: string;
  book_topic_id?: string;
  book_sub_topic_id?: string;
  book_link_count?: number;
  option_count: number;
  updated_at: string;
}

function linkBadge(item: QuestionItem) {
  if ((item.book_link_count ?? 0) > 1) return `${item.book_link_count} links`;
  if (item.book_sub_topic_id) return 'Sub-rule';
  if (item.book_topic_id) return 'Rule';
  if (item.book_chapter_id) return 'Chapter';
  return null;
}

export default function QuestionsPage() {
  const [items, setItems] = useState<QuestionItem[]>([]);
  const [types, setTypes] = useState<QuestionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [q, setQ] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [published, setPublished] = useState('');
  const [typeCode, setTypeCode] = useState('');
  const [typeMsg, setTypeMsg] = useState('');
  const [typeErr, setTypeErr] = useState('');
  const [typeBusy, setTypeBusy] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [listMsg, setListMsg] = useState('');
  const [listErr, setListErr] = useState('');
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [typeForm, setTypeForm] = useState({ name: '', code: '', has_options: true, note: '' });
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [trashingId, setTrashingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchBusy, setBatchBusy] = useState(false);

  const loadTypes = () =>
    apiFetch<{ data: QuestionType[] }>('/questions/types').then((r) => setTypes(r.data));

  function load(search?: string, diff?: string, pub?: string, code?: string) {
    setLoading(true);
    const params = new URLSearchParams();
    if (search?.trim()) params.set('q', search.trim());
    if (diff) params.set('difficulty', diff);
    if (pub === 'true' || pub === 'false') params.set('is_published', pub);
    if (code) params.set('question_type_code', code);
    const qs = params.toString() ? `?${params.toString()}` : '';
    apiFetch<{ data: QuestionItem[] }>(`/questions${qs}`)
      .then((r) => {
        setItems(r.data);
        setSelectedIds([]);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    loadTypes();
    fetchMe()
      .then((res) => setIsAdmin(isPlatformAdmin(res.data)))
      .catch(() => {});
  }, []);

  async function saveQuestionType(e: React.FormEvent) {
    e.preventDefault();
    setTypeErr('');
    setTypeMsg('');
    const code = typeForm.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (!typeForm.name.trim() || !code) {
      setTypeErr('Name and code are required');
      return;
    }
    const payload = {
      name: typeForm.name.trim(),
      code,
      has_options: typeForm.has_options,
      note: typeForm.note.trim() || undefined,
    };
    setTypeBusy(true);
    try {
      const res = editingTypeId
        ? await apiFetch<{ data: QuestionType }>(`/questions/types/${editingTypeId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : await apiFetch<{ data: QuestionType }>('/questions/types', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
      setTypeMsg(editingTypeId ? `Type "${res.data.name}" updated` : `Type "${res.data.name}" added`);
      setTypeForm({ name: '', code: '', has_options: true, note: '' });
      setEditingTypeId(null);
      await loadTypes();
    } catch (err) {
      setTypeErr(err instanceof Error ? err.message : 'Failed to save type');
    } finally {
      setTypeBusy(false);
    }
  }

  function startEditType(t: QuestionType) {
    setEditingTypeId(t.id);
    setTypeForm({
      name: t.name,
      code: t.code,
      has_options: t.has_options,
      note: t.note ?? '',
    });
    setTypeErr('');
    setTypeMsg('');
  }

  async function removeQuestionType(t: QuestionType) {
    if (t.question_count > 0) {
      setTypeErr(`Cannot delete "${t.name}" — ${t.question_count} question(s) use this type`);
      return;
    }
    if (!confirmDelete(t.name)) return;
    setTypeBusy(true);
    setTypeErr('');
    try {
      await apiFetch(`/questions/types/${t.id}`, { method: 'DELETE' });
      setTypeMsg('Question type removed');
      if (editingTypeId === t.id) {
        setEditingTypeId(null);
        setTypeForm({ name: '', code: '', has_options: true, note: '' });
      }
      await loadTypes();
    } catch (err) {
      setTypeErr(err instanceof Error ? err.message : 'Failed to remove type');
    } finally {
      setTypeBusy(false);
    }
  }

  async function togglePublish(item: QuestionItem, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setListErr('');
    setListMsg('');
    setPublishingId(item.id);
    try {
      const path = item.is_published ? `/questions/${item.id}/unpublish` : `/questions/${item.id}/publish`;
      await apiFetch(path, { method: 'POST' });
      setItems((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, is_published: !q.is_published } : q)),
      );
      setListMsg(item.is_published ? 'Question unpublished' : 'Question published');
    } catch (err) {
      setListErr(err instanceof Error ? err.message : 'Publish action failed');
    } finally {
      setPublishingId(null);
    }
  }

  function openEditModal(item: QuestionItem, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setEditingQuestionId(item.id);
  }

  async function moveToTrash(item: QuestionItem, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const label = item.body_en.slice(0, 60) + (item.body_en.length > 60 ? '…' : '');
    if (!confirmDelete(label)) return;
    setListErr('');
    setListMsg('');
    setTrashingId(item.id);
    try {
      await apiFetch(`/questions/${item.id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((q) => q.id !== item.id));
      setSelectedIds((prev) => prev.filter((id) => id !== item.id));
      setListMsg('Question moved to trash (inactive & unpublished)');
      load(q, difficulty, published, typeCode);
    } catch (err) {
      setListErr(err instanceof Error ? err.message : 'Failed to move to trash');
    } finally {
      setTrashingId(null);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((item) => item.id));
    }
  }

  async function batchMoveToTrash() {
    if (selectedIds.length === 0) return;
    if (!confirmBatchTrash(selectedIds.length)) return;
    setListErr('');
    setListMsg('');
    setBatchBusy(true);
    try {
      const res = await apiFetch<{ data: { trashed: number; failed: number } }>(
        '/questions/batch-trash',
        {
          method: 'POST',
          body: JSON.stringify({ ids: selectedIds }),
        },
      );
      const { trashed, failed } = res.data;
      setListMsg(
        failed > 0
          ? `Moved ${trashed} to trash; ${failed} failed`
          : `Moved ${trashed} question${trashed === 1 ? '' : 's'} to trash`,
      );
      if (failed > 0) setListErr(`${failed} question(s) could not be moved to trash`);
      setSelectedIds([]);
      load(q, difficulty, published, typeCode);
    } catch (err) {
      setListErr(err instanceof Error ? err.message : 'Batch trash failed');
    } finally {
      setBatchBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Question bank"
        description="MCQ, true/false, descriptive, and short-note questions linked to chapters, rules, or sub-rules."
        action={
          isAdmin ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/questions/trash">
                  <Trash2 className="h-4 w-4" />
                  Trash
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/questions/new">
                  <Plus className="h-4 w-4" />
                  New question
                </Link>
              </Button>
            </div>
          ) : undefined
        }
      />

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Question types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {typeMsg && <Alert variant="success">{typeMsg}</Alert>}
            {typeErr && <Alert variant="error">{typeErr}</Alert>}
            <form className="space-y-3" onSubmit={saveQuestionType}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Input
                  placeholder="Display name"
                  value={typeForm.name}
                  onChange={(e) => setTypeForm((f) => ({ ...f, name: e.target.value }))}
                  disabled={typeBusy}
                  required
                />
                <Input
                  placeholder="CODE e.g. FILL_BLANK"
                  value={typeForm.code}
                  onChange={(e) => setTypeForm((f) => ({ ...f, code: e.target.value }))}
                  disabled={typeBusy}
                  required
                />
                <Input
                  placeholder="Note (optional)"
                  value={typeForm.note}
                  onChange={(e) => setTypeForm((f) => ({ ...f, note: e.target.value }))}
                  disabled={typeBusy}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={typeForm.has_options}
                    disabled={typeBusy}
                    onChange={(e) => setTypeForm((f) => ({ ...f, has_options: e.target.checked }))}
                  />
                  Has options
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" disabled={typeBusy}>
                  {editingTypeId ? 'Save type' : 'Add type'}
                </Button>
                {editingTypeId && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={typeBusy}
                    onClick={() => {
                      setEditingTypeId(null);
                      setTypeForm({ name: '', code: '', has_options: true, note: '' });
                    }}
                  >
                    Cancel edit
                  </Button>
                )}
              </div>
            </form>
            {types.length === 0 ? (
              <p className="text-sm text-muted">No question types yet.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {types.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-start justify-between gap-2 px-3 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">{t.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline">{t.code}</Badge>
                        {t.has_options && <Badge variant="secondary">Options</Badge>}
                        <span className="text-xs text-muted">
                          {t.question_count} question{t.question_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <RowActions
                        onEdit={() => startEditType(t)}
                        onDelete={t.question_count === 0 ? () => removeQuestionType(t) : undefined}
                        busy={typeBusy}
                      />
                      {t.question_count > 0 && (
                        <span className="text-xs text-muted">In use</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="border-b border-border pb-4">
          <div className="flex flex-col gap-4">
            <CardTitle className="text-lg">Questions</CardTitle>
            <form
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
              onSubmit={(e) => {
                e.preventDefault();
                load(q, difficulty, published, typeCode);
              }}
            >
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="q">Search</Label>
                <Input
                  id="q"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search question text..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="type">Type</Label>
                <select
                  id="type"
                  value={typeCode}
                  onChange={(e) => setTypeCode(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">All types</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.code}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="difficulty">Difficulty</Label>
                <select
                  id="difficulty"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">All</option>
                  {QUESTION_DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="published">Status</Label>
                <select
                  id="published"
                  value={published}
                  onChange={(e) => setPublished(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">All</option>
                  <option value="true">Published</option>
                  <option value="false">Draft</option>
                </select>
              </div>
              <div className="flex items-end sm:col-span-2 lg:col-span-5">
                <Button type="submit" size="sm" variant="outline">
                  <Search className="h-4 w-4" />
                  Search
                </Button>
              </div>
            </form>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {listMsg && <Alert variant="success" className="mb-4">{listMsg}</Alert>}
          {listErr && <Alert variant="error" className="mb-4">{listErr}</Alert>}
          {isAdmin && items.length > 0 && !loading && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
              <label className="flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={selectedIds.length === items.length && items.length > 0}
                  onChange={toggleSelectAll}
                />
                Select all ({selectedIds.length}/{items.length})
              </label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                disabled={selectedIds.length === 0 || batchBusy}
                onClick={() => void batchMoveToTrash()}
              >
                <Trash2 className="h-4 w-4" />
                Trash selected ({selectedIds.length})
              </Button>
            </div>
          )}
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="No questions found"
              description={
                isAdmin
                  ? 'Create a question or run pnpm seed for sample GFR questions.'
                  : 'No published questions are available yet.'
              }
            />
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const link = linkBadge(item);
                const busy = publishingId === item.id;
                const selected = selectedIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    className={`group flex items-center gap-3 rounded-xl border p-4 transition-colors ${
                      selected
                        ? 'border-primary/50 bg-primary-muted/20'
                        : 'border-border bg-slate-50/50 hover:border-primary/40 hover:bg-primary-muted/30'
                    }`}
                  >
                    {isAdmin && (
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 rounded border-input"
                        checked={selected}
                        onChange={() => toggleSelect(item.id)}
                        aria-label={`Select question ${item.body_en.slice(0, 40)}`}
                      />
                    )}
                    <Link
                      href={`/questions/${item.id}`}
                      className="flex min-w-0 flex-1 items-start gap-3"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary">
                        <HelpCircle className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-foreground group-hover:text-primary">{item.body_en}</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge variant="outline">{item.question_type_name ?? item.question_type_code}</Badge>
                          {link && <Badge variant="secondary">{link}</Badge>}
                          {isAdmin && <Badge variant="secondary">{item.difficulty}</Badge>}
                          {isAdmin && (
                            <Badge variant="outline">
                              {item.marks} mark{item.marks !== 1 ? 's' : ''}
                            </Badge>
                          )}
                          {item.option_count > 0 && (
                            <Badge variant="outline">{item.option_count} options</Badge>
                          )}
                          {isAdmin && (
                            <Badge variant={item.is_published ? 'default' : 'outline'}>
                              {item.is_published ? 'Published' : 'Draft'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Link>
                    {isAdmin && (
                      <div className="flex shrink-0 flex-wrap gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={(e) => openEditModal(item, e)}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          disabled={busy}
                          onClick={(e) => togglePublish(item, e)}
                        >
                          {item.is_published ? (
                            <>
                              <Download className="h-4 w-4" />
                              Unpublish
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4" />
                              Publish
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                          disabled={trashingId === item.id || batchBusy}
                          onClick={(e) => void moveToTrash(item, e)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Trash
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <QuestionEditModal
        open={!!editingQuestionId}
        questionId={editingQuestionId}
        onClose={() => setEditingQuestionId(null)}
        onSaved={() => load(q, difficulty, published, typeCode)}
      />
    </div>
  );
}
