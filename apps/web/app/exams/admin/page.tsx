'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookMarked, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { confirmDelete } from '@/lib/confirm-action';
import { AUTHORITY_TYPES } from '@ibas/shared-constants';
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

type Step = 'department' | 'authority' | 'exam' | 'part' | 'type' | 'subject';
type FormMode = 'create' | 'edit';

interface DepartmentRow {
  id: string;
  name: string;
  short_name: string;
  location?: string;
  website?: string;
}

interface AuthorityRow {
  id: string;
  name: string;
  department_id: string;
  department_name?: string;
  authority_type: string;
}

interface ExamRow {
  id: string;
  name: string;
  name_bn?: string;
  short_name: string;
  short_name_bn?: string;
  authority_id: string;
  authority_name?: string;
  registration_fee: number;
  goal?: string;
}

interface PartRow {
  id: string;
  name: string;
  name_bn?: string;
  part_number: number;
  total_marks: number;
  total_marks_bn?: string;
  pass_marks: number;
  pass_marks_bn?: string;
  exam_name_id: string;
}

interface TypeRow {
  id: string;
  name: string;
  code?: string;
  total_marks: number;
  pass_marks: number;
  total_time: number;
  exam_name_id: string;
}

interface SubjectRow {
  id: string;
  name: string;
  name_bn?: string;
  total_marks: number;
  total_marks_bn?: string;
  pass_marks: number;
  pass_marks_bn?: string;
  exam_part_id: string;
  exam_type_id: string;
  exam_type_name?: string;
}

interface OverviewTree {
  department: DepartmentRow | null;
  authority: AuthorityRow | null;
  exam: ExamRow;
  parts: (PartRow & { subjects: SubjectRow[] })[];
  types: TypeRow[];
}

const STEPS: Step[] = ['department', 'authority', 'exam', 'part', 'type', 'subject'];

const emptyDept = { name: '', short_name: '', location: '', website: '' };
const emptyAuth = { name: '', authority_type: 'central' as (typeof AUTHORITY_TYPES)[number], contact_email: '', contact_phone: '' };
const emptyExam = { name: '', name_bn: '', short_name: '', short_name_bn: '', registration_fee: 500, goal: '', description: '' };
const emptyPart = {
  name: '',
  name_bn: '',
  part_number: 1,
  total_marks: 100,
  total_marks_bn: '',
  pass_marks: 40,
  pass_marks_bn: '',
  description: '',
};
const emptyType = { name: 'Written', code: 'WRITTEN', total_marks: 100, pass_marks: 40, total_time: 180 };
const emptySubject = { name: '', name_bn: '', total_marks: 100, total_marks_bn: '', pass_marks: 40, pass_marks_bn: '' };

