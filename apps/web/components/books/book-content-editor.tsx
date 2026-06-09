'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { REGULATION_TYPES, BOOK_LANGUAGES } from '@ibas/shared-constants';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

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
  rule_number: string;
  description?: string;
  note?: string;
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

function topicLabel(t: { rule_number: string; name?: string }) {
  const title = t.name?.trim();
  return title ? `${t.rule_number} — ${title}` : t.rule_number;
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
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [subTopics, setSubTopics] = useState<SubTopicRow[]>([]);
  const [regulations, setRegulations] = useState<RegulationRow[]>([]);

  const [chapterForm, setChapterForm] = useState({ name: '', chapter_number: '', sub_name: '', description: '' });
  const [editChapterId, setEditChapterId] = useState<string | null>(null);
  const [editChapterForm, setEditChapterForm] = useState(chapterForm);

  const [topicForm, setTopicForm] = useState({ name: '', rule_number: '', sub_name: '', description: '', note: '' });
  const [editTopicId, setEditTopicId] = useState<string | null>(null);
  const [editTopicForm, setEditTopicForm] = useState(topicForm);

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

  const loadChapters = useCallback(() => {
    return apiFetch<{ data: ChapterRow[] }>(`/books/${bookId}/chapters`).then((r) => setChapters(r.data));
  }, [bookId]);

  const loadChapterTopics = useCallback((chapterId: string) => {
    return apiFetch<{ data: { topics: TopicRow[] } }>(`/books/chapters/${chapterId}`).then((r) =>
      setTopics(r.data.topics),
    );
  }, []);

  const loadTopicDetail = useCallback((topicId: string) => {
    return apiFetch<{ data: { sub_topics: SubTopicRow[] } }>(`/books/topics/${topicId}`).then((r) =>
      setSubTopics(r.data.sub_topics),
    );
  }, []);

  const loadRegulations = useCallback(() => {
    return apiFetch<{ data: RegulationRow[] }>(`/books/${bookId}/regulations`).then((r) => setRegulations(r.data));
  }, [bookId]);

  useEffect(() => {
    loadChapters();
    loadRegulations();
  }, [loadChapters, loadRegulations]);

  useEffect(() => {
    if (selectedChapterId) loadChapterTopics(selectedChapterId);
    else setTopics([]);
  }, [selectedChapterId, loadChapterTopics]);

  useEffect(() => {
    if (selectedTopicId) loadTopicDetail(selectedTopicId);
    else setSubTopics([]);
  }, [selectedTopicId, loadTopicDetail]);

  useEffect(() => {
    if (!selectedTopicId) return;
    const topic = topics.find((t) => t.id === selectedTopicId);
    if (!topic) return;
    const suggestedNo = `${book.short_name || 'BOOK'}-${topic.rule_number}`.replace(/\s+/g, '');
    setRegForm((prev) => ({
      ...prev,
      regulation_no: prev.regulation_no || suggestedNo,
      title: prev.title || topic.name,
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
      await apiFetch(`/books/${bookId}/chapters`, {
        method: 'POST',
        body: JSON.stringify({
          name: chapterForm.name.trim(),
          chapter_number: chapterForm.chapter_number.trim(),
          sub_name: chapterForm.sub_name.trim() || undefined,
          description: chapterForm.description.trim() ? wrapHtml(chapterForm.description) : undefined,
        }),
      });
      setChapterForm({ name: '', chapter_number: '', sub_name: '', description: '' });
      setMessage('Chapter added');
      await loadChapters();
      onRefresh();
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
      await apiFetch(`/books/chapters/${editChapterId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editChapterForm.name.trim(),
          chapter_number: editChapterForm.chapter_number.trim(),
          sub_name: editChapterForm.sub_name.trim() || undefined,
          description: editChapterForm.description.trim() ? wrapHtml(editChapterForm.description) : undefined,
        }),
      });
      setEditChapterId(null);
      setMessage('Chapter updated');
      await loadChapters();
      if (selectedChapterId === editChapterId) await loadChapterTopics(editChapterId);
      onRefresh();
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
      setMessage('Chapter removed');
      await loadChapters();
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove chapter');
    } finally {
      setBusy(false);
    }
  }

  async function addTopic() {
    if (!selectedChapterId || !topicForm.rule_number.trim()) return;
    clearFeedback();
    setBusy(true);
    try {
      await apiFetch(`/books/chapters/${selectedChapterId}/topics`, {
        method: 'POST',
        body: JSON.stringify({
          name: topicForm.name.trim() || undefined,
          rule_number: topicForm.rule_number.trim(),
          sub_name: topicForm.sub_name.trim() || undefined,
          description: topicForm.description.trim() ? wrapHtml(topicForm.description) : undefined,
          note: topicForm.note.trim() || undefined,
        }),
      });
      setTopicForm({ name: '', rule_number: '', sub_name: '', description: '', note: '' });
      setMessage('Rule / topic added');
      await loadChapterTopics(selectedChapterId);
      onRefresh();
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
      await apiFetch(`/books/topics/${editTopicId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editTopicForm.name.trim(),
          rule_number: editTopicForm.rule_number.trim(),
          sub_name: editTopicForm.sub_name.trim() || undefined,
          description: editTopicForm.description.trim() ? wrapHtml(editTopicForm.description) : undefined,
          note: editTopicForm.note.trim() || undefined,
        }),
      });
      setEditTopicId(null);
      setMessage('Rule updated');
      await loadChapterTopics(selectedChapterId);
      if (selectedTopicId === editTopicId) await loadTopicDetail(editTopicId);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update topic');
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
      if (selectedChapterId) await loadChapterTopics(selectedChapterId);
      setMessage('Rule removed');
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove topic');
    } finally {
      setBusy(false);
    }
  }

  async function addSubTopic() {
    if (!selectedTopicId || (!subForm.name.trim() && !subForm.rule_number.trim())) return;
    clearFeedback();
    setBusy(true);
    try {
      await apiFetch(`/books/topics/${selectedTopicId}/sub-topics`, {
        method: 'POST',
        body: JSON.stringify({
          name: subForm.name.trim() || undefined,
          rule_number: subForm.rule_number.trim() || undefined,
          description: subForm.description.trim() ? wrapHtml(subForm.description) : undefined,
          note: subForm.note.trim() || undefined,
        }),
      });
      setSubForm({ name: '', rule_number: '', description: '', note: '' });
      setMessage('Sub-rule added');
      await loadTopicDetail(selectedTopicId);
      onRefresh();
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
      await apiFetch(`/books/sub-topics/${editSubId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editSubForm.name.trim(),
          rule_number: editSubForm.rule_number.trim() || undefined,
          description: editSubForm.description.trim() ? wrapHtml(editSubForm.description) : undefined,
          note: editSubForm.note.trim() || undefined,
        }),
      });
      setEditSubId(null);
      setMessage('Sub-rule updated');
      await loadTopicDetail(selectedTopicId);
      onRefresh();
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
      if (selectedTopicId) await loadTopicDetail(selectedTopicId);
      setMessage('Sub-rule removed');
      onRefresh();
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
      await apiFetch(`/books/${bookId}/regulations`, {
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
      setRegForm({ regulation_no: '', title: '', full_text: '', regulation_type: 'rule', applicable_to: 'all' });
      setMessage(
        selectedTopicId
          ? 'Regulation created and linked to the selected rule'
          : selectedChapterId
            ? 'Regulation created and linked to the selected chapter'
            : 'Regulation created for this book',
      );
      await loadRegulations();
      onRefresh();
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
                  <button type="button" className="w-full text-left" onClick={() => { setSelectedChapterId(c.id); setSelectedTopicId(null); }}>
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
                      <button type="button" className="w-full text-left" onClick={() => setSelectedTopicId(t.id)}>
                        <span className="font-medium">{topicLabel(t)}</span>
                        {t.is_amended && <Badge variant="warning" className="ml-1">Amended</Badge>}
                      </button>
                      <div className="mt-1 flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={busy} onClick={() => {
                          setEditTopicId(t.id);
                          setEditTopicForm({
                            name: t.name,
                            rule_number: t.rule_number,
                            sub_name: t.sub_name ?? '',
                            description: t.description?.replace(/<[^>]+>/g, ' ').trim() ?? '',
                            note: t.note ?? '',
                          });
                        }}>Edit</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" disabled={busy} onClick={() => removeTopic(t.id)}>Remove</Button>
                      </div>
                    </li>
                  ))}
                </ul>
                {editTopicId && (
                  <div className="rounded-lg border border-dashed p-3 space-y-2">
                    <p className="text-xs font-semibold text-muted">Edit rule</p>
                    <Input disabled={busy} value={editTopicForm.rule_number} onChange={(e) => setEditTopicForm({ ...editTopicForm, rule_number: e.target.value })} />
                    <Input disabled={busy} value={editTopicForm.name} placeholder="Title (optional)" onChange={(e) => setEditTopicForm({ ...editTopicForm, name: e.target.value })} />
                    <textarea className="ibas-textarea text-sm" disabled={busy} value={editTopicForm.description} placeholder="Details (optional)" onChange={(e) => setEditTopicForm({ ...editTopicForm, description: e.target.value })} />
                    <Input disabled={busy} value={editTopicForm.note} placeholder="Note / cross-ref" onChange={(e) => setEditTopicForm({ ...editTopicForm, note: e.target.value })} />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={busy} onClick={saveTopicEdit}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditTopicId(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
                <div className="rounded-lg border border-dashed p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted">Add rule</p>
                  <Input disabled={busy} value={topicForm.rule_number} placeholder="Rule no. e.g. 45" onChange={(e) => setTopicForm({ ...topicForm, rule_number: e.target.value })} />
                  <Input disabled={busy} value={topicForm.name} placeholder="Title (optional)" onChange={(e) => setTopicForm({ ...topicForm, name: e.target.value })} />
                  <textarea className="ibas-textarea text-sm" disabled={busy} value={topicForm.description} placeholder="Details (optional)" onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })} />
                  <Button size="sm" disabled={busy || !topicForm.rule_number.trim()} onClick={addTopic}>Add rule</Button>
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
                            name: st.name,
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
                  <Input disabled={busy} value={subForm.rule_number} placeholder="Sub-rule no. e.g. 45(1)" onChange={(e) => setSubForm({ ...subForm, rule_number: e.target.value })} />
                  <Input disabled={busy} value={subForm.name} placeholder="Title (optional)" onChange={(e) => setSubForm({ ...subForm, name: e.target.value })} />
                  <textarea className="ibas-textarea text-sm" disabled={busy} value={subForm.description} placeholder="Details (optional)" onChange={(e) => setSubForm({ ...subForm, description: e.target.value })} />
                  <Button size="sm" disabled={busy || (!subForm.name.trim() && !subForm.rule_number.trim())} onClick={addSubTopic}>Add sub-rule</Button>
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
    </div>
  );
}
