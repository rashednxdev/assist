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
    session_year?: string;
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

type Panel = 'section' | 'question';

const emptySection = { name: '', group_number: 1, marks: 0, instructions: '' };
const emptyQuestion = {
  paper_group_id: '',
  from_question_bank: false,
  question_id: '',
  header_text: '',
  question_number: 1,
  display_question_number: '',
  marks: 0,
  marks_display_bn: '',
  is_compulsory: true,
};

function displayQuestionLabel(pq: PaperQuestionRow) {
  return pq.display_question_number?.trim() || String(pq.question_number);
}

function questionInlineText(pq: PaperQuestionRow): string | null {
  if (pq.header_text?.trim()) return pq.header_text.trim();
  if (!pq.from_question_bank && pq.parts.length === 1) {
    return pq.parts[0]?.question?.body_en ?? null;
  }
  if (pq.from_question_bank && pq.question?.body_en) return pq.question.body_en;
  return null;
}

function showPartsList(pq: PaperQuestionRow) {
  if (pq.parts.length === 0) return false;
  if (pq.header_text?.trim()) return true;
  return pq.parts.length > 1;
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

const PART_LABEL_ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

function partLabelForIndex(index: number): string {
  const letter = PART_LABEL_ALPHABET[index];
  return letter ? `(${letter})` : `(${index + 1})`;
}

function nextPartLabels(existingLabels: string[], count: number): string[] {
  const used = new Set(existingLabels.map((l) => l.trim().toLowerCase()));
  const labels: string[] = [];
  for (let i = 0; i < PART_LABEL_ALPHABET.length && labels.length < count; i++) {
    const label = partLabelForIndex(i);
    if (!used.has(label.toLowerCase())) {
      labels.push(label);
      used.add(label.toLowerCase());
    }
  }
  return labels;
}

function questionFormFromRow(pq: PaperQuestionRow, groupId?: string) {
  return {
    paper_group_id: groupId ?? '',
    from_question_bank: pq.from_question_bank,
    question_id: pq.question_id ?? '',
    header_text: pq.header_text ?? '',
    question_number: pq.question_number,
    display_question_number: pq.display_question_number ?? '',
    marks: pq.marks,
    marks_display_bn: pq.marks_display_bn ?? '',
    is_compulsory: pq.is_compulsory,
  };
}


const emptyPartEdit = { part_label: '(a)', marks: 1, marks_display_bn: '', question_id: '' };

interface PartDraft {
  question_id: string;
  part_label: string;
  marks: number;
  marks_display_bn: string;
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
  const [partBank, setPartBank] = useState<BankQuestion[]>([]);
  const [partBankQ, setPartBankQ] = useState('');
  const [partDrafts, setPartDrafts] = useState<PartDraft[]>([]);
  const [partBusy, setPartBusy] = useState(false);

  const [sectionForm, setSectionForm] = useState(emptySection);
  const [editSectionId, setEditSectionId] = useState('');
  const [questionForm, setQuestionForm] = useState(emptyQuestion);
  const [editQuestionId, setEditQuestionId] = useState('');
  const [editPartId, setEditPartId] = useState('');
  const [partEditForm, setPartEditForm] = useState(emptyPartEdit);

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
    if (panel !== 'question') return;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ is_published: 'true', limit: '50' });
      if (partBankQ.trim()) params.set('q', partBankQ.trim());
      apiFetch<{ data: BankQuestion[] }>(`/questions?${params.toString()}`)
        .then((r) => setPartBank(r.data))
        .catch(() => setPartBank([]));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [partBankQ, panel]);

  useEffect(() => {
    setPartDrafts([]);
    setEditPartId('');
    setPartEditForm(emptyPartEdit);
  }, [editQuestionId]);

  function clearEdits() {
    setEditSectionId('');
    setEditQuestionId('');
    setEditPartId('');
    setPartEditForm(emptyPartEdit);
    setSectionForm(emptySection);
    setQuestionForm(emptyQuestion);
    setPartDrafts([]);
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

    const editingParent = editQuestionId
      ? getAllQuestions(data).find((q) => q.id === editQuestionId)
      : undefined;
    const existingPartCount = editingParent?.parts.length ?? 0;
    const hasHeader = Boolean(questionForm.header_text.trim());
    const hasNewParts = partDrafts.length > 0;

    const isLegacyBank = Boolean(editingParent?.from_question_bank && editingParent.question_id);

    if (!hasHeader && !hasNewParts && existingPartCount === 0 && !isLegacyBank) {
      setError('Add an optional header and/or at least one sub-part from the question bank');
      return;
    }

    if (hasNewParts) {
      const existingLabels = new Set(
        (editingParent?.parts ?? []).map((p) => p.part_label.trim().toLowerCase()),
      );
      const seen = new Set<string>();
      for (const draft of partDrafts) {
        const key = draft.part_label.trim().toLowerCase();
        if (!key) {
          setError('Every sub-part needs a label');
          return;
        }
        if (existingLabels.has(key) || seen.has(key)) {
          setError(`Part label "${draft.part_label}" is already used — use a different label`);
          return;
        }
        seen.add(key);
      }
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
    const wasCreate = !editQuestionId;
    try {
      const body: Record<string, unknown> = {
        header_text: questionForm.header_text.trim() || undefined,
        paper_group_id: questionForm.paper_group_id || undefined,
        question_number: questionForm.question_number,
        display_question_number: questionForm.display_question_number.trim() || undefined,
        marks: questionForm.marks,
        marks_display_bn: questionForm.marks_display_bn.trim() || undefined,
        is_compulsory: questionForm.is_compulsory,
      };
      if (wasCreate || !editingParent?.from_question_bank) {
        body.from_question_bank = false;
      }
      let targetId = editQuestionId;
      if (targetId) {
        await apiFetch(`/papers/questions/${targetId}`, { method: 'PATCH', body: JSON.stringify(body) });
        if (!wasCreate) setMessage('Question updated');
      } else {
        const res = await apiFetch<{ data: { id: string } }>(`/papers/${paperId}/questions`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        targetId = res.data.id;
        setEditQuestionId(res.data.id);
      }

      if (targetId && partDrafts.length > 0) {
        setPartBusy(true);
        for (const draft of partDrafts) {
          await apiFetch(`/papers/questions/${targetId}/parts`, {
            method: 'POST',
            body: JSON.stringify({
              question_id: draft.question_id,
              part_label: draft.part_label,
              marks: draft.marks,
              marks_display_bn: draft.marks_display_bn.trim() || undefined,
            }),
          });
        }
        setMessage(
          wasCreate
            ? `Question added with ${partDrafts.length} sub-part${partDrafts.length !== 1 ? 's' : ''}`
            : `Question updated with ${partDrafts.length} new sub-part${partDrafts.length !== 1 ? 's' : ''}`,
        );
        setPartDrafts([]);
        setPartBusy(false);
      } else if (wasCreate) {
        setMessage('Question added to paper');
      }

      const composeRes = await apiFetch<{ data: ComposeData }>(`/papers/${paperId}/compose`);
      const paperRes = await apiFetch<{ data: { allocated_marks?: number } }>(`/papers/${paperId}`);
      const nextData = {
        ...composeRes.data,
        paper: { ...composeRes.data.paper, allocated_marks: paperRes.data.allocated_marks },
      };
      setData(nextData);
      if (targetId) {
        const pq = getAllQuestions(nextData).find((q) => q.id === targetId);
        if (pq) {
          const groupId = nextData.groups.find((g) => g.questions.some((q) => q.id === pq.id))?.id;
          setQuestionForm(questionFormFromRow(pq, groupId));
          setEditQuestionId(pq.id);
          setPanel('question');
        }
      } else {
        clearEdits();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
      setPartBusy(false);
    }
  }

  async function savePartEdit() {
    if (!editQuestionId || !editPartId || !partEditForm.question_id) {
      setError('Select a sub-part question from the bank');
      return;
    }
    setError('');
    try {
      const body = {
        question_id: partEditForm.question_id,
        part_label: partEditForm.part_label,
        marks: partEditForm.marks,
        marks_display_bn: partEditForm.marks_display_bn.trim() || undefined,
      };
      await apiFetch(`/papers/parts/${editPartId}`, { method: 'PATCH', body: JSON.stringify(body) });
      setMessage('Sub-part updated');
      setEditPartId('');
      setPartEditForm(emptyPartEdit);
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
    const inline = questionInlineText(pq);
    return (
      <div key={pq.id} className="rounded-md border border-border bg-slate-50/80 p-3 text-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
              <span className="shrink-0 font-semibold">{displayNo}.</span>
              {inline && <span>{truncate(inline)}</span>}
              {pq.from_question_bank && pq.question?.question_type_code && (
                <Badge variant="secondary">{pq.question.question_type_code}</Badge>
              )}
            </div>
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
                  setEditPartId('');
                  setPartEditForm(emptyPartEdit);
                  setPartDrafts([]);
                  setQuestionForm(questionFormFromRow(pq, groupId));
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
        {showPartsList(pq) && (
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
                        setPanel('question');
                        setEditQuestionId(pq.id);
                        setEditPartId(part.id);
                        setPartEditForm({
                          part_label: part.part_label,
                          marks: part.marks,
                          marks_display_bn: part.marks_display_bn ?? '',
                          question_id: part.question_id,
                        });
                        setQuestionForm(questionFormFromRow(pq, groupId));
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

  const allQuestions = getAllQuestions(data);
  const editingQuestion = editQuestionId
    ? allQuestions.find((q) => q.id === editQuestionId)
    : undefined;
  const usedSubPartQuestionIds = new Set(editingQuestion?.parts.map((p) => p.question_id) ?? []);
  const availablePartQuestions = partBank.filter((q) => !usedSubPartQuestionIds.has(q.id));

  function openNewQuestionForm(overrides: Partial<typeof emptyQuestion> = {}) {
    setPanel('question');
    setEditQuestionId('');
    setQuestionForm(freshQuestionForm(allQuestions, overrides));
  }

  function addPartDraft(q: BankQuestion) {
    setPartDrafts((drafts) => {
      const existingLabels = [
        ...(editingQuestion?.parts.map((p) => p.part_label) ?? []),
        ...drafts.map((d) => d.part_label),
      ];
      const [label] = nextPartLabels(existingLabels, 1);
      return [
        ...drafts,
        {
          question_id: q.id,
          part_label: label ?? `(${existingLabels.length + 1})`,
          marks: q.marks,
          marks_display_bn: '',
        },
      ];
    });
  }

  function addAllPartDrafts(questions: BankQuestion[]) {
    setPartDrafts((drafts) => {
      const existingLabels = [
        ...(editingQuestion?.parts.map((p) => p.part_label) ?? []),
        ...drafts.map((d) => d.part_label),
      ];
      const already = new Set(drafts.map((d) => d.question_id));
      const toAdd = questions.filter((q) => !already.has(q.id));
      const labels = nextPartLabels(existingLabels, toAdd.length);
      return [
        ...drafts,
        ...toAdd.map((q, i) => ({
          question_id: q.id,
          part_label: labels[i] ?? `(${existingLabels.length + i + 1})`,
          marks: q.marks,
          marks_display_bn: '',
        })),
      ];
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={paper.name}
        description={`${paper.exam_short_name ?? ''} ${paper.exam_subject_name ?? ''}${paper.session_year ? ` · ${paper.session_year}` : ''} · ${paper.paper_type_name ?? 'Paper'}`.trim()}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/papers">
                <ArrowLeft className="h-4 w-4" />
                Papers
              </Link>
            </Button>
            {isAdmin && !paper.is_published && (
              <Button size="sm" onClick={publish} disabled={allQuestions.length === 0}>
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
          <span className="text-muted">
            Allocated: {allocated} / {paper.total_marks}
          </span>
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
              {(['section', 'question'] as Panel[]).map((p) => (
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
                  {p === 'section' ? 'Section' : 'Question'}
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
                    label="Marks (allocation, optional)"
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

                <OutlinedTextarea
                  label="Question header (optional — shown beside display number)"
                  value={questionForm.header_text}
                  onChange={(e) => setQuestionForm((f) => ({ ...f, header_text: e.target.value }))}
                  rows={3}
                />

                {editingQuestion && editingQuestion.parts.length > 0 && (
                  <div className="rounded-lg border border-border bg-slate-50/60 p-3">
                    <p className="mb-2 text-sm font-medium">Current sub-parts</p>
                    <ul className="space-y-1 text-sm text-muted">
                      {editingQuestion.parts.map((part) => (
                        <li key={part.id}>
                          <strong>{part.part_label}</strong> {truncate(part.question?.body_en ?? '', 80)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <OutlinedInput
                  label="Search published questions for sub-parts"
                  value={partBankQ}
                  onChange={(e) => setPartBankQ(e.target.value)}
                />
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted">
                    {questionForm.header_text.trim()
                      ? 'Add sub-parts under the header — label, marks & Bangla display are editable below'
                      : 'Without a header, the sub-part text appears beside the display number'}
                  </span>
                  {availablePartQuestions.length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() => addAllPartDrafts(availablePartQuestions)}
                    >
                      Select all
                    </Button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-surface">
                  {availablePartQuestions.length === 0 ? (
                    <p className="p-3 text-sm text-muted">
                      {partBank.length === 0
                        ? 'No published questions match your search'
                        : 'All matching questions are already sub-parts of this question'}
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {availablePartQuestions.map((q) => {
                        const checked = partDrafts.some((d) => d.question_id === q.id);
                        return (
                          <li key={q.id}>
                            <label className="flex cursor-pointer items-start gap-3 p-3 hover:bg-slate-50/80">
                              <input
                                type="checkbox"
                                className="mt-1"
                                checked={checked}
                                disabled={partBusy}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    addPartDraft(q);
                                  } else {
                                    setPartDrafts((drafts) =>
                                      drafts.filter((d) => d.question_id !== q.id),
                                    );
                                  }
                                }}
                              />
                              <span className="min-w-0 flex-1 text-sm">
                                <Badge variant="secondary" className="mr-1.5">
                                  {q.question_type_code}
                                </Badge>
                                {truncate(q.body_en, 120)}
                                <span className="mt-0.5 block text-xs text-muted">{q.marks} marks</span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {partDrafts.length > 0 && (
                  <div className="space-y-2 rounded-lg border border-border bg-slate-50/60 p-3">
                    <p className="text-sm font-medium">
                      New sub-part{partDrafts.length !== 1 ? 's' : ''} to add ({partDrafts.length})
                    </p>
                    {partDrafts.map((draft, i) => {
                      const bankQ = partBank.find((b) => b.id === draft.question_id);
                      return (
                        <div
                          key={draft.question_id}
                          className="space-y-2 rounded-md border border-border bg-surface p-2"
                        >
                          <p className="text-xs text-muted">{truncate(bankQ?.body_en ?? '', 100)}</p>
                          <div className="grid gap-2 sm:grid-cols-3">
                            <OutlinedInput
                              label="Part label"
                              value={draft.part_label}
                              onChange={(e) => {
                                const value = e.target.value;
                                setPartDrafts((drafts) =>
                                  drafts.map((d, idx) =>
                                    idx === i ? { ...d, part_label: value } : d,
                                  ),
                                );
                              }}
                            />
                            <OutlinedInput
                              label="Marks (allocation)"
                              type="number"
                              value={draft.marks}
                              onChange={(e) => {
                                const value = Number(e.target.value);
                                setPartDrafts((drafts) =>
                                  drafts.map((d, idx) => (idx === i ? { ...d, marks: value } : d)),
                                );
                              }}
                            />
                            <OutlinedInput
                              label="Marks display (Bangla)"
                              value={draft.marks_display_bn}
                              onChange={(e) => {
                                const value = e.target.value;
                                setPartDrafts((drafts) =>
                                  drafts.map((d, idx) =>
                                    idx === i ? { ...d, marks_display_bn: value } : d,
                                  ),
                                );
                              }}
                            />
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7"
                            onClick={() =>
                              setPartDrafts((drafts) => drafts.filter((_, idx) => idx !== i))
                            }
                          >
                            <X className="h-3 w-3" /> Remove
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {partDrafts.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={partBusy}
                    onClick={() => setPartDrafts([])}
                  >
                    Clear sub-part selection
                  </Button>
                )}

                {editPartId && (
                  <div className="space-y-3 rounded-lg border border-primary/30 bg-primary-muted/20 p-3">
                    <p className="text-sm font-medium">Edit sub-part</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <OutlinedInput
                        label="Part label (e.g. (a))"
                        value={partEditForm.part_label}
                        onChange={(e) =>
                          setPartEditForm((f) => ({ ...f, part_label: e.target.value }))
                        }
                        required
                      />
                      <OutlinedInput
                        label="Marks (allocation)"
                        type="number"
                        value={partEditForm.marks}
                        onChange={(e) =>
                          setPartEditForm((f) => ({ ...f, marks: Number(e.target.value) }))
                        }
                      />
                    </div>
                    <OutlinedInput
                      label="Marks display (Bangla)"
                      value={partEditForm.marks_display_bn}
                      onChange={(e) =>
                        setPartEditForm((f) => ({ ...f, marks_display_bn: e.target.value }))
                      }
                    />
                    <OutlinedSelect
                      label="Sub-part question from bank"
                      required
                      value={partEditForm.question_id}
                      onChange={(e) => {
                        const q = partBank.find((b) => b.id === e.target.value);
                        setPartEditForm((f) => ({
                          ...f,
                          question_id: e.target.value,
                          marks: q?.marks ?? f.marks,
                        }));
                      }}
                      size={Math.min(8, Math.max(3, partBank.length))}
                    >
                      {partBank.map((q) => (
                        <option key={q.id} value={q.id}>
                          [{q.question_type_code}] {truncate(q.body_en, 80)} ({q.marks}m)
                        </option>
                      ))}
                    </OutlinedSelect>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" onClick={savePartEdit}>
                        Update sub-part
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditPartId('');
                          setPartEditForm(emptyPartEdit);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                <Button type="submit" size="sm" disabled={partBusy}>
                  {editQuestionId
                    ? partDrafts.length > 0
                      ? `Save question + add ${partDrafts.length} sub-part${partDrafts.length !== 1 ? 's' : ''}`
                      : 'Update question'
                    : partDrafts.length > 0
                      ? `Save question + add ${partDrafts.length} sub-part${partDrafts.length !== 1 ? 's' : ''}`
                      : 'Save question'}
                </Button>
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
