'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { REGULATION_TYPES, BOOK_LANGUAGES } from '@ibas/shared-constants';
import type { ComparisonTable } from '@ibas/shared-types';
import { emptyComparisonTable, hasComparisonTableContent } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { STATIC_REF_PAGE_OPTIONS } from '@/lib/static-ref-pages';
import { ComparisonTableModal } from '@/components/questions/comparison-table-modal';

// Stable reference used only as a fallback seed for the table modal — re-creating this inline on
// every render would make the modal's initialValue prop change identity each render, which resets
// its in-progress draft (see ComparisonTableModal's effect keyed on [open, initialValue]).
const EMPTY_COMPARISON_TABLE = emptyComparisonTable(2);

interface BookDetail {
  id: string;
  name: string;
  name_bn: string;
  short_name: string;
  description: string;
  edition?: string;
  published_by?: string;
  language: string;
  tags: string[];
  book_type_id?: string;
}

interface ChapterRow {
  id: string;
  name: string;
  sub_name?: string;
  chapter_number: string;
  description?: string;
  sort_order: number;
  topic_count: number;
}

interface TopicRow {
  id: string;
  name?: string;
  sub_name?: string;
  rule_number?: string;
  description?: string;
  note?: string;
  content_link?: string;
  table?: ComparisonTable;
  sort_order: number;
  is_amended: boolean;
}

interface SubTopicRow {
  id: string;
  name?: string;
  rule_number?: string;
  description?: string;
  note?: string;
  sort_order: number;
}

interface RegulationRow {
  id: string;
  regulation_no: string;
  title: string;
  regulation_type: string;
}

function wrapHtml(text: string) {
  const t = text.trim();
  if (!t) return '';
  return t.startsWith('<') ? t : `<p>${t}</p>`;
}

function topicLabel(t: { rule_number?: string; name?: string }) {
  const no = t.rule_number?.trim();
  const title = t.name?.trim();
  if (no && title) return `${no} — ${title}`;
  return no || title || 'Rule';
}

function subTopicLabel(st: { rule_number?: string; name?: string }) {
  const no = st.rule_number?.trim();
  const title = st.name?.trim();
  if (no && title) return `${no} — ${title}`;
  return no || title || 'Sub-rule';
}

