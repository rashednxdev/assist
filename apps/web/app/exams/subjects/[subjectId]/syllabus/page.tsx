'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Link2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { SYLLABUS_REF_LEVELS, type SyllabusRefLevel } from '@ibas/shared-constants';
import { apiFetch } from '@/lib/api-client';
import { fetchMe } from '@/lib/auth';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

interface SyllabusRef {
  id: string;
  ref_level?: string;
  book_info_id?: string;
  book_chapter_id?: string;
  book_topic_id?: string;
  regulation_id?: string;
  book_short_name?: string;
  chapter_number?: string;
  chapter_name?: string;
  rule_number?: string;
  topic_name?: string;
  regulation_no?: string;
  relevance_note?: string;
}

interface SyllabusSubTopic {
  id: string;
  name: string;
  description?: string;
}

interface SyllabusTopic {
  id: string;
  name: string;
  description?: string;
  marks_weightage?: number;
  sub_topics: SyllabusSubTopic[];
  references: SyllabusRef[];
}

interface SyllabusGroup {
  id: string;
  name: string;
  marks_allocated: number;
  topics: SyllabusTopic[];
}

interface SubjectInfo {
  id: string;
  name: string;
  exam_name?: string;
  exam_short_name?: string;
  exam_name_id?: string;
}

