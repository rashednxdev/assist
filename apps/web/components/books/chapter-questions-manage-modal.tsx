'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Plus, Search, Upload, X } from 'lucide-react';
import { QUESTION_LINK_LEVELS, type QuestionLinkLevel } from '@ibas/shared-constants';
import { apiFetch } from '@/lib/api-client';
import { chapterHeading } from '@/lib/book-display';
import { buildNewQuestionHref } from '@/lib/question-book-context';
import type { ReaderChapter } from '@/components/books/book-reader-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

interface ManageQuestionRow {
  link_id: string;
  question_id: string;
  link_level: QuestionLinkLevel;
  link_label: string;
  book_topic_id?: string;
  book_sub_topic_id?: string;
  regulation_id?: string;
  body_en: string;
  marks: number;
  question_type_code: string;
  is_published: boolean;
}

interface SearchQuestion {
  id: string;
  body_en: string;
  question_type_code: string;
  marks: number;
  is_published: boolean;
}

interface SubTopicItem {
  id: string;
  name: string;
  rule_number?: string;
}

interface RegulationItem {
  id: string;
  regulation_no: string;
  title: string;
}

type FilterMode = 'all' | 'draft' | 'published';

function truncate(text: string, len = 90) {
  const plain = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return plain.length > len ? `${plain.slice(0, len)}…` : plain;
}

function linkLevelLabel(level: QuestionLinkLevel) {
  if (level === 'chapter') return 'Chapter';
  if (level === 'rule') return 'Rule';
  return 'Sub-rule';
}

