'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { fetchMe } from '@/lib/auth';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OutlinedInput, OutlinedSelect, OutlinedTextarea } from '@/components/shared/outlined-field';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

interface QuestionBrief {
  id: string;
  question_type_code: string;
  body_en: string;
  marks: number;
}

interface PaperPart {
  id: string;
  question_id: string;
  part_label: string;
  marks: number;
  marks_display_bn?: string;
  question?: QuestionBrief;
}

interface PaperQuestionRow {
  id: string;
  from_question_bank: boolean;
  question_id?: string;
  header_text?: string;
  question_number: number;
  display_question_number?: string;
  marks: number;
  marks_display_bn?: string;
  is_compulsory: boolean;
  question?: QuestionBrief;
  parts: PaperPart[];
}

interface PaperGroupRow {
  id: string;
  name: string;
  group_number: number;
  marks: number;
  instructions?: string;
  questions: PaperQuestionRow[];
}

interface ComposeData {
  paper: {
    id: string;
    name: string;
    total_marks: number;
    pass_marks: number;
    duration_minutes: number;
    instructions?: string;
    is_published: boolean;
    allocated_marks?: number;
    exam_subject_name?: string;
    exam_short_name?: string;
    paper_type_name?: string;
  };
  groups: PaperGroupRow[];
  ungrouped_questions: PaperQuestionRow[];
}

interface BankQuestion {
  id: string;
  question_type_code: string;
  body_en: string;
  marks: number;
  is_published: boolean;
}

type Panel = 'section' | 'question' | 'part';

const emptySection = { name: '', group_number: 1, marks: 0, instructions: '' };
const emptyQuestion = {
  paper_group_id: '',
  from_question_bank: true,
  question_id: '',
  header_text: '',
  question_number: 1,
  display_question_number: '',
  marks: 1,
  marks_display_bn: '',
  is_compulsory: true,
};
const emptyPart = { paper_question_id: '', question_id: '', part_label: '(a)', marks: 1, marks_display_bn: '' };

function displayQuestionLabel(pq: PaperQuestionRow) {
  return pq.display_question_number?.trim() || String(pq.question_number);
}

function questionPreviewText(pq: PaperQuestionRow) {
  if (!pq.from_question_bank) return pq.header_text ?? '';
  return pq.question?.body_en ?? '';
}

function marksPreview(pq: { marks: number; marks_display_bn?: string }) {
  return pq.marks_display_bn?.trim() || `${pq.marks} mark${pq.marks !== 1 ? 's' : ''}`;
}

function truncate(text: string, len = 120) {
  return text.length > len ? `${text.slice(0, len)}…` : text;
}

function getAllQuestions(data: ComposeData): PaperQuestionRow[] {
  return [...data.groups.flatMap((g) => g.questions), ...data.ungrouped_questions];
}

function nextQuestionNumber(questions: PaperQuestionRow[]): number {
  return questions.length ? Math.max(...questions.map((q) => q.question_number)) + 1 : 1;
}

function freshQuestionForm(
  questions: PaperQuestionRow[],
  overrides: Partial<typeof emptyQuestion> = {},
) {
  return { ...emptyQuestion, question_number: nextQuestionNumber(questions), ...overrides };
}

