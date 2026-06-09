'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import { QUESTION_LINK_LEVELS, type QuestionLinkLevel } from '@ibas/shared-constants';
import { apiFetch } from '@/lib/api-client';
import { bookContentHref } from '@/lib/book-links';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export interface QuestionBookLinkForm {
  id?: string;
  link_level: QuestionLinkLevel | '';
  book_id: string;
  book_chapter_id: string;
  book_topic_id: string;
  book_sub_topic_id: string;
  regulation_id: string;
  label?: string;
}

export const emptyBookLinkForm = (): QuestionBookLinkForm => ({
  link_level: '',
  book_id: '',
  book_chapter_id: '',
  book_topic_id: '',
  book_sub_topic_id: '',
  regulation_id: '',
});

interface BookItem {
  id: string;
  name: string;
  short_name: string;
}

interface ChapterItem {
  id: string;
  name: string;
  chapter_number?: string;
}

interface TopicItem {
  id: string;
  name: string;
  rule_number?: string;
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

interface QuestionBookLinksEditorProps {
  links: QuestionBookLinkForm[];
  onChange: (links: QuestionBookLinkForm[]) => void;
  /** When editing an existing question, new links can be saved immediately. */
  questionId?: string;
  onRemoteChange?: () => void;
  disabled?: boolean;
}

function canAddLink(draft: QuestionBookLinkForm): boolean {
  if (!draft.link_level || !draft.book_chapter_id) return false;
  if (draft.link_level === 'rule' && !draft.book_topic_id) return false;
  if (draft.link_level === 'sub_rule' && (!draft.book_topic_id || !draft.book_sub_topic_id)) return false;
  return true;
}

function buildDraftLabel(
  draft: QuestionBookLinkForm,
  books: BookItem[],
  chapters: ChapterItem[],
  topics: TopicItem[],
  subTopics: SubTopicItem[],
): string {
  const parts: string[] = [];
  const book = books.find((b) => b.id === draft.book_id);
  const chapter = chapters.find((c) => c.id === draft.book_chapter_id);
  const topic = topics.find((t) => t.id === draft.book_topic_id);
  const sub = subTopics.find((s) => s.id === draft.book_sub_topic_id);
  if (book) parts.push(book.short_name || book.name);
  if (chapter) parts.push(`Ch. ${chapter.chapter_number ?? ''} ${chapter.name}`.trim());
  if (topic) parts.push(topic.rule_number ? `Rule ${topic.rule_number}` : topic.name);
  if (sub) parts.push(sub.rule_number || sub.name || 'Sub-rule');
  return parts.join(' › ');
}

export function QuestionBookLinksEditor({
  links,
  onChange,
  questionId,
  onRemoteChange,
  disabled,
}: QuestionBookLinksEditorProps) {
  const [books, setBooks] = useState<BookItem[]>([]);
  const [draft, setDraft] = useState<QuestionBookLinkForm>(emptyBookLinkForm);
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [subTopics, setSubTopics] = useState<SubTopicItem[]>([]);
  const [regulations, setRegulations] = useState<RegulationItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ data: BookItem[] }>('/books').then((r) => setBooks(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!draft.book_id) {
      setChapters([]);
      return;
    }
    apiFetch<{ data: ChapterItem[] }>(`/books/${draft.book_id}/chapters`)
      .then((r) => setChapters(r.data))
      .catch(() => setChapters([]));
  }, [draft.book_id]);

  useEffect(() => {
    if (!draft.book_chapter_id) {
      setTopics([]);
      return;
    }
    apiFetch<{ data: { topics: TopicItem[] } }>(`/books/chapters/${draft.book_chapter_id}`)
      .then((r) => setTopics(r.data.topics ?? []))
      .catch(() => setTopics([]));
  }, [draft.book_chapter_id]);

  useEffect(() => {
    if (!draft.book_topic_id) {
      setSubTopics([]);
      return;
    }
    apiFetch<{ data: { sub_topics: SubTopicItem[] } }>(`/books/topics/${draft.book_topic_id}`)
      .then((r) => setSubTopics(r.data.sub_topics ?? []))
      .catch(() => setSubTopics([]));
  }, [draft.book_topic_id]);

  useEffect(() => {
    if (!draft.book_topic_id) {
      setRegulations([]);
      return;
    }
    apiFetch<{ data: { regulations: RegulationItem[] } }>(`/books/topics/${draft.book_topic_id}`)
      .then((r) => setRegulations(r.data.regulations ?? []))
      .catch(() => setRegulations([]));
  }, [draft.book_topic_id]);

  function removeLocalLink(index: number) {
    onChange(links.filter((_, i) => i !== index));
  }

  async function addLink() {
    setError('');
    if (!canAddLink(draft)) {
      setError('Complete the book link fields before adding');
      return;
    }

    const payload = {
      link_level: draft.link_level as QuestionLinkLevel,
      book_chapter_id: draft.book_chapter_id,
      book_topic_id: draft.book_topic_id || undefined,
      book_sub_topic_id: draft.book_sub_topic_id || undefined,
      regulation_id: draft.regulation_id || undefined,
    };

    setBusy(true);
    try {
      if (questionId) {
        const res = await apiFetch<{ data: QuestionBookLinkForm & { label: string } }>(
          `/questions/${questionId}/book-links`,
          { method: 'POST', body: JSON.stringify(payload) },
        );
        onChange([...links, { ...draft, id: res.data.id, label: res.data.label }]);
        onRemoteChange?.();
      } else {
        onChange([
          ...links,
          { ...draft, label: buildDraftLabel(draft, books, chapters, topics, subTopics) },
        ]);
      }
      setDraft(emptyBookLinkForm());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add book link');
    } finally {
      setBusy(false);
    }
  }

  async function removeLink(index: number, link: QuestionBookLinkForm) {
    setError('');
    if (questionId && link.id) {
      setBusy(true);
      try {
        await apiFetch(`/questions/${questionId}/book-links/${link.id}`, { method: 'DELETE' });
        removeLocalLink(index);
        onRemoteChange?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove book link');
      } finally {
        setBusy(false);
      }
      return;
    }
    removeLocalLink(index);
  }

  return (
    <div className="space-y-4">
      {links.length > 0 && (
        <ul className="space-y-2">
          {links.map((link, index) => {
            const href = bookContentHref({
              book_info_id: link.book_id,
              book_chapter_id: link.book_chapter_id,
              book_topic_id: link.book_topic_id,
              regulation_id: link.regulation_id,
            });
            return (
              <li
                key={link.id ?? `${link.book_chapter_id}-${index}`}
                className="flex items-start justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">{link.label || 'Book link'}</p>
                  <p className="text-xs text-muted">
                    {link.link_level === 'chapter'
                      ? 'Chapter'
                      : link.link_level === 'rule'
                        ? 'Rule / topic'
                        : 'Sub-rule'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {href && (
                    <Button asChild type="button" size="sm" variant="ghost" className="h-8 px-2">
                      <Link href={href} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span className="sr-only">Open in books</span>
                      </Link>
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                    disabled={disabled || busy}
                    onClick={() => removeLink(index, link)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="sr-only">Remove link</span>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-lg border border-dashed border-border p-4">
        <p className="mb-3 text-sm font-medium">Add book link</p>
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Link level</Label>
            <select
              value={draft.link_level}
              disabled={disabled || busy}
              onChange={(e) =>
                setDraft({
                  ...emptyBookLinkForm(),
                  link_level: e.target.value as QuestionLinkLevel | '',
                })
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">— Select level —</option>
              {QUESTION_LINK_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l === 'chapter' ? 'Chapter' : l === 'rule' ? 'Rule / topic' : 'Sub-rule'}
                </option>
              ))}
            </select>
          </div>

          {draft.link_level && (
            <>
              <div className="space-y-1.5">
                <Label>Book</Label>
                <select
                  value={draft.book_id}
                  disabled={disabled || busy}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      book_id: e.target.value,
                      book_chapter_id: '',
                      book_topic_id: '',
                      book_sub_topic_id: '',
                      regulation_id: '',
                    }))
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">— Select book —</option>
                  {books.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.short_name} — {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Chapter</Label>
                <select
                  value={draft.book_chapter_id}
                  disabled={disabled || busy || !draft.book_id}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      book_chapter_id: e.target.value,
                      book_topic_id: '',
                      book_sub_topic_id: '',
                      regulation_id: '',
                    }))
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                >
                  <option value="">— Select chapter —</option>
                  {chapters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.chapter_number ? `Ch. ${c.chapter_number}` : ''} {c.name}
                    </option>
                  ))}
                </select>
              </div>
              {(draft.link_level === 'rule' || draft.link_level === 'sub_rule') && (
                <div className="space-y-1.5">
                  <Label>Rule / topic</Label>
                  <select
                    value={draft.book_topic_id}
                    disabled={disabled || busy || !draft.book_chapter_id}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        book_topic_id: e.target.value,
                        book_sub_topic_id: '',
                        regulation_id: '',
                      }))
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                  >
                    <option value="">— Select rule —</option>
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.rule_number ? `Rule ${t.rule_number}` : ''} — {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {draft.link_level === 'sub_rule' && (
                <div className="space-y-1.5">
                  <Label>Sub-rule</Label>
                  <select
                    value={draft.book_sub_topic_id}
                    disabled={disabled || busy || !draft.book_topic_id}
                    onChange={(e) => setDraft((d) => ({ ...d, book_sub_topic_id: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                  >
                    <option value="">— Select sub-rule —</option>
                    {subTopics.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.rule_number ? `${st.rule_number}` : ''} — {st.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {draft.link_level !== 'chapter' && draft.book_topic_id && (
                <div className="space-y-1.5">
                  <Label>Regulation (optional)</Label>
                  <select
                    value={draft.regulation_id}
                    disabled={disabled || busy}
                    onChange={(e) => setDraft((d) => ({ ...d, regulation_id: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
            </>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          className="mt-3"
          variant="outline"
          disabled={disabled || busy || !canAddLink(draft)}
          onClick={addLink}
        >
          <Plus className="h-4 w-4" />
          Add this book link
        </Button>
      </div>
    </div>
  );
}