interface BookItem {
  id: string;
  short_name: string;
  name: string;
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

interface RegulationItem {
  id: string;
  regulation_no: string;
  title: string;
}

type Panel = 'group' | 'topic' | 'sub_topic' | 'reference';

const emptyGroup = { name: '', marks_allocated: 40 };
const emptyTopic = { groupId: '', name: '', description: '', marks_weightage: 10 };
const emptySubTopic = { topicId: '', name: '', description: '' };
const emptyRef = {
  topicId: '',
  ref_level: 'rule' as SyllabusRefLevel,
  book_id: '',
  book_chapter_id: '',
  book_topic_id: '',
  regulation_id: '',
  relevance_note: '',
};

function refLabel(ref: SyllabusRef) {
  const parts = [ref.book_short_name];
  if (ref.chapter_number) parts.push(`Ch. ${ref.chapter_number}`);
  if (ref.rule_number) parts.push(`Rule ${ref.rule_number}`);
  if (ref.regulation_no) parts.push(ref.regulation_no);
  return parts.filter(Boolean).join(' · ');
}

export default function SyllabusPage() {
  const params = useParams();
  const subjectId = params.subjectId as string;
  const [subject, setSubject] = useState<SubjectInfo | null>(null);
  const [groups, setGroups] = useState<SyllabusGroup[]>([]);
  const [subjectTopics, setSubjectTopics] = useState<SyllabusTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<Panel>('group');

  const [groupForm, setGroupForm] = useState(emptyGroup);
  const [topicForm, setTopicForm] = useState(emptyTopic);
  const [subTopicForm, setSubTopicForm] = useState(emptySubTopic);
  const [refForm, setRefForm] = useState(emptyRef);

  const [editGroupId, setEditGroupId] = useState('');
  const [editTopicId, setEditTopicId] = useState('');
  const [editSubTopicId, setEditSubTopicId] = useState('');
  const [editRefId, setEditRefId] = useState('');

  const [books, setBooks] = useState<BookItem[]>([]);
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [bookTopics, setBookTopics] = useState<TopicItem[]>([]);
  const [regulations, setRegulations] = useState<RegulationItem[]>([]);

  const reload = useCallback(() => {
    return Promise.all([
      apiFetch<{ data: SubjectInfo }>(`/exams/subjects/${subjectId}`),
      apiFetch<{ data: { groups: SyllabusGroup[]; subject_topics: SyllabusTopic[] } }>(
        `/syllabus/subjects/${subjectId}/tree`,
      ),
    ]).then(([subRes, treeRes]) => {
      setSubject(subRes.data);
      setGroups(treeRes.data.groups);
      setSubjectTopics(treeRes.data.subject_topics ?? []);
    });
  }, [subjectId]);

  useEffect(() => {
    reload()
      .catch(() => setSubject(null))
      .finally(() => setLoading(false));
    apiFetch<{ data: BookItem[] }>('/books').then((r) => setBooks(r.data)).catch(() => {});
    fetchMe()
      .then((res) => {
        setIsAdmin(
          res.data.is_super_admin || res.data.user_type === 'system_admin' || res.data.user_type === 'admin',
        );
      })
      .catch(() => {});
  }, [reload]);

  useEffect(() => {
    if (!refForm.book_id) {
      setChapters([]);
      return;
    }
    apiFetch<{ data: ChapterItem[] }>(`/books/${refForm.book_id}/chapters`)
      .then((r) => setChapters(r.data))
      .catch(() => setChapters([]));
  }, [refForm.book_id]);

  useEffect(() => {
    if (!refForm.book_chapter_id) {
      setBookTopics([]);
      return;
    }
    apiFetch<{ data: { topics: TopicItem[] } }>(`/books/chapters/${refForm.book_chapter_id}`)
      .then((r) => setBookTopics(r.data.topics ?? []))
      .catch(() => setBookTopics([]));
  }, [refForm.book_chapter_id]);

  useEffect(() => {
    if (!refForm.book_topic_id) {
      setRegulations([]);
      return;
    }
    apiFetch<{ data: { regulations: RegulationItem[] } }>(`/books/topics/${refForm.book_topic_id}`)
      .then((r) => setRegulations(r.data.regulations ?? []))
      .catch(() => setRegulations([]));
  }, [refForm.book_topic_id]);

  function clearEdits() {
    setEditGroupId('');
    setEditTopicId('');
    setEditSubTopicId('');
    setEditRefId('');
    setGroupForm(emptyGroup);
    setTopicForm(emptyTopic);
    setSubTopicForm(emptySubTopic);
    setRefForm(emptyRef);
  }

  function startEditGroup(g: SyllabusGroup) {
    setPanel('group');
    setEditGroupId(g.id);
    setGroupForm({ name: g.name, marks_allocated: g.marks_allocated });
  }

  function startEditTopic(t: SyllabusTopic, groupId: string) {
    setPanel('topic');
    setEditTopicId(t.id);
    setTopicForm({
      groupId,
      name: t.name,
      description: t.description ?? '',
      marks_weightage: t.marks_weightage ?? 10,
    });
  }

  function startEditSubTopic(st: SyllabusSubTopic, topicId: string) {
    setPanel('sub_topic');
    setEditSubTopicId(st.id);
    setSubTopicForm({ topicId, name: st.name, description: st.description ?? '' });
  }

  function startEditRef(ref: SyllabusRef, topicId: string) {
    setPanel('reference');
    setEditRefId(ref.id);
    setRefForm({
      topicId,
      ref_level: (ref.ref_level as SyllabusRefLevel) ?? 'rule',
      book_id: ref.book_info_id ?? '',
      book_chapter_id: ref.book_chapter_id ?? '',
      book_topic_id: ref.book_topic_id ?? '',
      regulation_id: ref.regulation_id ?? '',
      relevance_note: ref.relevance_note ?? '',
    });
  }

  function startAddRef(topicId: string) {
    setPanel('reference');
    setEditRefId('');
    setRefForm({ ...emptyRef, topicId });
  }

  async function saveGroup(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (editGroupId) {
        await apiFetch(`/syllabus/groups/${editGroupId}`, {
          method: 'PATCH',
          body: JSON.stringify(groupForm),
        });
        setMessage('Group updated');
      } else {
        await apiFetch('/syllabus/groups', {
          method: 'POST',
          body: JSON.stringify({ exam_subject_id: subjectId, ...groupForm }),
        });
        setMessage('Group added');
      }
      clearEdits();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function saveTopic(e: React.FormEvent) {
    e.preventDefault();
    const hasGroups = groups.length > 0;
    if (hasGroups && !topicForm.groupId) {
      setError('Please select a syllabus group');
      return;
    }
    setError('');
    try {
      const body = {
        name: topicForm.name,
        description: topicForm.description || undefined,
        marks_weightage: topicForm.marks_weightage,
      };
      if (editTopicId) {
        await apiFetch(`/syllabus/topics/${editTopicId}`, { method: 'PATCH', body: JSON.stringify(body) });
        setMessage('Topic updated');
      } else {
        await apiFetch('/syllabus/topics', {
          method: 'POST',
          body: JSON.stringify(
            hasGroups
              ? { syllabus_group_id: topicForm.groupId, ...body }
              : { exam_subject_id: subjectId, ...body },
          ),
        });
        setMessage('Topic added');
      }
      clearEdits();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function saveSubTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!subTopicForm.topicId) return;
    setError('');
    try {
      const body = {
        name: subTopicForm.name,
        description: subTopicForm.description || undefined,
      };
      if (editSubTopicId) {
        await apiFetch(`/syllabus/sub-topics/${editSubTopicId}`, { method: 'PATCH', body: JSON.stringify(body) });
        setMessage('Sub-topic updated');
      } else {
        await apiFetch('/syllabus/sub-topics', {
          method: 'POST',
          body: JSON.stringify({ syllabus_topic_id: subTopicForm.topicId, ...body }),
        });
        setMessage('Sub-topic added');
      }
      clearEdits();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  function refPayload() {
    return {
      syllabus_topic_id: refForm.topicId,
      exam_subject_id: subjectId,
      ref_level: refForm.ref_level,
      book_info_id: refForm.book_id || undefined,
      book_chapter_id: refForm.ref_level !== 'book' ? refForm.book_chapter_id || undefined : undefined,
      book_topic_id:
        refForm.ref_level === 'rule' || refForm.ref_level === 'regulation'
          ? refForm.book_topic_id || undefined
          : undefined,
      regulation_id: refForm.ref_level === 'regulation' ? refForm.regulation_id || undefined : undefined,
      relevance_note: refForm.relevance_note || undefined,
    };
  }

  async function saveReference(e: React.FormEvent) {
    e.preventDefault();
    if (!refForm.topicId) return;
    setError('');
    try {
      if (editRefId) {
        const { syllabus_topic_id: _t, exam_subject_id: _s, ...updateBody } = refPayload();
        await apiFetch(`/syllabus/references/${editRefId}`, {
          method: 'PATCH',
          body: JSON.stringify(updateBody),
        });
        setMessage('Book link updated');
      } else {
        await apiFetch('/syllabus/references', {
          method: 'POST',
          body: JSON.stringify(refPayload()),
        });
        setMessage('Book link added — you can add more links to the same topic');
      }
      setEditRefId('');
      setRefForm({ ...emptyRef, topicId: refForm.topicId });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function deleteItem(type: 'group' | 'topic' | 'sub_topic' | 'reference', id: string, label: string) {
    if (!confirm(`Delete ${label}?`)) return;
    setError('');
    const paths = {
      group: `/syllabus/groups/${id}`,
      topic: `/syllabus/topics/${id}`,
      sub_topic: `/syllabus/sub-topics/${id}`,
      reference: `/syllabus/references/${id}`,
    };
    try {
      await apiFetch(paths[type], { method: 'DELETE' });
      setMessage('Deleted');
      clearEdits();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  function bookRefFields() {
    return (
      <>
        <select
          value={refForm.ref_level}
          onChange={(e) =>
            setRefForm((f) => ({
              ...f,
              ref_level: e.target.value as SyllabusRefLevel,
              book_chapter_id: '',
              book_topic_id: '',
              regulation_id: '',
            }))
          }
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {SYLLABUS_REF_LEVELS.map((l) => (
            <option key={l} value={l}>
              {l === 'book' ? 'Whole book' : l === 'chapter' ? 'Chapter' : l === 'rule' ? 'Rule / topic' : 'Regulation'}
            </option>
          ))}
        </select>
        <select
          required
          value={refForm.book_id}
          onChange={(e) =>
            setRefForm((f) => ({
              ...f,
              book_id: e.target.value,
              book_chapter_id: '',
              book_topic_id: '',
              regulation_id: '',
            }))
          }
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Select book</option>
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.short_name} — {b.name}
            </option>
          ))}
        </select>
        {refForm.ref_level !== 'book' && (
          <select
            required
            value={refForm.book_chapter_id}
            onChange={(e) =>
              setRefForm((f) => ({ ...f, book_chapter_id: e.target.value, book_topic_id: '', regulation_id: '' }))
            }
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select chapter</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                Ch. {c.chapter_number} — {c.name}
              </option>
            ))}
          </select>
        )}
        {(refForm.ref_level === 'rule' || refForm.ref_level === 'regulation') && (
          <select
            required
            value={refForm.book_topic_id}
            onChange={(e) => setRefForm((f) => ({ ...f, book_topic_id: e.target.value, regulation_id: '' }))}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select rule / book topic</option>
            {bookTopics.map((t) => (
              <option key={t.id} value={t.id}>
                Rule {t.rule_number} — {t.name}
              </option>
            ))}
          </select>
        )}
        {refForm.ref_level === 'regulation' && (
          <select
            value={refForm.regulation_id}
            onChange={(e) => setRefForm((f) => ({ ...f, regulation_id: e.target.value }))}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Regulation (optional)</option>
            {regulations.map((r) => (
              <option key={r.id} value={r.id}>
                {r.regulation_no} — {r.title}
              </option>
            ))}
          </select>
        )}
        <Input
          placeholder="Relevance note"
          value={refForm.relevance_note}
          onChange={(e) => setRefForm((f) => ({ ...f, relevance_note: e.target.value }))}
        />
      </>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!subject) {
    return <Alert variant="error">Subject not found.</Alert>;
  }

  const hasGroups = groups.length > 0;

  const syllabusTopicOptions = [
    ...groups.flatMap((g) =>
      g.topics.map((t) => ({ id: t.id, label: `${g.name} → ${t.name}` })),
    ),
    ...subjectTopics.map((t) => ({ id: t.id, label: t.name })),
  ];

  function renderTopicCard(topic: SyllabusTopic, groupId: string) {
    return (
      <div key={topic.id} className="rounded-lg border border-border p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-medium">{topic.name}</div>
            {topic.description && <p className="mt-1 text-sm text-muted">{topic.description}</p>}
            {topic.marks_weightage != null && (
              <Badge variant="outline" className="mt-2">
                {topic.marks_weightage} marks
              </Badge>
            )}
          </div>
          {isAdmin && (
            <div className="flex shrink-0 gap-1">
              <Button size="sm" variant="outline" onClick={() => startEditTopic(topic, groupId)}>
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => deleteItem('topic', topic.id, `topic "${topic.name}"`)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {topic.sub_topics.length > 0 && (
          <div className="mt-3">
            <div className="text-xs font-semibold uppercase text-muted">Sub-topics</div>
            <ul className="mt-1 space-y-1">
              {topic.sub_topics.map((st) => (
                <li
                  key={st.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1 text-sm"
                >
                  <span>{st.name}</span>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => startEditSubTopic(st, topic.id)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => deleteItem('sub_topic', st.id, `sub-topic "${st.name}"`)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase text-muted">
              Book links ({topic.references.length})
            </div>
            {isAdmin && (
              <Button size="sm" variant="outline" className="h-7" onClick={() => startAddRef(topic.id)}>
                <Plus className="h-3 w-3" /> Add link
              </Button>
            )}
          </div>
          {topic.references.length === 0 ? (
            <p className="mt-1 text-sm text-muted">No book chapters or rules linked yet.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {topic.references.map((ref) => (
                <div
                  key={ref.id}
                  className="flex items-start justify-between gap-2 rounded-md border border-border bg-slate-50/80 p-2 text-sm"
                >
                  <div>
                    <Badge variant="secondary">{ref.ref_level ?? 'link'}</Badge>
                    <span className="ml-2 font-medium">{refLabel(ref)}</span>
                    {ref.topic_name && ref.rule_number && (
                      <span className="ml-1 text-muted">({ref.topic_name})</span>
                    )}
                    {ref.relevance_note && <p className="mt-1 text-muted">{ref.relevance_note}</p>}
                  </div>
                  {isAdmin && (
                    <div className="flex shrink-0 gap-1">
                      <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => startEditRef(ref, topic.id)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2"
                        onClick={() => deleteItem('reference', ref.id, 'this book link')}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const panels: { id: Panel; label: string }[] = [
    { id: 'group', label: 'Group' },
    { id: 'topic', label: 'Topic' },
    { id: 'sub_topic', label: 'Sub-topic' },
    { id: 'reference', label: 'Book links' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Syllabus — ${subject.name}`}
        description="Manage groups, topics, sub-topics, and multiple book chapter/rule links per topic."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={subject.exam_name_id ? `/exams/${subject.exam_name_id}` : '/exams'}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      />

      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      {isAdmin && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Manage syllabus</CardTitle>
            {(editGroupId || editTopicId || editSubTopicId || editRefId) && (
              <Button type="button" size="sm" variant="outline" onClick={clearEdits}>
                <X className="h-4 w-4" /> Cancel edit
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {panels.map((p) => (
                <Button
                  key={p.id}
                  size="sm"
                  variant={panel === p.id ? 'default' : 'outline'}
                  onClick={() => setPanel(p.id)}
                >
                  {p.label}
                </Button>
              ))}
            </div>

            {panel === 'group' && (
              <form onSubmit={saveGroup} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Input
                  placeholder="Group name"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
                <Input
                  type="number"
                  placeholder="Marks allocated"
                  value={groupForm.marks_allocated}
                  onChange={(e) => setGroupForm((f) => ({ ...f, marks_allocated: Number(e.target.value) }))}
                />
                <Button type="submit" size="sm">
                  {editGroupId ? 'Update group' : 'Add group'}
                </Button>
              </form>
            )}

            {panel === 'topic' && (
              <form onSubmit={saveTopic} className="space-y-3">
                {hasGroups ? (
                  <select
                    required
                    value={topicForm.groupId}
                    onChange={(e) => setTopicForm((f) => ({ ...f, groupId: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    disabled={!!editTopicId}
                  >
                    <option value="">Select group</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-muted">
                    No groups yet — topics will be added directly under this subject.
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    placeholder="Topic name"
                    value={topicForm.name}
                    onChange={(e) => setTopicForm((f) => ({ ...f, name: e.target.value }))}
                    required
                  />
                  <Input
                    type="number"
                    placeholder="Marks weightage"
                    value={topicForm.marks_weightage}
                    onChange={(e) => setTopicForm((f) => ({ ...f, marks_weightage: Number(e.target.value) }))}
                  />
                </div>
                <Input
                  placeholder="Description (optional)"
                  value={topicForm.description}
                  onChange={(e) => setTopicForm((f) => ({ ...f, description: e.target.value }))}
                />
                <Button type="submit" size="sm">
                  {editTopicId ? 'Update topic' : 'Add topic'}
                </Button>
              </form>
            )}

            {panel === 'sub_topic' && (
              <form onSubmit={saveSubTopic} className="space-y-3">
                <select
                  required
                  value={subTopicForm.topicId}
                  onChange={(e) => setSubTopicForm((f) => ({ ...f, topicId: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled={!!editSubTopicId}
                >
                  <option value="">Select syllabus topic</option>
                  {syllabusTopicOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="Sub-topic name"
                  value={subTopicForm.name}
                  onChange={(e) => setSubTopicForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
                <Input
                  placeholder="Description (optional)"
                  value={subTopicForm.description}
                  onChange={(e) => setSubTopicForm((f) => ({ ...f, description: e.target.value }))}
                />
                <Button type="submit" size="sm">
                  {editSubTopicId ? 'Update sub-topic' : 'Add sub-topic'}
                </Button>
              </form>
            )}

            {panel === 'reference' && (
              <form onSubmit={saveReference} className="space-y-3">
                <p className="text-sm text-muted">
                  A syllabus topic can link to many book chapters or rules. Add one link at a time; repeat to attach
                  more.
                </p>
                <select
                  required
                  value={refForm.topicId}
                  onChange={(e) => setRefForm((f) => ({ ...f, topicId: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled={!!editRefId}
                >
                  <option value="">Syllabus topic</option>
                  {syllabusTopicOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {bookRefFields()}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" size="sm">
                    <Link2 className="h-4 w-4" />
                    {editRefId ? 'Update link' : 'Add book link'}
                  </Button>
                  {!editRefId && refForm.topicId && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setRefForm((f) => ({ ...emptyRef, topicId: f.topicId }))}
                    >
                      Clear form
                    </Button>
                  )}
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {!hasGroups && subjectTopics.length === 0 ? (
        <p className="text-muted">No syllabus content yet. Add a group or topic to get started.</p>
      ) : (
        <>
      {!hasGroups && subjectTopics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Topics</CardTitle>
            <p className="text-sm text-muted">Syllabus topics for this subject</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {subjectTopics.map((topic) => renderTopicCard(topic, ''))}
          </CardContent>
        </Card>
      )}
      {groups.map((group) => (
          <Card key={group.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle className="text-lg">{group.name}</CardTitle>
                <p className="text-sm text-muted">{group.marks_allocated} marks allocated</p>
              </div>
              {isAdmin && (
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => startEditGroup(group)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteItem('group', group.id, `group "${group.name}"`)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {group.topics.length === 0 ? (
                <p className="text-sm text-muted">No topics in this group.</p>
              ) : (
                group.topics.map((topic) => renderTopicCard(topic, group.id))
              )}
            </CardContent>
          </Card>
        ))}
      {hasGroups && subjectTopics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Subject topics</CardTitle>
            <p className="text-sm text-muted">Topics added directly under this subject (not in a group)</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {subjectTopics.map((topic) => renderTopicCard(topic, ''))}
          </CardContent>
        </Card>
      )}
        </>
      )}
    </div>
  );
}