export default function PaperComposerPage() {
  const params = useParams();
  const paperId = params.id as string;
  const [data, setData] = useState<ComposeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<Panel>('section');
  const [bank, setBank] = useState<BankQuestion[]>([]);
  const [bankQ, setBankQ] = useState('');

  const [sectionForm, setSectionForm] = useState(emptySection);
  const [editSectionId, setEditSectionId] = useState('');
  const [questionForm, setQuestionForm] = useState(emptyQuestion);
  const [editQuestionId, setEditQuestionId] = useState('');
  const [partForm, setPartForm] = useState(emptyPart);
  const [editPartId, setEditPartId] = useState('');

  const reload = useCallback(() => {
    return Promise.all([
      apiFetch<{ data: ComposeData }>(`/papers/${paperId}/compose`),
      apiFetch<{ data: { allocated_marks?: number } }>(`/papers/${paperId}`),
    ]).then(([composeRes, paperRes]) => {
      setData({
        ...composeRes.data,
        paper: { ...composeRes.data.paper, allocated_marks: paperRes.data.allocated_marks },
      });
    });
  }, [paperId]);

  useEffect(() => {
    reload()
      .catch(() => setData(null))
      .finally(() => setLoading(false));
    fetchMe()
      .then((res) => {
        setIsAdmin(
          res.data.is_super_admin || res.data.user_type === 'system_admin' || res.data.user_type === 'admin',
        );
      })
      .catch(() => {});
  }, [reload]);

  useEffect(() => {
    const params = new URLSearchParams({ is_published: 'true' });
    if (bankQ.trim()) params.set('q', bankQ.trim());
    apiFetch<{ data: BankQuestion[] }>(`/questions?${params.toString()}`)
      .then((r) => setBank(r.data))
      .catch(() => setBank([]));
  }, [bankQ]);

  function clearEdits() {
    setEditSectionId('');
    setEditQuestionId('');
    setEditPartId('');
    setSectionForm(emptySection);
    setQuestionForm(emptyQuestion);
    setPartForm(emptyPart);
  }

  const readOnly = !isAdmin || data?.paper.is_published;

  async function saveSection(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (editSectionId) {
        await apiFetch(`/papers/groups/${editSectionId}`, {
          method: 'PATCH',
          body: JSON.stringify(sectionForm),
        });
        setMessage('Section updated');
      } else {
        await apiFetch(`/papers/${paperId}/groups`, {
          method: 'POST',
          body: JSON.stringify(sectionForm),
        });
        setMessage('Section added');
      }
      clearEdits();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function saveQuestion(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!data) return;
    if (questionForm.from_question_bank && !questionForm.question_id) {
      setError('Select a question from the bank');
      return;
    }
    if (!questionForm.from_question_bank && !questionForm.header_text.trim()) {
      setError('Header text is required for composite questions');
      return;
    }
    const existingQuestions = getAllQuestions(data);
    const serialClash = existingQuestions.find(
      (q) => q.question_number === questionForm.question_number && q.id !== editQuestionId,
    );
    if (serialClash) {
      setError(
        `Serial order ${questionForm.question_number} is already used. Try ${nextQuestionNumber(existingQuestions)}.`,
      );
      return;
    }
    try {
      const body = {
        from_question_bank: questionForm.from_question_bank,
        question_id: questionForm.from_question_bank ? questionForm.question_id : undefined,
        header_text: questionForm.from_question_bank ? undefined : questionForm.header_text.trim(),
        paper_group_id: questionForm.paper_group_id || undefined,
        question_number: questionForm.question_number,
        display_question_number: questionForm.display_question_number.trim() || undefined,
        marks: questionForm.marks,
        marks_display_bn: questionForm.marks_display_bn.trim() || undefined,
        is_compulsory: questionForm.is_compulsory,
      };
      if (editQuestionId) {
        await apiFetch(`/papers/questions/${editQuestionId}`, { method: 'PATCH', body: JSON.stringify(body) });
        setMessage('Question updated');
      } else {
        await apiFetch(`/papers/${paperId}/questions`, { method: 'POST', body: JSON.stringify(body) });
        setMessage('Question added to paper');
      }
      clearEdits();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function savePart(e: React.FormEvent) {
    e.preventDefault();
    if (!partForm.paper_question_id || !partForm.question_id) return;
    setError('');
    try {
      const body = {
        question_id: partForm.question_id,
        part_label: partForm.part_label,
        marks: partForm.marks,
        marks_display_bn: partForm.marks_display_bn.trim() || undefined,
      };
      if (editPartId) {
        await apiFetch(`/papers/parts/${editPartId}`, { method: 'PATCH', body: JSON.stringify(body) });
        setMessage('Sub-part updated');
      } else {
        await apiFetch(`/papers/questions/${partForm.paper_question_id}/parts`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        setMessage('Sub-part added');
      }
      clearEdits();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function deleteItem(type: 'section' | 'question' | 'part', id: string, label: string) {
    if (!confirm(`Remove ${label}?`)) return;
    setError('');
    const paths = {
      section: `/papers/groups/${id}`,
      question: `/papers/questions/${id}`,
      part: `/papers/parts/${id}`,
    };
    try {
      await apiFetch(paths[type], { method: 'DELETE' });
      setMessage('Removed');
      clearEdits();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function publish() {
    setError('');
    try {
      await apiFetch(`/papers/${paperId}/publish`, { method: 'POST' });
      setMessage('Paper published');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    }
  }

  async function unpublish() {
    setError('');
    try {
      await apiFetch(`/papers/${paperId}/unpublish`, { method: 'POST' });
      setMessage('Paper unpublished');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unpublish failed');
    }
  }

  function renderQuestionRow(pq: PaperQuestionRow, groupId?: string) {
    const displayNo = displayQuestionLabel(pq);
    return (
      <div key={pq.id} className="rounded-md border border-border bg-slate-50/80 p-3 text-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="font-semibold">{displayNo}.</span>{' '}
            {!pq.from_question_bank && <Badge variant="outline">Composite</Badge>}{' '}
            {pq.from_question_bank && pq.question?.question_type_code && (
              <Badge variant="secondary">{pq.question.question_type_code}</Badge>
            )}{' '}
            <span className="ml-1">{truncate(questionPreviewText(pq))}</span>
            <div className="mt-1 text-muted">
              {marksPreview(pq)}
              {pq.is_compulsory ? ' · compulsory' : ''}
              <span className="text-xs"> · serial #{pq.question_number}</span>
            </div>
          </div>
          {!readOnly && (
            <div className="flex shrink-0 gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2"
                onClick={() => {
                  setPanel('question');
                  setEditQuestionId(pq.id);
                  setQuestionForm({
                    paper_group_id: groupId ?? '',
                    from_question_bank: pq.from_question_bank,
                    question_id: pq.question_id ?? '',
                    header_text: pq.header_text ?? '',
                    question_number: pq.question_number,
                    display_question_number: pq.display_question_number ?? '',
                    marks: pq.marks,
                    marks_display_bn: pq.marks_display_bn ?? '',
                    is_compulsory: pq.is_compulsory,
                  });
                }}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2"
                onClick={() =>
                  deleteItem('question', pq.id, `question ${displayNo}`)
                }
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        {pq.parts.length > 0 && (
          <ul className="mt-2 space-y-1 border-l-2 border-border pl-3">
            {pq.parts.map((part) => (
              <li key={part.id} className="flex items-start justify-between gap-2">
                <span>
                  <strong>{part.part_label}</strong> {truncate(part.question?.body_en ?? '')}{' '}
                  <span className="text-muted">
                    ({part.marks_display_bn?.trim() || `${part.marks}m`})
                  </span>
                </span>
                {!readOnly && (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => {
                        setPanel('part');
                        setEditPartId(part.id);
                        setPartForm({
                          paper_question_id: pq.id,
                          question_id: part.question_id,
                          part_label: part.part_label,
                          marks: part.marks,
                          marks_display_bn: part.marks_display_bn ?? '',
                        });
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => deleteItem('part', part.id, `part ${part.part_label}`)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {!readOnly && !pq.from_question_bank && (
          <Button
            size="sm"
            variant="outline"
            className="mt-2 h-7"
            onClick={() => {
              setPanel('part');
              setEditPartId('');
              setPartForm({ ...emptyPart, paper_question_id: pq.id });
            }}
          >
            <Plus className="h-3 w-3" /> Add sub-part
          </Button>
        )}
      </div>
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

  if (!data) {
    return <Alert variant="error">Paper not found.</Alert>;
  }

  const { paper, groups, ungrouped_questions } = data;
  const allocated = paper.allocated_marks ?? 0;
  const marksOk = allocated === paper.total_marks;

  const allQuestions = getAllQuestions(data);
  const compositeQuestions = allQuestions.filter((q) => !q.from_question_bank);
  const nextQNum = nextQuestionNumber(allQuestions);

  function openNewQuestionForm(overrides: Partial<typeof emptyQuestion> = {}) {
    setPanel('question');
    setEditQuestionId('');
    setQuestionForm(freshQuestionForm(allQuestions, overrides));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={paper.name}
        description={`${paper.exam_short_name ?? ''} ${paper.exam_subject_name ?? ''} · ${paper.paper_type_name ?? 'Paper'}`.trim()}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/papers">
                <ArrowLeft className="h-4 w-4" />
                Papers
              </Link>
            </Button>
            {isAdmin && !paper.is_published && (
              <Button size="sm" onClick={publish} disabled={!marksOk || allQuestions.length === 0}>
                <Upload className="h-4 w-4" />
                Publish
              </Button>
            )}
            {isAdmin && paper.is_published && (
              <Button size="sm" variant="outline" onClick={unpublish}>
                Unpublish
              </Button>
            )}
          </div>
        }
      />

      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-6 text-sm">
          <Badge variant={paper.is_published ? 'default' : 'outline'}>
            {paper.is_published ? 'Published' : 'Draft'}
          </Badge>
          <span>{paper.total_marks} total marks</span>
          <span>Pass: {paper.pass_marks}</span>
          <span>{paper.duration_minutes} minutes</span>
          <span className={marksOk ? 'text-green-700' : 'text-amber-700'}>
            Allocated: {allocated} / {paper.total_marks}
          </span>
          {!marksOk && !paper.is_published && (
            <span className="text-muted">Adjust question marks before publishing</span>
          )}
        </CardContent>
      </Card>

      {isAdmin && !paper.is_published && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Composer</CardTitle>
            {(editSectionId || editQuestionId || editPartId) && (
              <Button type="button" size="sm" variant="outline" onClick={clearEdits}>
                <X className="h-4 w-4" /> Cancel edit
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(['section', 'question', 'part'] as Panel[]).map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant={panel === p ? 'default' : 'outline'}
                  onClick={() => {
                    if (p === 'question' && !editQuestionId) {
                      openNewQuestionForm({ paper_group_id: questionForm.paper_group_id });
                      return;
                    }
                    setPanel(p);
                  }}
                >
                  {p === 'section' ? 'Section' : p === 'question' ? 'Question' : 'Sub-part'}
                </Button>
              ))}
            </div>

            {panel === 'section' && (
              <form onSubmit={saveSection} className="grid gap-3 sm:grid-cols-2">
                <OutlinedInput
                  label="Section name"
                  value={sectionForm.name}
                  onChange={(e) => setSectionForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
                <OutlinedInput
                  label="Section number"
                  type="number"
                  value={sectionForm.group_number}
                  onChange={(e) => setSectionForm((f) => ({ ...f, group_number: Number(e.target.value) }))}
                />
                <OutlinedInput
                  label="Section marks"
                  type="number"
                  value={sectionForm.marks}
                  onChange={(e) => setSectionForm((f) => ({ ...f, marks: Number(e.target.value) }))}
                />
                <OutlinedInput
                  label="Instructions (optional)"
                  value={sectionForm.instructions}
                  onChange={(e) => setSectionForm((f) => ({ ...f, instructions: e.target.value }))}
                />
                <Button type="submit" size="sm" className="sm:col-span-2">
                  {editSectionId ? 'Update section' : 'Add section'}
                </Button>
              </form>
            )}

            {panel === 'question' && (
              <form onSubmit={saveQuestion} className="space-y-3">
                <OutlinedSelect
                  label="Section (optional)"
                  value={questionForm.paper_group_id}
                  onChange={(e) => setQuestionForm((f) => ({ ...f, paper_group_id: e.target.value }))}
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.group_number}. {g.name}
                    </option>
                  ))}
                </OutlinedSelect>

                <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-slate-50/60 px-3 py-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="question_source"
                      checked={questionForm.from_question_bank}
                      onChange={() =>
                        setQuestionForm((f) => ({
                          ...f,
                          from_question_bank: true,
                          header_text: '',
                        }))
                      }
                    />
                    From question bank
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="question_source"
                      checked={!questionForm.from_question_bank}
                      onChange={() =>
                        setQuestionForm((f) => ({
                          ...f,
                          from_question_bank: false,
                          question_id: '',
                          ...(editQuestionId ? {} : { question_number: nextQNum }),
                        }))
                      }
                    />
                    Composite (header + sub-parts)
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <OutlinedInput
                    label="Serial order"
                    type="number"
                    value={questionForm.question_number}
                    onChange={(e) =>
                      setQuestionForm((f) => ({ ...f, question_number: Number(e.target.value) }))
                    }
                  />
                  <OutlinedInput
                    label="Display number (on paper)"
                    value={questionForm.display_question_number}
                    onChange={(e) =>
                      setQuestionForm((f) => ({ ...f, display_question_number: e.target.value }))
                    }
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <OutlinedInput
                    label="Marks (allocation)"
                    type="number"
                    value={questionForm.marks}
                    onChange={(e) => setQuestionForm((f) => ({ ...f, marks: Number(e.target.value) }))}
                  />
                  <OutlinedInput
                    label="Marks display (Bangla)"
                    value={questionForm.marks_display_bn}
                    onChange={(e) => setQuestionForm((f) => ({ ...f, marks_display_bn: e.target.value }))}
                  />
                  <label className="flex h-11 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm shadow-sm">
                    <input
                      type="checkbox"
                      checked={questionForm.is_compulsory}
                      onChange={(e) =>
                        setQuestionForm((f) => ({ ...f, is_compulsory: e.target.checked }))
                      }
                    />
                    Compulsory
                  </label>
                </div>

                {questionForm.from_question_bank ? (
                  <>
                    <OutlinedInput
                      label="Search published questions"
                      value={bankQ}
                      onChange={(e) => setBankQ(e.target.value)}
                    />
                    <OutlinedSelect
                      label="Question from bank"
                      required
                      value={questionForm.question_id}
                      onChange={(e) => {
                        const q = bank.find((b) => b.id === e.target.value);
                        setQuestionForm((f) => ({
                          ...f,
                          question_id: e.target.value,
                          marks: q?.marks ?? f.marks,
                        }));
                      }}
                      size={Math.min(6, Math.max(3, bank.length))}
                    >
                      {bank.map((q) => (
                        <option key={q.id} value={q.id}>
                          [{q.question_type_code}] {truncate(q.body_en, 80)} ({q.marks}m)
                        </option>
                      ))}
                    </OutlinedSelect>
                  </>
                ) : (
                  <OutlinedTextarea
                    label="Question header (shown on paper)"
                    value={questionForm.header_text}
                    onChange={(e) => setQuestionForm((f) => ({ ...f, header_text: e.target.value }))}
                    rows={4}
                    required
                  />
                )}

                <Button type="submit" size="sm">
                  {editQuestionId ? 'Update question' : 'Add question'}
                </Button>
              </form>
            )}

            {panel === 'part' && (
              <form onSubmit={savePart} className="space-y-3">
                <OutlinedSelect
                  label="Composite parent question"
                  required
                  value={partForm.paper_question_id}
                  onChange={(e) => setPartForm((f) => ({ ...f, paper_question_id: e.target.value }))}
                  disabled={!!editPartId}
                >
                  {compositeQuestions.map((pq) => (
                    <option key={pq.id} value={pq.id}>
                      {displayQuestionLabel(pq)} — {truncate(questionPreviewText(pq), 60)}
                    </option>
                  ))}
                </OutlinedSelect>
                <div className="grid gap-3 sm:grid-cols-2">
                  <OutlinedInput
                    label="Part label (e.g. (a))"
                    value={partForm.part_label}
                    onChange={(e) => setPartForm((f) => ({ ...f, part_label: e.target.value }))}
                    required
                  />
                  <OutlinedInput
                    label="Marks (allocation)"
                    type="number"
                    value={partForm.marks}
                    onChange={(e) => setPartForm((f) => ({ ...f, marks: Number(e.target.value) }))}
                  />
                </div>
                <OutlinedInput
                  label="Marks display (Bangla)"
                  value={partForm.marks_display_bn}
                  onChange={(e) => setPartForm((f) => ({ ...f, marks_display_bn: e.target.value }))}
                />
                <OutlinedInput
                  label="Search questions"
                  value={bankQ}
                  onChange={(e) => setBankQ(e.target.value)}
                />
                <OutlinedSelect
                  label="Sub-part question from bank"
                  required
                  value={partForm.question_id}
                  onChange={(e) => setPartForm((f) => ({ ...f, question_id: e.target.value }))}
                >
                  {bank.map((q) => (
                    <option key={q.id} value={q.id}>
                      [{q.question_type_code}] {truncate(q.body_en, 80)}
                    </option>
                  ))}
                </OutlinedSelect>
                <Button type="submit" size="sm" disabled={compositeQuestions.length === 0}>
                  {editPartId ? 'Update sub-part' : 'Add sub-part'}
                </Button>
                {compositeQuestions.length === 0 && (
                  <p className="text-xs text-muted">
                    Add a composite question first, then attach sub-parts under its header.
                  </p>
                )}
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {groups.map((group) => (
        <Card key={group.id}>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="text-lg">
                Section {group.group_number}: {group.name}
              </CardTitle>
              <p className="text-sm text-muted">
                {group.marks} marks{group.instructions ? ` · ${group.instructions}` : ''}
              </p>
            </div>
            {!readOnly && (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPanel('section');
                    setEditSectionId(group.id);
                    setSectionForm({
                      name: group.name,
                      group_number: group.group_number,
                      marks: group.marks,
                      instructions: group.instructions ?? '',
                    });
                  }}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => deleteItem('section', group.id, `section "${group.name}"`)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openNewQuestionForm({ paper_group_id: group.id })}
                >
                  <Plus className="h-3 w-3" /> Q
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {group.questions.length === 0 ? (
              <p className="text-sm text-muted">No questions in this section.</p>
            ) : (
              group.questions.map((pq) => renderQuestionRow(pq, group.id))
            )}
          </CardContent>
        </Card>
      ))}

      {(ungrouped_questions.length > 0 || (!readOnly && groups.length === 0)) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Ungrouped questions</CardTitle>
            {!readOnly && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => openNewQuestionForm()}
              >
                <Plus className="h-3 w-3" /> Add
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {ungrouped_questions.length === 0 ? (
              <p className="text-sm text-muted">Add sections or place questions here.</p>
            ) : (
              ungrouped_questions.map((pq) => renderQuestionRow(pq))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
