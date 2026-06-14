'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { HelpCircle, Plus, Search, Upload, Download } from 'lucide-react';
import { QUESTION_DIFFICULTIES } from '@ibas/shared-constants';
import { apiFetch } from '@/lib/api-client';
import { confirmDelete } from '@/lib/confirm-action';
import { fetchMe } from '@/lib/auth';
import { RowActions } from '@/components/shared/row-actions';
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
      .then((r) => setItems(r.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    loadTypes();
    fetchMe()
      .then((res) => {
        setIsAdmin(
          res.data.is_super_admin || res.data.user_type === 'system_admin' || res.data.user_type === 'admin',
        );
      })
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Question bank"
        description="MCQ, true/false, descriptive, and short-note questions linked to chapters, rules, or sub-rules."
        action={
          isAdmin ? (
            <Button asChild size="sm">
              <Link href="/questions/new">
                <Plus className="h-4 w-4" />
                New question
              </Link>
            </Button>
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
                return (
                  <div
                    key={item.id}
                    className="group flex items-center gap-3 rounded-xl border border-border bg-slate-50/50 p-4 transition-colors hover:border-primary/40 hover:bg-primary-muted/30"
                  >
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
                          <Badge variant="secondary">{item.difficulty}</Badge>
                          <Badge variant="outline">
                            {item.marks} mark{item.marks !== 1 ? 's' : ''}
                          </Badge>
                          {item.option_count > 0 && (
                            <Badge variant="outline">{item.option_count} options</Badge>
                          )}
                          <Badge variant={item.is_published ? 'default' : 'outline'}>
                            {item.is_published ? 'Published' : 'Draft'}
                          </Badge>
                        </div>
                      </div>
                    </Link>
                    {isAdmin && (
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
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
