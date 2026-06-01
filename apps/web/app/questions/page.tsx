'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { HelpCircle, Plus, Search } from 'lucide-react';
import { QUESTION_DIFFICULTIES } from '@ibas/shared-constants';
import { apiFetch } from '@/lib/api-client';
import { fetchMe } from '@/lib/auth';
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
  option_count: number;
  updated_at: string;
}

function linkBadge(item: QuestionItem) {
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
  const [newType, setNewType] = useState({ name: '', code: '', has_options: true, note: '' });

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
    apiFetch<{ data: QuestionType[] }>('/questions/types').then((r) => setTypes(r.data));
    fetchMe()
      .then((res) => {
        setIsAdmin(
          res.data.is_super_admin || res.data.user_type === 'system_admin' || res.data.user_type === 'admin',
        );
      })
      .catch(() => {});
  }, []);

  async function addQuestionType(e: React.FormEvent) {
    e.preventDefault();
    setTypeErr('');
    setTypeMsg('');
    try {
      await apiFetch('/questions/types', {
        method: 'POST',
        body: JSON.stringify({
          name: newType.name.trim(),
          code: newType.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
          has_options: newType.has_options,
          note: newType.note.trim() || undefined,
        }),
      });
      setTypeMsg('Question type added');
      setNewType({ name: '', code: '', has_options: true, note: '' });
      const r = await apiFetch<{ data: QuestionType[] }>('/questions/types');
      setTypes(r.data);
    } catch (err) {
      setTypeErr(err instanceof Error ? err.message : 'Failed to add type');
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
            <div className="flex flex-wrap gap-2">
              {types.map((t) => (
                <Badge key={t.id} variant="outline">
                  {t.name} ({t.code})
                </Badge>
              ))}
            </div>
            {typeMsg && <Alert variant="success">{typeMsg}</Alert>}
            {typeErr && <Alert variant="error">{typeErr}</Alert>}
            <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={addQuestionType}>
              <Input
                placeholder="Display name"
                value={newType.name}
                onChange={(e) => setNewType((f) => ({ ...f, name: e.target.value }))}
                required
              />
              <Input
                placeholder="CODE e.g. FILL_BLANK"
                value={newType.code}
                onChange={(e) => setNewType((f) => ({ ...f, code: e.target.value }))}
                required
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newType.has_options}
                  onChange={(e) => setNewType((f) => ({ ...f, has_options: e.target.checked }))}
                />
                Has options
              </label>
              <Input
                placeholder="Note (optional)"
                value={newType.note}
                onChange={(e) => setNewType((f) => ({ ...f, note: e.target.value }))}
              />
              <Button type="submit" size="sm">
                Add type
              </Button>
            </form>
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
                return (
                  <Link
                    key={item.id}
                    href={`/questions/${item.id}`}
                    className="group flex items-start gap-3 rounded-xl border border-border bg-slate-50/50 p-4 transition-colors hover:border-primary/40 hover:bg-primary-muted/30"
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
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