export function BookContentEditor({
  bookId,
  book,
  onRefresh,
}: {
  bookId: string;
  book: BookDetail;
  onRefresh: () => void;
}) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [bookForm, setBookForm] = useState({
    name: book.name,
    name_bn: book.name_bn,
    short_name: book.short_name,
    description: book.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    edition: book.edition ?? '',
    published_by: book.published_by ?? '',
    language: book.language as (typeof BOOK_LANGUAGES)[number],
    tags: book.tags.join(', '),
  });

  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [topicsByChapter, setTopicsByChapter] = useState<Record<string, TopicRow[]>>({});
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [subTopicsByTopic, setSubTopicsByTopic] = useState<Record<string, SubTopicRow[]>>({});
  const [regulations, setRegulations] = useState<RegulationRow[]>([]);

  const topics = selectedChapterId ? (topicsByChapter[selectedChapterId] ?? []) : [];
  const subTopics = selectedTopicId ? (subTopicsByTopic[selectedTopicId] ?? []) : [];

  const [chapterForm, setChapterForm] = useState({ name: '', chapter_number: '', sub_name: '', description: '' });
  const [editChapterId, setEditChapterId] = useState<string | null>(null);
  const [editChapterForm, setEditChapterForm] = useState(chapterForm);

  const [topicForm, setTopicForm] = useState({
    name: '',
    rule_number: '',
    sub_name: '',
    description: '',
    note: '',
    content_link: '',
  });
  const [topicTable, setTopicTable] = useState<ComparisonTable | undefined>(undefined);
  const [editTopicId, setEditTopicId] = useState<string | null>(null);
  const [editTopicForm, setEditTopicForm] = useState(topicForm);

  const [addTableModalOpen, setAddTableModalOpen] = useState(false);
  const [listTableTopicId, setListTableTopicId] = useState<string | null>(null);

  const [subForm, setSubForm] = useState({ name: '', rule_number: '', description: '', note: '' });
  const [editSubId, setEditSubId] = useState<string | null>(null);
  const [editSubForm, setEditSubForm] = useState(subForm);

  const [regForm, setRegForm] = useState({
    regulation_no: '',
    title: '',
    full_text: '',
    regulation_type: 'rule' as (typeof REGULATION_TYPES)[number],
    applicable_to: 'all',
  });

  const loadedChapterTopicsRef = useRef(new Set<string>());
  const loadedTopicSubsRef = useRef(new Set<string>());

  const loadChapters = useCallback(() => {
    return apiFetch<{ data: ChapterRow[] }>(`/books/${bookId}/chapters`).then((r) => setChapters(r.data));
  }, [bookId]);

  const ensureChapterTopics = useCallback(async (chapterId: string) => {
    if (loadedChapterTopicsRef.current.has(chapterId)) return;
    const r = await apiFetch<{ data: { topics: TopicRow[] } }>(`/books/chapters/${chapterId}`);
    loadedChapterTopicsRef.current.add(chapterId);
    setTopicsByChapter((prev) => ({ ...prev, [chapterId]: r.data.topics }));
  }, []);

  const ensureTopicSubTopics = useCallback(async (topicId: string) => {
    if (loadedTopicSubsRef.current.has(topicId)) return;
    const r = await apiFetch<{ data: { sub_topics: SubTopicRow[] } }>(`/books/topics/${topicId}`);
    loadedTopicSubsRef.current.add(topicId);
    setSubTopicsByTopic((prev) => ({ ...prev, [topicId]: r.data.sub_topics }));
  }, []);

  const loadRegulations = useCallback(() => {
    return apiFetch<{ data: RegulationRow[] }>(`/books/${bookId}/regulations`).then((r) => setRegulations(r.data));
  }, [bookId]);

  useEffect(() => {
    loadChapters();
    loadRegulations();
  }, [loadChapters, loadRegulations]);

  useEffect(() => {
    if (selectedChapterId) void ensureChapterTopics(selectedChapterId);
  }, [selectedChapterId, ensureChapterTopics]);

  useEffect(() => {
    if (selectedTopicId) void ensureTopicSubTopics(selectedTopicId);
  }, [selectedTopicId, ensureTopicSubTopics]);

  useEffect(() => {
    if (!selectedTopicId) return;
    const topic = topics.find((t) => t.id === selectedTopicId);
    if (!topic) return;
    const suggestedNo = `${book.short_name || 'BOOK'}-${topic.rule_number}`.replace(/\s+/g, '');
    setRegForm((prev) => ({
      ...prev,
      regulation_no: prev.regulation_no || suggestedNo,
      title: prev.title || topic.name || '',
      full_text:
        prev.full_text ||
        (topic.description ? topic.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : ''),
    }));
  }, [selectedTopicId, topics, book.short_name]);

  function clearFeedback() {
    setMessage('');
    setError('');
  }

  async function saveBook() {
    clearFeedback();
    setBusy(true);
    try {
      await apiFetch(`/books/${bookId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: bookForm.name.trim(),
          name_bn: bookForm.name_bn.trim(),
          short_name: bookForm.short_name.trim().toUpperCase() || undefined,
          description: bookForm.description.trim() ? wrapHtml(bookForm.description) : undefined,
          edition: bookForm.edition.trim() || undefined,
          published_by: bookForm.published_by.trim() || undefined,
          language: bookForm.language,
          tags: bookForm.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      setMessage('Book updated');
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update book');
    } finally {
      setBusy(false);
    }
  }

  async function addChapter() {
    if (!chapterForm.name.trim() || !chapterForm.chapter_number.trim()) return;
    clearFeedback();
    setBusy(true);
    try {
      const res = await apiFetch<{ data: Omit<ChapterRow, 'topic_count'> }>(`/books/${bookId}/chapters`, {
        method: 'POST',
        body: JSON.stringify({
          name: chapterForm.name.trim(),
          chapter_number: chapterForm.chapter_number.trim(),
          sub_name: chapterForm.sub_name.trim() || undefined,
          description: chapterForm.description.trim() ? wrapHtml(chapterForm.description) : undefined,
        }),
      });
      const created: ChapterRow = { ...res.data, topic_count: 0 };
      setChapters((prev) => [...prev, created]);
      setTopicsByChapter((prev) => ({ ...prev, [created.id]: [] }));
      loadedChapterTopicsRef.current.add(created.id);
      setChapterForm({ name: '', chapter_number: '', sub_name: '', description: '' });
      setMessage('Chapter added');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add chapter');
    } finally {
      setBusy(false);
    }
  }

  async function saveChapterEdit() {
    if (!editChapterId) return;
    clearFeedback();
    setBusy(true);
    try {
      const res = await apiFetch<{ data: Omit<ChapterRow, 'topic_count'> }>(`/books/chapters/${editChapterId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editChapterForm.name.trim(),
          chapter_number: editChapterForm.chapter_number.trim(),
          sub_name: editChapterForm.sub_name.trim() || undefined,
          description: editChapterForm.description.trim() ? wrapHtml(editChapterForm.description) : undefined,
        }),
      });
      setChapters((prev) =>
        prev.map((c) =>
          c.id === editChapterId
            ? {
                ...c,
                name: res.data.name,
                chapter_number: res.data.chapter_number,
                sub_name: res.data.sub_name,
                description: res.data.description,
              }
            : c,
        ),
      );
      setEditChapterId(null);
      setMessage('Chapter updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update chapter');
    } finally {
      setBusy(false);
    }
  }

  async function removeChapter(id: string) {
    if (!confirm('Remove this chapter and all its rules?')) return;
    clearFeedback();
    setBusy(true);
    try {
      await apiFetch(`/books/chapters/${id}`, { method: 'DELETE' });
      if (selectedChapterId === id) {
        setSelectedChapterId(null);
        setSelectedTopicId(null);
      }
      setChapters((prev) => prev.filter((c) => c.id !== id));
      setTopicsByChapter((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      loadedChapterTopicsRef.current.delete(id);
      setMessage('Chapter removed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove chapter');
    } finally {
      setBusy(false);
    }
  }

  async function addTopic() {
    if (
      !selectedChapterId ||
      (!topicForm.rule_number.trim() && !topicForm.name.trim() && !topicForm.description.trim())
    )
      return;
    clearFeedback();
    setBusy(true);
    try {
      const res = await apiFetch<{
        data: { id: string; name: string; rule_number?: string; sort_order: number; table?: ComparisonTable };
      }>(`/books/chapters/${selectedChapterId}/topics`, {
        method: 'POST',
        body: JSON.stringify({
          name: topicForm.name.trim() || undefined,
          rule_number: topicForm.rule_number.trim() || undefined,
          sub_name: topicForm.sub_name.trim() || undefined,
          description: topicForm.description.trim() ? wrapHtml(topicForm.description) : undefined,
          note: topicForm.note.trim() || undefined,
          content_link: topicForm.content_link.trim() || undefined,
          table: topicTable,
        }),
      });
      const created: TopicRow = {
        id: res.data.id,
        name: res.data.name,
        rule_number: res.data.rule_number,
        sub_name: topicForm.sub_name.trim() || undefined,
        description: topicForm.description.trim() ? wrapHtml(topicForm.description) : undefined,
        note: topicForm.note.trim() || undefined,
        content_link: topicForm.content_link.trim() || undefined,
        table: res.data.table,
        sort_order: res.data.sort_order,
        is_amended: false,
      };
      setTopicsByChapter((prev) => ({
        ...prev,
        [selectedChapterId]: [...(prev[selectedChapterId] ?? []), created],
      }));
      loadedChapterTopicsRef.current.add(selectedChapterId);
      setChapters((prev) =>
        prev.map((c) => (c.id === selectedChapterId ? { ...c, topic_count: c.topic_count + 1 } : c)),
      );
      setTopicForm({ name: '', rule_number: '', sub_name: '', description: '', note: '', content_link: '' });
      setTopicTable(undefined);
      setMessage('Rule / topic added');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add topic');
    } finally {
      setBusy(false);
    }
  }

  async function saveTopicEdit() {
    if (!editTopicId || !selectedChapterId) return;
    clearFeedback();
    setBusy(true);
    try {
      const res = await apiFetch<{
        data: { id: string; name: string; rule_number?: string; sort_order: number; table?: ComparisonTable };
      }>(`/books/topics/${editTopicId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editTopicForm.name.trim(),
          rule_number: editTopicForm.rule_number.trim() || undefined,
          sub_name: editTopicForm.sub_name.trim() || undefined,
          description: editTopicForm.description.trim() ? wrapHtml(editTopicForm.description) : undefined,
          note: editTopicForm.note.trim() || undefined,
          content_link: editTopicForm.content_link.trim(),
        }),
      });
      setTopicsByChapter((prev) => ({
        ...prev,
        [selectedChapterId]: (prev[selectedChapterId] ?? []).map((t) =>
          t.id === editTopicId
            ? {
                ...t,
                name: res.data.name,
                rule_number: res.data.rule_number,
                sub_name: editTopicForm.sub_name.trim() || undefined,
                description: editTopicForm.description.trim() ? wrapHtml(editTopicForm.description) : undefined,
                note: editTopicForm.note.trim() || undefined,
                content_link: editTopicForm.content_link.trim() || undefined,
                table: res.data.table,
                sort_order: res.data.sort_order,
              }
            : t,
        ),
      }));
      setEditTopicId(null);
      setMessage('Rule updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update topic');
    } finally {
      setBusy(false);
    }
  }

  async function saveListTopicTable(topicId: string, table: ComparisonTable) {
    if (!selectedChapterId) return;
    clearFeedback();
    setBusy(true);
    try {
      const res = await apiFetch<{ data: { table?: ComparisonTable } }>(`/books/topics/${topicId}`, {
        method: 'PATCH',
        body: JSON.stringify({ table }),
      });
      setTopicsByChapter((prev) => ({
        ...prev,
        [selectedChapterId]: (prev[selectedChapterId] ?? []).map((t) =>
          t.id === topicId ? { ...t, table: res.data.table } : t,
        ),
      }));
      setListTableTopicId(null);
      setMessage('Table saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save table');
    } finally {
      setBusy(false);
    }
  }

  async function removeListTopicTable(topicId: string) {
    if (!selectedChapterId) return;
    if (!confirm('Remove this table?')) return;
    clearFeedback();
    setBusy(true);
    try {
      await apiFetch(`/books/topics/${topicId}`, {
        method: 'PATCH',
        body: JSON.stringify({ table: null }),
      });
      setTopicsByChapter((prev) => ({
        ...prev,
        [selectedChapterId]: (prev[selectedChapterId] ?? []).map((t) =>
          t.id === topicId ? { ...t, table: undefined } : t,
        ),
      }));
      setMessage('Table removed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove table');
    } finally {
      setBusy(false);
    }
  }

  async function removeTopic(id: string) {
    if (!confirm('Remove this rule and its sub-rules?')) return;
    clearFeedback();
    setBusy(true);
    try {
      await apiFetch(`/books/topics/${id}`, { method: 'DELETE' });
      if (selectedTopicId === id) setSelectedTopicId(null);
      if (selectedChapterId) {
        setTopicsByChapter((prev) => ({
          ...prev,
          [selectedChapterId]: (prev[selectedChapterId] ?? []).filter((t) => t.id !== id),
        }));
        setChapters((prev) =>
          prev.map((c) =>
            c.id === selectedChapterId ? { ...c, topic_count: Math.max(0, c.topic_count - 1) } : c,
          ),
        );
      }
      setSubTopicsByTopic((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      loadedTopicSubsRef.current.delete(id);
      setMessage('Rule removed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove topic');
    } finally {
      setBusy(false);
    }
  }

  async function addSubTopic() {
    if (
      !selectedTopicId ||
      (!subForm.name.trim() && !subForm.rule_number.trim() && !subForm.description.trim())
    )
      return;
    clearFeedback();
    setBusy(true);
    try {
      const res = await apiFetch<{ data: SubTopicRow }>(`/books/topics/${selectedTopicId}/sub-topics`, {
        method: 'POST',
        body: JSON.stringify({
          name: subForm.name.trim() || undefined,
          rule_number: subForm.rule_number.trim() || undefined,
          description: subForm.description.trim() ? wrapHtml(subForm.description) : undefined,
          note: subForm.note.trim() || undefined,
        }),
      });
      setSubTopicsByTopic((prev) => ({
        ...prev,
        [selectedTopicId]: [...(prev[selectedTopicId] ?? []), res.data],
      }));
      loadedTopicSubsRef.current.add(selectedTopicId);
      setSubForm({ name: '', rule_number: '', description: '', note: '' });
      setMessage('Sub-rule added');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add sub-rule');
    } finally {
      setBusy(false);
    }
  }

  async function saveSubEdit() {
    if (!editSubId || !selectedTopicId) return;
    clearFeedback();
    setBusy(true);
    try {
      const res = await apiFetch<{ data: SubTopicRow }>(`/books/sub-topics/${editSubId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editSubForm.name.trim(),
          rule_number: editSubForm.rule_number.trim() || undefined,
          description: editSubForm.description.trim() ? wrapHtml(editSubForm.description) : undefined,
          note: editSubForm.note.trim() || undefined,
        }),
      });
      setSubTopicsByTopic((prev) => ({
        ...prev,
        [selectedTopicId]: (prev[selectedTopicId] ?? []).map((st) =>
          st.id === editSubId ? res.data : st,
        ),
      }));
      setEditSubId(null);
      setMessage('Sub-rule updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update sub-rule');
    } finally {
      setBusy(false);
    }
  }

  async function removeSub(id: string) {
    if (!confirm('Remove this sub-rule?')) return;
    clearFeedback();
    setBusy(true);
    try {
      await apiFetch(`/books/sub-topics/${id}`, { method: 'DELETE' });
      if (selectedTopicId) {
        setSubTopicsByTopic((prev) => ({
          ...prev,
          [selectedTopicId]: (prev[selectedTopicId] ?? []).filter((st) => st.id !== id),
        }));
      }
      setMessage('Sub-rule removed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove sub-rule');
    } finally {
      setBusy(false);
    }
  }

  async function addRegulation(e?: React.FormEvent) {
    e?.preventDefault();
    clearFeedback();
    if (!regForm.regulation_no.trim()) {
      setError('Regulation number is required (e.g. GFR-45)');
      return;
    }
    if (!regForm.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!regForm.full_text.trim()) {
      setError('Full regulation text is required');
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch<{ data: RegulationRow }>(`/books/${bookId}/regulations`, {
        method: 'POST',
        body: JSON.stringify({
          book_chapter_id: selectedChapterId ?? undefined,
          book_topic_id: selectedTopicId ?? undefined,
          regulation_no: regForm.regulation_no.trim(),
          title: regForm.title.trim(),
          full_text: wrapHtml(regForm.full_text),
          regulation_type: regForm.regulation_type,
          effective_date: new Date().toISOString(),
          applicable_to: [regForm.applicable_to.trim() || 'all'],
          payment_related: false,
          receipt_related: false,
        }),
      });
      setRegulations((prev) => [...prev, res.data]);
      setRegForm({ regulation_no: '', title: '', full_text: '', regulation_type: 'rule', applicable_to: 'all' });
      setMessage(
        selectedTopicId
          ? 'Regulation created and linked to the selected rule'
          : selectedChapterId
            ? 'Regulation created and linked to the selected chapter'
            : 'Regulation created for this book',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add regulation');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="text-base">Edit book</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Title (English)</Label>
              <Input disabled={busy} value={bookForm.name} onChange={(e) => setBookForm({ ...bookForm, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Title (Bengali)</Label>
              <Input disabled={busy} value={bookForm.name_bn} onChange={(e) => setBookForm({ ...bookForm, name_bn: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Short code (optional)</Label>
              <Input disabled={busy} value={bookForm.short_name} onChange={(e) => setBookForm({ ...bookForm, short_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Edition</Label>
              <Input disabled={busy} value={bookForm.edition} onChange={(e) => setBookForm({ ...bookForm, edition: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Language</Label>
              <select className="ibas-select" disabled={busy} value={bookForm.language} onChange={(e) => setBookForm({ ...bookForm, language: e.target.value as typeof bookForm.language })}>
                {BOOK_LANGUAGES.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Description (optional)</Label>
            <textarea className="ibas-textarea" disabled={busy} value={bookForm.description} placeholder="Overview (optional)" onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Tags (comma-separated)</Label>
            <Input disabled={busy} value={bookForm.tags} onChange={(e) => setBookForm({ ...bookForm, tags: e.target.value })} />
          </div>
          <Button size="sm" disabled={busy} onClick={saveBook}>Save book</Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-base">Chapters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {chapters.map((c) => (
                <li key={c.id} className={`rounded-lg border px-2 py-1.5 text-sm ${selectedChapterId === c.id ? 'border-primary bg-primary-muted' : 'border-border'}`}>
                  <button type="button" className="w-full text-left" onClick={() => {
                    if (selectedChapterId !== c.id) {
                      setSelectedChapterId(c.id);
                      setSelectedTopicId(null);
                    }
                  }}>
                    <span className="font-medium">{c.chapter_number} — {c.name}</span>
                    <span className="ml-1 text-xs text-muted">({c.topic_count} rules)</span>
                  </button>
                  <div className="mt-1 flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={busy} onClick={() => {
                      setEditChapterId(c.id);
                      setEditChapterForm({
                        name: c.name,
                        chapter_number: c.chapter_number,
                        sub_name: c.sub_name ?? '',
                        description: c.description?.replace(/<[^>]+>/g, ' ').trim() ?? '',
                      });
                    }}>Edit</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" disabled={busy} onClick={() => removeChapter(c.id)}>Remove</Button>
                  </div>
                </li>
              ))}
            </ul>
            {editChapterId && (
              <div className="rounded-lg border border-dashed p-3 space-y-2">
                <p className="text-xs font-semibold text-muted">Edit chapter</p>
                <Input disabled={busy} value={editChapterForm.chapter_number} placeholder="Chapter no." onChange={(e) => setEditChapterForm({ ...editChapterForm, chapter_number: e.target.value })} />
                <Input disabled={busy} value={editChapterForm.name} placeholder="Name" onChange={(e) => setEditChapterForm({ ...editChapterForm, name: e.target.value })} />
                <textarea className="ibas-textarea text-sm" disabled={busy} value={editChapterForm.description} placeholder="Description" onChange={(e) => setEditChapterForm({ ...editChapterForm, description: e.target.value })} />
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy} onClick={saveChapterEdit}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditChapterId(null)}>Cancel</Button>
                </div>
              </div>
            )}
            <div className="rounded-lg border border-dashed p-3 space-y-2">
              <p className="text-xs font-semibold text-muted">Add chapter</p>
              <Input disabled={busy} value={chapterForm.chapter_number} placeholder="e.g. IV" onChange={(e) => setChapterForm({ ...chapterForm, chapter_number: e.target.value })} />
              <Input disabled={busy} value={chapterForm.name} placeholder="Chapter title" onChange={(e) => setChapterForm({ ...chapterForm, name: e.target.value })} />
              <textarea className="ibas-textarea text-sm" disabled={busy} value={chapterForm.description} placeholder="Description (optional)" onChange={(e) => setChapterForm({ ...chapterForm, description: e.target.value })} />
              <Button size="sm" disabled={busy} onClick={addChapter}>Add chapter</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-base">Rules / topics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {!selectedChapterId ? (
              <p className="text-sm text-muted">Select a chapter to manage rules.</p>
            ) : (
              <>
                <ul className="max-h-48 space-y-1 overflow-y-auto">
                  {topics.map((t) => (
                    <li key={t.id} className={`rounded-lg border px-2 py-1.5 text-sm ${selectedTopicId === t.id ? 'border-primary bg-primary-muted' : 'border-border'}`}>
                      <button type="button" className="w-full text-left" onClick={() => {
                        if (selectedTopicId !== t.id) setSelectedTopicId(t.id);
                      }}>
                        <span className="font-medium">{topicLabel(t)}</span>
                        {t.is_amended && <Badge variant="warning" className="ml-1">Amended</Badge>}
                        {hasComparisonTableContent(t.table) && (
                          <Badge variant="secondary" className="ml-1">
                            Table: {t.table?.rows.length} × {t.table?.columns.length}
                          </Badge>
                        )}
                      </button>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={busy} onClick={() => {
                          setEditTopicId(t.id);
                          setEditTopicForm({
                            name: t.name ?? '',
                            rule_number: t.rule_number ?? '',
                            sub_name: t.sub_name ?? '',
                            description: t.description?.replace(/<[^>]+>/g, ' ').trim() ?? '',
                            note: t.note ?? '',
                            content_link: t.content_link ?? '',
                          });
                        }}>Edit</Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          disabled={busy}
                          onClick={() => setListTableTopicId(t.id)}
                        >
                          {hasComparisonTableContent(t.table) ? 'View/edit table' : 'Add table'}
                        </Button>
                        {hasComparisonTableContent(t.table) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-destructive"
                            disabled={busy}
                            onClick={() => removeListTopicTable(t.id)}
                          >
                            Remove table
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" disabled={busy} onClick={() => removeTopic(t.id)}>Remove</Button>
                      </div>
                    </li>
                  ))}
                </ul>
                {editTopicId && (
                  <div className="rounded-lg border border-dashed p-3 space-y-2">
                    <p className="text-xs font-semibold text-muted">Edit rule</p>
                    <Input disabled={busy} value={editTopicForm.rule_number} placeholder="Rule no. (optional)" onChange={(e) => setEditTopicForm({ ...editTopicForm, rule_number: e.target.value })} />
                    <Input disabled={busy} value={editTopicForm.name} placeholder="Title (optional)" onChange={(e) => setEditTopicForm({ ...editTopicForm, name: e.target.value })} />
                    <textarea className="ibas-textarea text-sm" disabled={busy} value={editTopicForm.description} placeholder="Details (optional)" onChange={(e) => setEditTopicForm({ ...editTopicForm, description: e.target.value })} />
                    <Input disabled={busy} value={editTopicForm.note} placeholder="Note / cross-ref" onChange={(e) => setEditTopicForm({ ...editTopicForm, note: e.target.value })} />
                    <select
                      className="ibas-select text-sm"
                      disabled={busy}
                      value={
                        STATIC_REF_PAGE_OPTIONS.some((o) => o.href === editTopicForm.content_link)
                          ? editTopicForm.content_link
                          : ''
                      }
                      onChange={(e) =>
                        setEditTopicForm({
                          ...editTopicForm,
                          content_link: e.target.value || editTopicForm.content_link,
                        })
                      }
                    >
                      <option value="">Page link preset…</option>
                      {STATIC_REF_PAGE_OPTIONS.map((o) => (
                        <option key={o.href} value={o.href}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <Input
                      disabled={busy}
                      value={editTopicForm.content_link}
                      placeholder="Page link e.g. /static-ref/jsi-2016-p"
                      onChange={(e) => setEditTopicForm({ ...editTopicForm, content_link: e.target.value })}
                    />
                    <p className="border-t border-border pt-3 text-xs text-muted">
                      Comparison table is saved separately — use the &quot;View/edit table&quot; button on
                      this rule above, which saves immediately on its own.
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" disabled={busy} onClick={saveTopicEdit}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditTopicId(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
                <div className="rounded-lg border border-dashed p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted">Add rule</p>
                  <Input disabled={busy} value={topicForm.rule_number} placeholder="Rule no. e.g. 45 (optional)" onChange={(e) => setTopicForm({ ...topicForm, rule_number: e.target.value })} />
                  <Input disabled={busy} value={topicForm.name} placeholder="Title (optional)" onChange={(e) => setTopicForm({ ...topicForm, name: e.target.value })} />
                  <textarea className="ibas-textarea text-sm" disabled={busy} value={topicForm.description} placeholder="Details (fill rule no., title, or details)" onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })} />
                  <select
                    className="ibas-select text-sm"
                    disabled={busy}
                    value={
                      STATIC_REF_PAGE_OPTIONS.some((o) => o.href === topicForm.content_link)
                        ? topicForm.content_link
                        : ''
                    }
                    onChange={(e) => setTopicForm({ ...topicForm, content_link: e.target.value })}
                  >
                    <option value="">Page link (optional)…</option>
                    {STATIC_REF_PAGE_OPTIONS.map((o) => (
                      <option key={o.href} value={o.href}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    disabled={busy}
                    value={topicForm.content_link}
                    placeholder="Or custom path /static-ref/…"
                    onChange={(e) => setTopicForm({ ...topicForm, content_link: e.target.value })}
                  />
                  <div className="space-y-1.5 border-t border-border pt-3">
                    <Label className="text-xs">Comparison table (optional)</Label>
                    {topicTable ? (
                      <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-2 text-xs">
                        <span className="text-muted">
                          {topicTable.rows.length} row{topicTable.rows.length === 1 ? '' : 's'} ·{' '}
                          {topicTable.columns.length} column{topicTable.columns.length === 1 ? '' : 's'}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={busy}
                            onClick={() => setAddTableModalOpen(true)}
                          >
                            Edit table
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-destructive"
                            disabled={busy}
                            onClick={() => setTopicTable(undefined)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={busy}
                        onClick={() => {
                          setTopicTable(emptyComparisonTable(2));
                          setAddTableModalOpen(true);
                        }}
                      >
                        Add table
                      </Button>
                    )}
                  </div>
                  <Button
                    size="sm"
                    disabled={
                      busy ||
                      (!topicForm.rule_number.trim() &&
                        !topicForm.name.trim() &&
                        !topicForm.description.trim())
                    }
                    onClick={addTopic}
                  >
                    Add rule
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-base">Sub-rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {!selectedTopicId ? (
              <p className="text-sm text-muted">Select a rule to manage sub-rules.</p>
            ) : (
              <>
                <ul className="max-h-40 space-y-1 overflow-y-auto">
                  {subTopics.map((st) => (
                    <li key={st.id} className="rounded-lg border border-border px-2 py-1.5 text-sm">
                      <span className="font-medium">{subTopicLabel(st)}</span>
                      <div className="mt-1 flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={busy} onClick={() => {
                          setEditSubId(st.id);
                          setEditSubForm({
                            name: st.name ?? '',
                            rule_number: st.rule_number ?? '',
                            description: st.description?.replace(/<[^>]+>/g, ' ').trim() ?? '',
                            note: st.note ?? '',
                          });
                        }}>Edit</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" disabled={busy} onClick={() => removeSub(st.id)}>Remove</Button>
                      </div>
                    </li>
                  ))}
                </ul>
                {editSubId && (
                  <div className="rounded-lg border border-dashed p-3 space-y-2">
                    <Input disabled={busy} value={editSubForm.rule_number} placeholder="Sub-rule no." onChange={(e) => setEditSubForm({ ...editSubForm, rule_number: e.target.value })} />
                    <Input disabled={busy} value={editSubForm.name} placeholder="Title (optional)" onChange={(e) => setEditSubForm({ ...editSubForm, name: e.target.value })} />
                    <textarea className="ibas-textarea text-sm" disabled={busy} value={editSubForm.description} placeholder="Details (optional)" onChange={(e) => setEditSubForm({ ...editSubForm, description: e.target.value })} />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={busy} onClick={saveSubEdit}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditSubId(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
                <div className="rounded-lg border border-dashed p-3 space-y-2">
                  <Input disabled={busy} value={subForm.rule_number} placeholder="Sub-rule no. e.g. 45(1) (optional)" onChange={(e) => setSubForm({ ...subForm, rule_number: e.target.value })} />
                  <Input disabled={busy} value={subForm.name} placeholder="Title (optional)" onChange={(e) => setSubForm({ ...subForm, name: e.target.value })} />
                  <textarea className="ibas-textarea text-sm" disabled={busy} value={subForm.description} placeholder="Details (fill sub-rule no., title, or details)" onChange={(e) => setSubForm({ ...subForm, description: e.target.value })} />
                  <Button
                    size="sm"
                    disabled={
                      busy ||
                      (!subForm.name.trim() && !subForm.rule_number.trim() && !subForm.description.trim())
                    }
                    onClick={addSubTopic}
                  >
                    Add sub-rule
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="text-base">Regulations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {regulations.length > 0 && (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {regulations.map((r) => (
                <li key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>{r.regulation_no} — {r.title}</span>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/books/regulations/${r.id}`}>View</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="rounded-lg border border-dashed p-3 space-y-2">
            <p className="text-xs text-muted">
              Creates a searchable regulation record for this book. To <strong>link it to a rule</strong>, select a
              chapter and rule in the panels above first — fields will auto-fill from that rule.
            </p>
            {(selectedChapterId || selectedTopicId) && (
              <p className="text-xs text-primary">
                Link target:{' '}
                {selectedTopicId
                  ? `rule ${topics.find((t) => t.id === selectedTopicId)?.rule_number ?? selectedTopicId}`
                  : `chapter ${chapters.find((c) => c.id === selectedChapterId)?.chapter_number ?? selectedChapterId}`}
              </p>
            )}
            <form onSubmit={addRegulation} className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Regulation no. *</Label>
                  <Input
                    disabled={busy}
                    value={regForm.regulation_no}
                    placeholder="GFR-45"
                    onChange={(e) => setRegForm({ ...regForm, regulation_no: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <select
                    className="ibas-select"
                    disabled={busy}
                    value={regForm.regulation_type}
                    onChange={(e) =>
                      setRegForm({ ...regForm, regulation_type: e.target.value as typeof regForm.regulation_type })
                    }
                  >
                    {REGULATION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Title *</Label>
                <Input
                  disabled={busy}
                  value={regForm.title}
                  placeholder="Title"
                  onChange={(e) => setRegForm({ ...regForm, title: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Full text *</Label>
                <textarea
                  className="ibas-textarea text-sm"
                  disabled={busy}
                  value={regForm.full_text}
                  placeholder="Full regulation text"
                  onChange={(e) => setRegForm({ ...regForm, full_text: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Applicable to</Label>
                <Input
                  disabled={busy}
                  value={regForm.applicable_to}
                  placeholder="all, DDO, AO..."
                  onChange={(e) => setRegForm({ ...regForm, applicable_to: e.target.value })}
                />
              </div>
              <Button type="submit" size="sm" disabled={busy}>
                Add regulation
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      <ComparisonTableModal
        open={addTableModalOpen}
        initialValue={topicTable ?? EMPTY_COMPARISON_TABLE}
        title="Comparison table for new rule"
        onCancel={() => setAddTableModalOpen(false)}
        onSave={(table) => {
          setTopicTable(table);
          setAddTableModalOpen(false);
        }}
      />
      <ComparisonTableModal
        open={Boolean(listTableTopicId)}
        initialValue={topics.find((t) => t.id === listTableTopicId)?.table ?? EMPTY_COMPARISON_TABLE}
        title={topicLabel(topics.find((t) => t.id === listTableTopicId) ?? { rule_number: '', name: '' })}
        onCancel={() => setListTableTopicId(null)}
        onSave={(table) => {
          if (listTableTopicId) void saveListTopicTable(listTableTopicId, table);
        }}
      />
    </div>
  );
}