export default function ExamsAdminPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [step, setStep] = useState<Step>('department');
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [editId, setEditId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [authorities, setAuthorities] = useState<AuthorityRow[]>([]);
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [parts, setParts] = useState<PartRow[]>([]);
  const [types, setTypes] = useState<TypeRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);

  const [selectedDept, setSelectedDept] = useState('');
  const [selectedAuth, setSelectedAuth] = useState('');
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedPart, setSelectedPart] = useState('');
  const [selectedType, setSelectedType] = useState('');

  const [deptForm, setDeptForm] = useState(emptyDept);
  const [authForm, setAuthForm] = useState(emptyAuth);
  const [examForm, setExamForm] = useState(emptyExam);
  const [partForm, setPartForm] = useState(emptyPart);
  const [typeForm, setTypeForm] = useState(emptyType);
  const [subjectForm, setSubjectForm] = useState(emptySubject);

  const [overviewExamId, setOverviewExamId] = useState('');
  const [overview, setOverview] = useState<OverviewTree | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const loadOverview = useCallback(async (examId: string) => {
    if (!examId) {
      setOverview(null);
      return;
    }
    setOverviewLoading(true);
    try {
      const r = await apiFetch<{ data: OverviewTree }>(`/exams/names/${examId}/tree`);
      setOverview(r.data);
      setSelectedExam(examId);
      setSelectedAuth(r.data.exam.authority_id);
      if (r.data.department) setSelectedDept(r.data.department.id);
      await Promise.all([
        r.data.department ? loadAuthorities(r.data.department.id) : Promise.resolve(),
        loadExams(r.data.exam.authority_id),
        loadParts(examId),
        loadTypes(examId),
      ]);
      const allSubs = r.data.parts.flatMap((p) => p.subjects);
      setSubjects(allSubs);
    } catch {
      setOverview(null);
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe()
      .then(async (res) => {
        const admin =
          res.data.is_super_admin || res.data.user_type === 'system_admin' || res.data.user_type === 'admin';
        setAllowed(admin);
        if (!admin) {
          router.replace('/exams');
          return;
        }
        const deptRes = await apiFetch<{ data: DepartmentRow[] }>('/exams/departments');
        setDepartments(deptRes.data);
        const [examRes, authRes] = await Promise.all([
          apiFetch<{ data: ExamRow[] }>('/exams/names'),
          apiFetch<{ data: AuthorityRow[] }>('/exams/authorities'),
        ]);
        setExams(examRes.data);
        setAuthorities(authRes.data);
        if (examRes.data[0]) {
          setOverviewExamId(examRes.data[0].id);
          await loadOverview(examRes.data[0].id);
        }
      })
      .catch(() => router.replace('/login'));
  }, [router, loadOverview]);

  async function loadAuthorities(deptId: string) {
    const r = await apiFetch<{ data: AuthorityRow[] }>(`/exams/authorities?department_id=${deptId}`);
    setAuthorities(r.data);
  }

  async function loadExams(authId: string) {
    const r = await apiFetch<{ data: ExamRow[] }>(`/exams/names?authority_id=${authId}`);
    setExams(r.data);
  }

  async function loadParts(examId: string) {
    const r = await apiFetch<{ data: PartRow[] }>(`/exams/names/${examId}/parts`);
    setParts(r.data);
    const subs: SubjectRow[] = [];
    for (const p of r.data) {
      const sr = await apiFetch<{ data: SubjectRow[] }>(`/exams/parts/${p.id}/subjects`);
      subs.push(...sr.data);
    }
    setSubjects(subs);
  }

  async function loadTypes(examId: string) {
    const r = await apiFetch<{ data: TypeRow[] }>(`/exams/names/${examId}/types`);
    setTypes(r.data);
  }

  function resetStepForm(s: Step) {
    setEditId('');
    setFormMode('create');
    if (s === 'department') setDeptForm(emptyDept);
    if (s === 'authority') setAuthForm(emptyAuth);
    if (s === 'exam') setExamForm(emptyExam);
    if (s === 'part') setPartForm(emptyPart);
    if (s === 'type') setTypeForm(emptyType);
    if (s === 'subject') setSubjectForm(emptySubject);
  }

  function goToStep(s: Step) {
    setStep(s);
    resetStepForm(s);
  }

  async function loadForEdit(s: Step, id: string) {
    setEditId(id);
    setFormMode('edit');
    setError('');
    if (s === 'department') {
      const r = await apiFetch<{ data: DepartmentRow }>(`/exams/departments/${id}`);
      setDeptForm({
        name: r.data.name,
        short_name: r.data.short_name,
        location: r.data.location ?? '',
        website: r.data.website ?? '',
      });
      setSelectedDept(id);
    } else if (s === 'authority') {
      const r = await apiFetch<{ data: AuthorityRow & { contact_email?: string; contact_phone?: string } }>(
        `/exams/authorities/${id}`,
      );
      setAuthForm({
        name: r.data.name,
        authority_type: r.data.authority_type as typeof emptyAuth.authority_type,
        contact_email: r.data.contact_email ?? '',
        contact_phone: r.data.contact_phone ?? '',
      });
      setSelectedDept(r.data.department_id);
      await loadAuthorities(r.data.department_id);
    } else if (s === 'exam') {
      const r = await apiFetch<{ data: ExamRow & { description?: string } }>(`/exams/names/${id}`);
      setExamForm({
        name: r.data.name,
        name_bn: r.data.name_bn ?? '',
        short_name: r.data.short_name,
        short_name_bn: r.data.short_name_bn ?? '',
        registration_fee: r.data.registration_fee,
        goal: r.data.goal ?? '',
        description: r.data.description ?? '',
      });
      setSelectedAuth(r.data.authority_id);
      setSelectedExam(id);
      setOverviewExamId(id);
      await loadExams(r.data.authority_id);
    } else if (s === 'part') {
      const r = await apiFetch<{ data: PartRow & { description?: string } }>(`/exams/parts/${id}`);
      setPartForm({
        name: r.data.name,
        name_bn: r.data.name_bn ?? '',
        part_number: r.data.part_number,
        total_marks: r.data.total_marks,
        total_marks_bn: r.data.total_marks_bn ?? '',
        pass_marks: r.data.pass_marks,
        pass_marks_bn: r.data.pass_marks_bn ?? '',
        description: r.data.description ?? '',
      });
      setSelectedExam(r.data.exam_name_id);
      setSelectedPart(id);
      await loadParts(r.data.exam_name_id);
    } else if (s === 'type') {
      const r = await apiFetch<{ data: TypeRow }>(`/exams/types/${id}`);
      setTypeForm({
        name: r.data.name,
        code: r.data.code ?? '',
        total_marks: r.data.total_marks,
        pass_marks: r.data.pass_marks,
        total_time: r.data.total_time,
      });
      setSelectedExam(r.data.exam_name_id);
      setSelectedType(id);
      await loadTypes(r.data.exam_name_id);
    } else if (s === 'subject') {
      const r = await apiFetch<{ data: SubjectRow }>(`/exams/subjects/${id}`);
      setSubjectForm({
        name: r.data.name,
        name_bn: r.data.name_bn ?? '',
        total_marks: r.data.total_marks,
        total_marks_bn: r.data.total_marks_bn ?? '',
        pass_marks: r.data.pass_marks,
        pass_marks_bn: r.data.pass_marks_bn ?? '',
      });
      setSelectedPart(r.data.exam_part_id);
      setSelectedType(r.data.exam_type_id);
    }
  }

  async function submitStep(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const isEdit = formMode === 'edit' && editId;

      if (step === 'department') {
        const body = {
          name: deptForm.name,
          short_name: deptForm.short_name,
          location: deptForm.location || undefined,
          website: deptForm.website || undefined,
        };
        const r = isEdit
          ? await apiFetch<{ data: DepartmentRow }>(`/exams/departments/${editId}`, { method: 'PATCH', body: JSON.stringify(body) })
          : await apiFetch<{ data: DepartmentRow }>('/exams/departments', { method: 'POST', body: JSON.stringify(body) });
        const list = await apiFetch<{ data: DepartmentRow[] }>('/exams/departments');
        setDepartments(list.data);
        setSelectedDept(r.data.id);
        await loadAuthorities(r.data.id);
        setMessage(isEdit ? 'Department updated' : 'Department saved');
        if (!isEdit) goToStep('authority');
      } else if (step === 'authority') {
        if (!selectedDept) throw new Error('Select a department');
        const body = {
          ...authForm,
          department_id: selectedDept,
          contact_email: authForm.contact_email || undefined,
          contact_phone: authForm.contact_phone || undefined,
        };
        const r = isEdit
          ? await apiFetch<{ data: AuthorityRow }>(`/exams/authorities/${editId}`, { method: 'PATCH', body: JSON.stringify(body) })
          : await apiFetch<{ data: AuthorityRow }>('/exams/authorities', { method: 'POST', body: JSON.stringify(body) });
        await loadAuthorities(selectedDept);
        setSelectedAuth(r.data.id);
        await loadExams(r.data.id);
        setMessage(isEdit ? 'Authority updated' : 'Authority saved');
        if (!isEdit) goToStep('exam');
      } else if (step === 'exam') {
        if (!selectedAuth) throw new Error('Select an authority');
        const body = {
          ...examForm,
          authority_id: selectedAuth,
          name_bn: examForm.name_bn.trim() || undefined,
          short_name_bn: examForm.short_name_bn.trim() || undefined,
          goal: examForm.goal || undefined,
          description: examForm.description || undefined,
        };
        const r = isEdit
          ? await apiFetch<{ data: ExamRow }>(`/exams/names/${editId}`, { method: 'PATCH', body: JSON.stringify(body) })
          : await apiFetch<{ data: ExamRow }>('/exams/names', { method: 'POST', body: JSON.stringify(body) });
        const allExams = await apiFetch<{ data: ExamRow[] }>('/exams/names');
        setExams(allExams.data);
        setSelectedExam(r.data.id);
        setOverviewExamId(r.data.id);
        await Promise.all([loadParts(r.data.id), loadTypes(r.data.id), loadOverview(r.data.id)]);
        setMessage(isEdit ? 'Exam program updated' : 'Exam program saved');
        if (!isEdit) goToStep('part');
      } else if (step === 'part') {
        if (!selectedExam) throw new Error('Select an exam');
        const body = {
          ...partForm,
          exam_name_id: selectedExam,
          name_bn: partForm.name_bn.trim() || undefined,
          total_marks_bn: partForm.total_marks_bn.trim() || undefined,
          pass_marks_bn: partForm.pass_marks_bn.trim() || undefined,
          description: partForm.description || undefined,
        };
        const r = isEdit
          ? await apiFetch<{ data: PartRow }>(`/exams/parts/${editId}`, { method: 'PATCH', body: JSON.stringify(body) })
          : await apiFetch<{ data: PartRow }>('/exams/parts', { method: 'POST', body: JSON.stringify(body) });
        await loadParts(selectedExam);
        setSelectedPart(r.data.id);
        if (overviewExamId) await loadOverview(overviewExamId);
        setMessage(isEdit ? 'Exam part updated' : 'Exam part saved');
        if (!isEdit) goToStep('type');
      } else if (step === 'type') {
        if (!selectedExam) throw new Error('Select an exam');
        const body = { ...typeForm, exam_name_id: selectedExam, code: typeForm.code || undefined };
        const r = isEdit
          ? await apiFetch<{ data: TypeRow }>(`/exams/types/${editId}`, { method: 'PATCH', body: JSON.stringify(body) })
          : await apiFetch<{ data: TypeRow }>('/exams/types', { method: 'POST', body: JSON.stringify(body) });
        await loadTypes(selectedExam);
        setSelectedType(r.data.id);
        if (overviewExamId) await loadOverview(overviewExamId);
        setMessage(isEdit ? 'Exam type updated' : 'Exam type saved');
        if (!isEdit) goToStep('subject');
      } else if (step === 'subject') {
        if (!selectedPart || !selectedType) throw new Error('Select part and type');
        const body = {
          ...subjectForm,
          exam_part_id: selectedPart,
          exam_type_id: selectedType,
          name_bn: subjectForm.name_bn.trim() || undefined,
          total_marks_bn: subjectForm.total_marks_bn.trim() || undefined,
          pass_marks_bn: subjectForm.pass_marks_bn.trim() || undefined,
        };
        const r = isEdit
          ? await apiFetch<{ data: SubjectRow }>(`/exams/subjects/${editId}`, { method: 'PATCH', body: JSON.stringify(body) })
          : await apiFetch<{ data: { id: string } }>('/exams/subjects', { method: 'POST', body: JSON.stringify(body) });
        if (overviewExamId) await loadOverview(overviewExamId);
        setMessage(isEdit ? 'Subject updated' : 'Subject created');
        if (!isEdit) router.push(`/exams/subjects/${r.data.id}/syllabus`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function deleteRecord(s: Step, id: string, label: string) {
    if (!confirmDelete(label)) return;
    const paths: Record<Step, string> = {
      department: `/exams/departments/${id}`,
      authority: `/exams/authorities/${id}`,
      exam: `/exams/names/${id}`,
      part: `/exams/parts/${id}`,
      type: `/exams/types/${id}`,
      subject: `/exams/subjects/${id}`,
    };
    setBusy(true);
    setError('');
    try {
      await apiFetch(paths[s], { method: 'DELETE' });
      setMessage('Removed');
      resetStepForm(s);
      if (s === 'department') {
        const list = await apiFetch<{ data: DepartmentRow[] }>('/exams/departments');
        setDepartments(list.data);
      } else if (s === 'authority' && selectedDept) {
        await loadAuthorities(selectedDept);
      } else if (s === 'exam') {
        const allExams = await apiFetch<{ data: ExamRow[] }>('/exams/names');
        setExams(allExams.data);
        if (overviewExamId === id) {
          setOverviewExamId('');
          setOverview(null);
        }
      } else if (s === 'part' && selectedExam) {
        await loadParts(selectedExam);
      } else if (s === 'type' && selectedExam) {
        await loadTypes(selectedExam);
      } else if (s === 'subject' && selectedPart) {
        const subs = await apiFetch<{ data: SubjectRow[] }>(`/exams/parts/${selectedPart}/subjects`);
        setSubjects(subs.data);
      }
      if (overviewExamId) await loadOverview(overviewExamId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  if (allowed === null) return null;

  function editPicker(s: Step, items: { id: string; label: string }[]) {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1.5 rounded-lg border border-dashed border-border p-3">
        <Label htmlFor={`edit-${s}`}>Edit existing</Label>
        <select
          id={`edit-${s}`}
          value={formMode === 'edit' ? editId : ''}
          onChange={(e) => {
            if (e.target.value) loadForEdit(s, e.target.value);
            else resetStepForm(s);
          }}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">— Select to edit —</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
        {formMode === 'edit' && editId && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-red-600"
            disabled={busy}
            onClick={() => {
              const item = items.find((i) => i.id === editId);
              deleteRecord(s, editId, item?.label ?? s);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete selected
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exam setup wizard"
        description="Create, view, and update department → authority → exam → part → type → subject."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/exams">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Eye className="h-5 w-5" />
              Entered data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="overview-exam">View exam program</Label>
              <select
                id="overview-exam"
                value={overviewExamId}
                onChange={(e) => {
                  setOverviewExamId(e.target.value);
                  loadOverview(e.target.value);
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">— Select exam —</option>
                {exams.map((x) => (
                  <option key={x.id} value={x.id}>{x.short_name} — {x.name}</option>
                ))}
              </select>
            </div>

            {overviewLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : overview ? (
              <div className="space-y-3 text-sm">
                {overview.department && (
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="font-semibold text-foreground">Department</div>
                    <div>{overview.department.name}</div>
                    <Badge variant="outline" className="mt-1">{overview.department.short_name}</Badge>
                    <div className="mt-2 flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => {
                          goToStep('department');
                          loadForEdit('department', overview.department!.id);
                        }}
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-red-600"
                        onClick={() => deleteRecord('department', overview.department!.id, overview.department!.name)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                {overview.authority && (
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="font-semibold">Authority</div>
                    <div>{overview.authority.name}</div>
                    <Badge variant="secondary" className="mt-1">{overview.authority.authority_type}</Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="mt-2 h-7 px-2"
                      onClick={() => {
                        goToStep('authority');
                        loadForEdit('authority', overview.authority!.id);
                      }}
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                  </div>
                )}
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="font-semibold">Exam</div>
                  <div>{overview.exam.name}</div>
                  {overview.exam.name_bn && (
                    <div className="text-sm text-muted">{overview.exam.name_bn}</div>
                  )}
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="outline">{overview.exam.short_name}</Badge>
                    {overview.exam.short_name_bn && (
                      <Badge variant="outline">{overview.exam.short_name_bn}</Badge>
                    )}
                    <Badge variant="outline">৳{overview.exam.registration_fee}</Badge>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="mt-2 h-7 px-2"
                    onClick={() => {
                      goToStep('exam');
                      loadForEdit('exam', overview.exam.id);
                    }}
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </Button>
                </div>
                {overview.types.map((t) => (
                  <div key={t.id} className="rounded-lg border border-border p-2">
                    <span className="font-medium">Type:</span> {t.name}
                    {t.code && <Badge variant="outline" className="ml-2">{t.code}</Badge>}
                    <span className="ml-2 text-muted">{t.total_time} min</span>
                    <Button type="button" size="sm" variant="ghost" className="ml-1 h-7 px-2" onClick={() => { goToStep('type'); loadForEdit('type', t.id); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {overview.parts.map((p) => (
                  <div key={p.id} className="rounded-lg border border-border p-3">
                    <div className="font-medium">Part {p.part_number}: {p.name}</div>
                    {p.name_bn && <div className="text-sm text-muted">{p.name_bn}</div>}
                    <div className="text-muted">
                      {p.total_marks} marks · pass {p.pass_marks}
                      {(p.total_marks_bn || p.pass_marks_bn) && (
                        <span>
                          {' '}
                          ({[p.total_marks_bn, p.pass_marks_bn].filter(Boolean).join(' · ')})
                        </span>
                      )}
                    </div>
                    <Button type="button" size="sm" variant="ghost" className="mt-1 h-7 px-2" onClick={() => { goToStep('part'); loadForEdit('part', p.id); }}>
                      <Pencil className="h-3 w-3" /> Edit part
                    </Button>
                    {p.subjects.length > 0 && (
                      <ul className="mt-2 space-y-1 border-t border-border pt-2">
                        {p.subjects.map((s) => (
                          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                            <span>
                              {s.name}
                              {s.name_bn ? ` (${s.name_bn})` : ''} ({s.total_marks}m
                              {s.total_marks_bn ? ` / ${s.total_marks_bn}` : ''}
                              {s.pass_marks_bn ? `, pass ${s.pass_marks_bn}` : ''})
                            </span>
                            <div className="flex gap-1">
                              <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => { goToStep('subject'); loadForEdit('subject', s.id); }}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button asChild size="sm" variant="outline" className="h-7 px-2">
                                <Link href={`/exams/subjects/${s.id}/syllabus`}>
                                  <BookMarked className="h-3 w-3" />
                                </Link>
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">Select an exam to view its full setup hierarchy.</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-3">
          <div className="flex flex-wrap gap-2">
            {STEPS.map((s) => (
              <Button key={s} size="sm" variant={step === s ? 'default' : 'outline'} onClick={() => goToStep(s)}>
                {s}
              </Button>
            ))}
          </div>

          {message && <Alert variant="success">{message}</Alert>}
          {error && <Alert variant="error">{error}</Alert>}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="capitalize">{step.replace('_', ' ')}</CardTitle>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={formMode === 'create' ? 'default' : 'outline'}
                  onClick={() => resetStepForm(step)}
                >
                  <Plus className="h-4 w-4" /> New
                </Button>
                <Badge variant={formMode === 'edit' ? 'default' : 'outline'}>
                  {formMode === 'edit' ? 'Editing' : 'Creating'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitStep} className="space-y-4">
                {step === 'department' && (
                  <>
                    {editPicker('department', departments.map((d) => ({ id: d.id, label: `${d.short_name} — ${d.name}` })))}
                    <div className="space-y-1.5">
                      <Label htmlFor="dept-name">Department name</Label>
                      <Input id="dept-name" value={deptForm.name} onChange={(e) => setDeptForm((f) => ({ ...f, name: e.target.value }))} required />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="dept-short">Short name</Label>
                        <Input id="dept-short" value={deptForm.short_name} onChange={(e) => setDeptForm((f) => ({ ...f, short_name: e.target.value }))} required />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="dept-location">Location</Label>
                        <Input id="dept-location" value={deptForm.location} onChange={(e) => setDeptForm((f) => ({ ...f, location: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="dept-website">Website</Label>
                      <Input id="dept-website" type="url" placeholder="https://example.gov.bd" value={deptForm.website} onChange={(e) => setDeptForm((f) => ({ ...f, website: e.target.value }))} />
                    </div>
                  </>
                )}

                {step === 'authority' && (
                  <>
                    {editPicker('authority', authorities.map((a) => ({ id: a.id, label: a.name })))}
                    <div className="space-y-1.5">
                      <Label htmlFor="auth-dept">Department</Label>
                      <select
                        id="auth-dept"
                        required
                        value={selectedDept}
                        onChange={(e) => {
                          setSelectedDept(e.target.value);
                          loadAuthorities(e.target.value);
                        }}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Select department</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="auth-name">Authority name</Label>
                      <Input id="auth-name" value={authForm.name} onChange={(e) => setAuthForm((f) => ({ ...f, name: e.target.value }))} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="auth-type">Authority type</Label>
                      <select
                        id="auth-type"
                        value={authForm.authority_type}
                        onChange={(e) => setAuthForm((f) => ({ ...f, authority_type: e.target.value as typeof f.authority_type }))}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {AUTHORITY_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="auth-email">Contact email</Label>
                        <Input id="auth-email" type="email" value={authForm.contact_email} onChange={(e) => setAuthForm((f) => ({ ...f, contact_email: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="auth-phone">Contact phone</Label>
                        <Input id="auth-phone" value={authForm.contact_phone} onChange={(e) => setAuthForm((f) => ({ ...f, contact_phone: e.target.value }))} />
                      </div>
                    </div>
                  </>
                )}

                {step === 'exam' && (
                  <>
                    {editPicker('exam', exams.map((x) => ({ id: x.id, label: `${x.short_name} — ${x.name}` })))}
                    <div className="space-y-1.5">
                      <Label htmlFor="exam-auth">Authority</Label>
                      <select
                        id="exam-auth"
                        required
                        value={selectedAuth}
                        onChange={(e) => {
                          setSelectedAuth(e.target.value);
                          loadExams(e.target.value);
                        }}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Select authority</option>
                        {authorities.map((a) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="exam-name">Exam name</Label>
                      <Input id="exam-name" value={examForm.name} onChange={(e) => setExamForm((f) => ({ ...f, name: e.target.value }))} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="exam-name-bn">Exam name (Bangla)</Label>
                      <Input id="exam-name-bn" value={examForm.name_bn} onChange={(e) => setExamForm((f) => ({ ...f, name_bn: e.target.value }))} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="exam-short">Short name</Label>
                        <Input id="exam-short" value={examForm.short_name} onChange={(e) => setExamForm((f) => ({ ...f, short_name: e.target.value }))} required />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="exam-short-bn">Short name (Bangla)</Label>
                        <Input id="exam-short-bn" value={examForm.short_name_bn} onChange={(e) => setExamForm((f) => ({ ...f, short_name_bn: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="exam-fee">Registration fee (BDT)</Label>
                      <Input id="exam-fee" type="number" value={examForm.registration_fee} onChange={(e) => setExamForm((f) => ({ ...f, registration_fee: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="exam-goal">Goal</Label>
                      <Input id="exam-goal" value={examForm.goal} onChange={(e) => setExamForm((f) => ({ ...f, goal: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="exam-desc">Description</Label>
                      <Input id="exam-desc" value={examForm.description} onChange={(e) => setExamForm((f) => ({ ...f, description: e.target.value }))} placeholder="Brief description of the exam program" />
                    </div>
                  </>
                )}

                {step === 'part' && (
                  <>
                    {editPicker('part', parts.map((p) => ({ id: p.id, label: `Part ${p.part_number}: ${p.name}` })))}
                    <div className="space-y-1.5">
                      <Label htmlFor="part-exam">Exam program</Label>
                      <select
                        id="part-exam"
                        required
                        value={selectedExam}
                        onChange={(e) => {
                          setSelectedExam(e.target.value);
                          loadParts(e.target.value);
                        }}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Select exam</option>
                        {exams.map((x) => (
                          <option key={x.id} value={x.id}>{x.short_name} — {x.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="part-name">Part name</Label>
                      <Input id="part-name" value={partForm.name} onChange={(e) => setPartForm((f) => ({ ...f, name: e.target.value }))} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="part-name-bn">Part name (Bangla)</Label>
                      <Input id="part-name-bn" value={partForm.name_bn} onChange={(e) => setPartForm((f) => ({ ...f, name_bn: e.target.value }))} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="part-number">Part number</Label>
                        <Input id="part-number" type="number" min={1} value={partForm.part_number} onChange={(e) => setPartForm((f) => ({ ...f, part_number: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="part-total">Total marks</Label>
                        <Input id="part-total" type="number" min={0} value={partForm.total_marks} onChange={(e) => setPartForm((f) => ({ ...f, total_marks: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="part-pass">Pass marks</Label>
                        <Input id="part-pass" type="number" min={0} value={partForm.pass_marks} onChange={(e) => setPartForm((f) => ({ ...f, pass_marks: Number(e.target.value) }))} />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="part-total-bn">Total marks (Bangla)</Label>
                        <Input id="part-total-bn" value={partForm.total_marks_bn} onChange={(e) => setPartForm((f) => ({ ...f, total_marks_bn: e.target.value }))} placeholder="e.g. ১০০" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="part-pass-bn">Pass marks (Bangla)</Label>
                        <Input id="part-pass-bn" value={partForm.pass_marks_bn} onChange={(e) => setPartForm((f) => ({ ...f, pass_marks_bn: e.target.value }))} placeholder="e.g. ৪০" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="part-desc">Description</Label>
                      <Input id="part-desc" value={partForm.description} onChange={(e) => setPartForm((f) => ({ ...f, description: e.target.value }))} placeholder="Part overview or instructions for candidates" />
                    </div>
                  </>
                )}

                {step === 'type' && (
                  <>
                    {editPicker('type', types.map((t) => ({ id: t.id, label: `${t.name}${t.code ? ` (${t.code})` : ''}` })))}
                    <div className="space-y-1.5">
                      <Label htmlFor="type-exam">Exam program</Label>
                      <select
                        id="type-exam"
                        required
                        value={selectedExam}
                        onChange={(e) => {
                          setSelectedExam(e.target.value);
                          loadTypes(e.target.value);
                        }}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Select exam</option>
                        {exams.map((x) => (
                          <option key={x.id} value={x.id}>{x.short_name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="type-name">Type name</Label>
                        <Input id="type-name" value={typeForm.name} onChange={(e) => setTypeForm((f) => ({ ...f, name: e.target.value }))} required />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="type-code">Code</Label>
                        <Input id="type-code" value={typeForm.code} onChange={(e) => setTypeForm((f) => ({ ...f, code: e.target.value }))} placeholder="e.g. WRITTEN" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="type-total">Total marks</Label>
                        <Input id="type-total" type="number" min={0} value={typeForm.total_marks} onChange={(e) => setTypeForm((f) => ({ ...f, total_marks: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="type-pass">Pass marks</Label>
                        <Input id="type-pass" type="number" min={0} value={typeForm.pass_marks} onChange={(e) => setTypeForm((f) => ({ ...f, pass_marks: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="type-duration">Duration (minutes)</Label>
                        <Input id="type-duration" type="number" min={1} value={typeForm.total_time} onChange={(e) => setTypeForm((f) => ({ ...f, total_time: Number(e.target.value) }))} />
                      </div>
                    </div>
                  </>
                )}

                {step === 'subject' && (
                  <>
                    {editPicker('subject', subjects.map((s) => ({ id: s.id, label: s.name })))}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="subj-part">Exam part</Label>
                        <select
                          id="subj-part"
                          required
                          value={selectedPart}
                          onChange={(e) => setSelectedPart(e.target.value)}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="">Select part</option>
                          {parts.map((p) => (
                            <option key={p.id} value={p.id}>Part {p.part_number}: {p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="subj-type">Exam type</Label>
                        <select
                          id="subj-type"
                          required
                          value={selectedType}
                          onChange={(e) => setSelectedType(e.target.value)}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="">Select type</option>
                          {types.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="subj-name">Subject name</Label>
                      <Input id="subj-name" value={subjectForm.name} onChange={(e) => setSubjectForm((f) => ({ ...f, name: e.target.value }))} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="subj-name-bn">Subject name (Bangla)</Label>
                      <Input id="subj-name-bn" value={subjectForm.name_bn} onChange={(e) => setSubjectForm((f) => ({ ...f, name_bn: e.target.value }))} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="subj-total">Total marks</Label>
                        <Input id="subj-total" type="number" min={0} value={subjectForm.total_marks} onChange={(e) => setSubjectForm((f) => ({ ...f, total_marks: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="subj-pass">Pass marks</Label>
                        <Input id="subj-pass" type="number" min={0} value={subjectForm.pass_marks} onChange={(e) => setSubjectForm((f) => ({ ...f, pass_marks: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="subj-total-bn">Total marks (Bangla)</Label>
                        <Input id="subj-total-bn" value={subjectForm.total_marks_bn} onChange={(e) => setSubjectForm((f) => ({ ...f, total_marks_bn: e.target.value }))} placeholder="e.g. ১০০" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="subj-pass-bn">Pass marks (Bangla)</Label>
                        <Input id="subj-pass-bn" value={subjectForm.pass_marks_bn} onChange={(e) => setSubjectForm((f) => ({ ...f, pass_marks_bn: e.target.value }))} placeholder="e.g. ৪০" />
                      </div>
                    </div>
                  </>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={busy}>
                    {busy ? 'Saving…' : formMode === 'edit' ? 'Update' : step === 'subject' ? 'Create & open syllabus' : 'Save & continue'}
                  </Button>
                  {formMode === 'edit' && (
                    <Button type="button" variant="outline" onClick={() => resetStepForm(step)}>
                      Cancel edit
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