export function ChapterQuestionsManageModal({
  open,
  onOpenChange,
  bookId,
  chapter,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string;
  chapter: ReaderChapter;
}) {
  const [rows, setRows] = useState<ManageQuestionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [publishBusyId, setPublishBusyId] = useState<string | null>(null);
  const [publishAllBusy, setPublishAllBusy] = useState(false);

  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<SearchQuestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

  const [linkLevel, setLinkLevel] = useState<QuestionLinkLevel | ''>('chapter');
  const [topicId, setTopicId] = useState('');
  const [subTopicId, setSubTopicId] = useState('');
  const [regulationId, setRegulationId] = useState('');
  const [subTopics, setSubTopics] = useState<SubTopicItem[]>([]);
  const [regulations, setRegulations] = useState<RegulationItem[]>([]);
  const [linkBusy, setLinkBusy] = useState(false);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{ data: ManageQuestionRow[] }>(
        `/books/chapters/${chapter.id}/questions/manage`,
      );
      setRows(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chapter questions');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [chapter.id]);

  useEffect(() => {
    if (!open) return;
    void loadRows();
    setSearchQ('');
    setSearchResults([]);
    setSelectedQuestionId(null);
    setLinkLevel('chapter');
    setTopicId('');
    setSubTopicId('');
    setRegulationId('');
    setFilter('all');
    setMessage('');
    setError('');
  }, [open, loadRows]);

  useEffect(() => {
    if (!open) return;
    const onFocus = () => {
      void loadRows();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [open, loadRows]);

  useEffect(() => {
    if (!open || !topicId) {
      setSubTopics([]);
      setRegulations([]);
      return;
    }
    apiFetch<{ data: { sub_topics: SubTopicItem[]; regulations: RegulationItem[] } }>(
      `/books/topics/${topicId}`,
    )
      .then((r) => {
        setSubTopics(r.data.sub_topics ?? []);
        setRegulations(r.data.regulations ?? []);
      })
      .catch(() => {
        setSubTopics([]);
        setRegulations([]);
      });
  }, [open, topicId]);

  useEffect(() => {
    if (!open) return;
    const q = searchQ.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      apiFetch<{ data: SearchQuestion[] }>(`/questions?q=${encodeURIComponent(q)}&limit=20`)
        .then((r) => setSearchResults(r.data))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [open, searchQ]);

  const stats = useMemo(() => {
    const unique = new Map<string, ManageQuestionRow>();
    for (const row of rows) {
      if (!unique.has(row.question_id)) unique.set(row.question_id, row);
    }
    const list = [...unique.values()];
    const published = list.filter((r) => r.is_published).length;
    return { total: list.length, published, drafts: list.length - published };
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (filter === 'draft') return rows.filter((r) => !r.is_published);
    if (filter === 'published') return rows.filter((r) => r.is_published);
    return rows;
  }, [rows, filter]);

  async function linkSelectedQuestion() {
    if (!selectedQuestionId || !linkLevel) return;
    if (linkLevel === 'rule' && !topicId) {
      setError('Select a rule for this link');
      return;
    }
    if (linkLevel === 'sub_rule' && (!topicId || !subTopicId)) {
      setError('Select a rule and sub-rule for this link');
      return;
    }

    setLinkBusy(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/questions/${selectedQuestionId}/book-links`, {
        method: 'POST',
        body: JSON.stringify({
          link_level: linkLevel,
          book_chapter_id: chapter.id,
          book_topic_id: topicId || undefined,
          book_sub_topic_id: subTopicId || undefined,
          regulation_id: regulationId || undefined,
        }),
      });
      setMessage('Question linked to this chapter');
      setSelectedQuestionId(null);
      setSearchQ('');
      setSearchResults([]);
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link question');
    } finally {
      setLinkBusy(false);
    }
  }

  async function unlinkRow(row: ManageQuestionRow) {
    if (!confirm('Remove this book link from the question?')) return;
    setLinkBusy(true);
    setError('');
    try {
      await apiFetch(`/questions/${row.question_id}/book-links/${row.link_id}`, { method: 'DELETE' });
      setMessage('Link removed');
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove link');
    } finally {
      setLinkBusy(false);
    }
  }

  async function togglePublishRow(row: ManageQuestionRow) {
    setPublishBusyId(row.question_id);
    setError('');
    try {
      const path = row.is_published
        ? `/questions/${row.question_id}/unpublish`
        : `/questions/${row.question_id}/publish`;
      await apiFetch(path, { method: 'POST' });
      setMessage(row.is_published ? 'Question unpublished' : 'Question published for learners');
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish action failed');
    } finally {
      setPublishBusyId(null);
    }
  }

  async function publishAllDrafts() {
    const draftIds = [...new Set(rows.filter((r) => !r.is_published).map((r) => r.question_id))];
    if (draftIds.length === 0) return;
    setPublishAllBusy(true);
    setError('');
    try {
      await Promise.all(
        draftIds.map((id) => apiFetch(`/questions/${id}/publish`, { method: 'POST' })),
      );
      setMessage(`Published ${draftIds.length} draft question${draftIds.length !== 1 ? 's' : ''}`);
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish all drafts');
    } finally {
      setPublishAllBusy(false);
    }
  }

  const newQuestionHref = buildNewQuestionHref({
    bookId,
    chapterId: chapter.id,
    linkLevel: 'chapter',
    topicId: '',
    subTopicId: '',
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Chapter questions</h2>
            <p className="mt-0.5 text-sm text-muted">{chapterHeading(chapter)}</p>
            {!loading && stats.total > 0 && (
              <p className="mt-1 text-xs text-muted">
                {stats.published} published · {stats.drafts} draft
              </p>
            )}
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {message && <Alert variant="success">{message}</Alert>}
          {error && <Alert variant="error">{error}</Alert>}

          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Tagged in this chapter</h3>
              <div className="flex flex-wrap gap-2">
                {stats.drafts > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={publishAllBusy || linkBusy}
                    onClick={() => void publishAllDrafts()}
                  >
                    <Upload className="h-4 w-4" />
                    Publish all drafts
                  </Button>
                )}
                <Button asChild size="sm">
                  <Link href={newQuestionHref}>
                    <Plus className="h-4 w-4" />
                    New question
                  </Link>
                </Button>
              </div>
            </div>

            {rows.length > 0 && (
              <div className="flex gap-1">
                {(['all', 'draft', 'published'] as const).map((mode) => (
                  <Button
                    key={mode}
                    type="button"
                    size="sm"
                    variant={filter === mode ? 'default' : 'ghost'}
                    className="h-8"
                    onClick={() => setFilter(mode)}
                  >
                    {mode === 'all' ? 'All' : mode === 'draft' ? 'Drafts' : 'Published'}
                  </Button>
                ))}
              </div>
            )}

            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : filteredRows.length === 0 ? (
              <p className="text-sm text-muted">
                {rows.length === 0
                  ? 'No questions linked yet. Create a new question or link one from the bank below.'
                  : 'No questions match this filter.'}
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {filteredRows.map((row) => (
                  <li key={row.link_id} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap gap-1.5">
                        <Badge variant="outline">{row.question_type_code}</Badge>
                        <Badge variant="secondary">{row.marks}m</Badge>
                        <Badge variant={row.is_published ? 'default' : 'warning'}>
                          {row.is_published ? 'Published' : 'Draft'}
                        </Badge>
                        <Badge variant="outline">{linkLevelLabel(row.link_level)}</Badge>
                      </div>
                      <p className="line-clamp-2">{truncate(row.body_en)}</p>
                      <p className="mt-0.5 text-xs text-muted">{row.link_label}</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 px-2"
                        disabled={publishBusyId === row.question_id || linkBusy || publishAllBusy}
                        onClick={() => void togglePublishRow(row)}
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {row.is_published ? 'Unpublish' : 'Publish'}
                      </Button>
                      <Button asChild size="sm" variant="ghost" className="h-8 px-2">
                        <Link href={`/questions/${row.question_id}`}>
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span className="sr-only">Edit question</span>
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-destructive"
                        disabled={linkBusy || publishAllBusy}
                        onClick={() => void unlinkRow(row)}
                      >
                        Remove
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3 rounded-lg border border-dashed border-border p-4">
            <h3 className="text-sm font-semibold">Link existing question</h3>
            <p className="text-xs text-muted">
              Search the question bank, then tag to this chapter, a rule, sub-rule, or regulation.
            </p>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
              <Input
                className="pl-9"
                placeholder="Search questions…"
                value={searchQ}
                disabled={linkBusy}
                onChange={(e) => setSearchQ(e.target.value)}
              />
            </div>

            {searching ? (
              <Skeleton className="h-10 w-full" />
            ) : searchResults.length > 0 ? (
              <ul className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-border">
                {searchResults.map((q) => (
                  <li key={q.id}>
                    <button
                      type="button"
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-muted/50 ${
                        selectedQuestionId === q.id ? 'bg-primary-muted' : ''
                      }`}
                      onClick={() => setSelectedQuestionId(q.id)}
                    >
                      <div className="mb-0.5 flex gap-1">
                        <Badge variant="outline" className="text-[10px]">
                          {q.question_type_code}
                        </Badge>
                        {!q.is_published && (
                          <Badge variant="warning" className="text-[10px]">
                            Draft
                          </Badge>
                        )}
                      </div>
                      <span className="line-clamp-2">{truncate(q.body_en, 70)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : searchQ.trim().length >= 2 ? (
              <p className="text-sm text-muted">No questions found.</p>
            ) : null}

            {selectedQuestionId && (
              <div className="space-y-3 border-t border-border pt-3">
                <div className="space-y-1.5">
                  <Label>Link level</Label>
                  <select
                    className="ibas-select"
                    value={linkLevel}
                    disabled={linkBusy}
                    onChange={(e) => {
                      const level = e.target.value as QuestionLinkLevel | '';
                      setLinkLevel(level);
                      setTopicId('');
                      setSubTopicId('');
                      setRegulationId('');
                    }}
                  >
                    <option value="">— Select —</option>
                    {QUESTION_LINK_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l === 'chapter' ? 'Chapter' : l === 'rule' ? 'Rule / topic' : 'Sub-rule'}
                      </option>
                    ))}
                  </select>
                </div>

                {(linkLevel === 'rule' || linkLevel === 'sub_rule') && (
                  <div className="space-y-1.5">
                    <Label>Rule</Label>
                    <select
                      className="ibas-select"
                      value={topicId}
                      disabled={linkBusy}
                      onChange={(e) => {
                        setTopicId(e.target.value);
                        setSubTopicId('');
                        setRegulationId('');
                      }}
                    >
                      <option value="">— Select rule —</option>
                      {chapter.topics.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.rule_number}
                          {t.name ? ` — ${t.name}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {linkLevel === 'sub_rule' && (
                  <div className="space-y-1.5">
                    <Label>Sub-rule</Label>
                    <select
                      className="ibas-select"
                      value={subTopicId}
                      disabled={linkBusy || !topicId}
                      onChange={(e) => setSubTopicId(e.target.value)}
                    >
                      <option value="">— Select sub-rule —</option>
                      {subTopics.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.rule_number ? `${st.rule_number}` : ''}
                          {st.name ? ` — ${st.name}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {linkLevel !== 'chapter' && topicId && (
                  <div className="space-y-1.5">
                    <Label>Regulation (optional)</Label>
                    <select
                      className="ibas-select"
                      value={regulationId}
                      disabled={linkBusy}
                      onChange={(e) => setRegulationId(e.target.value)}
                    >
                      <option value="">— Optional —</option>
                      {regulations.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.regulation_no} — {r.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <Button
                  type="button"
                  size="sm"
                  disabled={linkBusy || !linkLevel}
                  onClick={() => void linkSelectedQuestion()}
                >
                  Link to chapter
                </Button>
              </div>
            )}
          </section>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button asChild type="button" size="sm" variant="outline">
            <Link href={newQuestionHref}>
              <Plus className="h-4 w-4" />
              Add question for chapter
            </Link>
          </Button>
          <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
