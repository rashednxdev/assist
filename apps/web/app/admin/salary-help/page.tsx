'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import type {
  SalaryCalcGuide,
  SalaryCircularRecord,
  SalaryCircularWriteDto,
  SalaryFaqRecord,
  SalaryFaqStatus,
  SalaryFaqWriteDto,
  SalaryTrNotice,
} from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Skeleton } from '@/components/ui/skeleton';

const fieldClass =
  'flex w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30';

const EMPTY_FAQ: SalaryFaqWriteDto = {
  question_bn: '',
  question_en: '',
  answer_bn: '',
  answer_en: '',
  status: 'published',
  pinned: false,
  circular_ids: [],
};

const EMPTY_CIRCULAR: SalaryCircularWriteDto = {
  title_bn: '',
  title_en: '',
  circular_no: '',
  publish_date: '',
  source_url: '',
  source_name: '',
  summary_bn: '',
  summary_en: '',
  is_published: true,
};

function questionLabel(row: Pick<SalaryFaqRecord, 'question_bn' | 'question_en'>): string {
  return row.question_bn.trim() || row.question_en.trim();
}

function circularLabel(row: Pick<SalaryCircularRecord, 'title_bn' | 'title_en'>): string {
  return row.title_bn.trim() || row.title_en.trim();
}

function statusBadge(status: SalaryFaqStatus) {
  if (status === 'published') return <Badge variant="success">Published</Badge>;
  if (status === 'pending') return <Badge variant="warning">Waiting for answer</Badge>;
  return <Badge variant="destructive">Rejected</Badge>;
}

export default function SalaryHelpAdminPage() {
  const [tab, setTab] = useState<'questions' | 'circulars' | 'guide' | 'tr'>('questions');
  const [faqs, setFaqs] = useState<SalaryFaqRecord[]>([]);
  const [circulars, setCirculars] = useState<SalaryCircularRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [faqQuery, setFaqQuery] = useState('');
  const [faqStatus, setFaqStatus] = useState<'all' | SalaryFaqStatus>('all');
  const [faqId, setFaqId] = useState<string | null>(null);
  const [faqForm, setFaqForm] = useState<SalaryFaqWriteDto>(EMPTY_FAQ);
  const [faqSaving, setFaqSaving] = useState(false);
  const [showFaqForm, setShowFaqForm] = useState(false);
  const [circularId, setCircularId] = useState<string | null>(null);
  const [circularForm, setCircularForm] = useState<SalaryCircularWriteDto>(EMPTY_CIRCULAR);
  const [circularSaving, setCircularSaving] = useState(false);
  const [showCircularForm, setShowCircularForm] = useState(false);
  const [guideBn, setGuideBn] = useState('');
  const [guideEn, setGuideEn] = useState('');
  const [guideSaving, setGuideSaving] = useState(false);
  const [trBodyBn, setTrBodyBn] = useState('');
  const [trBodyEn, setTrBodyEn] = useState('');
  const [trConfirmBn, setTrConfirmBn] = useState('');
  const [trConfirmEn, setTrConfirmEn] = useState('');
  const [trSaving, setTrSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiFetch<{ data: SalaryFaqRecord[] }>('/salary/admin/help/questions'),
      apiFetch<{ data: SalaryCircularRecord[] }>('/salary/admin/help/circulars'),
      apiFetch<{ data: SalaryCalcGuide }>('/salary/admin/help/guide'),
      apiFetch<{ data: SalaryTrNotice }>('/salary/admin/help/tr-notice'),
    ])
      .then(([faqRes, circularRes, guideRes, trRes]) => {
        setFaqs(faqRes.data);
        setCirculars(circularRes.data);
        setGuideBn(guideRes.data.body_bn);
        setGuideEn(guideRes.data.body_en);
        setTrBodyBn(trRes.data.body_bn);
        setTrBodyEn(trRes.data.body_en);
        setTrConfirmBn(trRes.data.confirm_bn);
        setTrConfirmEn(trRes.data.confirm_en);
        setError('');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load salary help'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const next = new URLSearchParams(window.location.search).get('tab');
    if (next === 'guide' || next === 'circulars' || next === 'questions' || next === 'tr') setTab(next);
  }, [load]);

  const pendingCount = faqs.filter((row) => row.status === 'pending').length;
  const visibleFaqs = useMemo(() => {
    const q = faqQuery.trim().toLowerCase();
    return faqs.filter((row) => {
      if (faqStatus !== 'all' && row.status !== faqStatus) return false;
      if (!q) return true;
      return [row.question_bn, row.question_en, row.answer_bn, row.answer_en, row.asker_name].join(' ').toLowerCase().includes(q);
    });
  }, [faqQuery, faqStatus, faqs]);

  function editFaq(row: SalaryFaqRecord, asAnswer = false) {
    setTab('questions');
    setShowFaqForm(true);
    setFaqId(row.id);
    setFaqForm({
      question_bn: row.question_bn,
      question_en: row.question_en,
      answer_bn: row.answer_bn,
      answer_en: row.answer_en,
      status: asAnswer ? 'published' : row.status,
      pinned: row.pinned,
      circular_ids: row.circular_ids,
    });
    setNotice('');
    document.getElementById('salary-faq-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function editCircular(row: SalaryCircularRecord) {
    setTab('circulars');
    setShowCircularForm(true);
    setCircularId(row.id);
    setCircularForm({
      title_bn: row.title_bn,
      title_en: row.title_en,
      circular_no: row.circular_no,
      publish_date: row.publish_date,
      source_url: row.source_url,
      source_name: row.source_name,
      summary_bn: row.summary_bn,
      summary_en: row.summary_en,
      is_published: row.is_published,
    });
    setNotice('');
    document.getElementById('salary-circular-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function saveFaq(event: React.FormEvent) {
    event.preventDefault();
    setFaqSaving(true);
    setError('');
    setNotice('');
    try {
      const path = faqId ? `/salary/admin/help/questions/${faqId}` : '/salary/admin/help/questions';
      await apiFetch(path, { method: faqId ? 'PUT' : 'POST', body: JSON.stringify(faqForm) });
      setFaqId(null);
      setFaqForm(EMPTY_FAQ);
      setShowFaqForm(false);
      setNotice(faqId ? 'Question updated.' : 'Question saved.');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the question');
    } finally {
      setFaqSaving(false);
    }
  }

  async function saveCircular(event: React.FormEvent) {
    event.preventDefault();
    setCircularSaving(true);
    setError('');
    setNotice('');
    try {
      const path = circularId ? `/salary/admin/help/circulars/${circularId}` : '/salary/admin/help/circulars';
      await apiFetch(path, { method: circularId ? 'PUT' : 'POST', body: JSON.stringify(circularForm) });
      setCircularId(null);
      setCircularForm(EMPTY_CIRCULAR);
      setShowCircularForm(false);
      setNotice(circularId ? 'Circular updated.' : 'Circular saved.');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the circular');
    } finally {
      setCircularSaving(false);
    }
  }

  async function removeFaq(row: SalaryFaqRecord) {
    if (!window.confirm(`Delete this question?\n\n${questionLabel(row)}`)) return;
    setError('');
    try {
      await apiFetch(`/salary/admin/help/questions/${row.id}`, { method: 'DELETE' });
      if (faqId === row.id) {
        setFaqId(null);
        setFaqForm(EMPTY_FAQ);
        setShowFaqForm(false);
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the question');
    }
  }

  async function removeCircular(row: SalaryCircularRecord) {
    if (!window.confirm(`Delete this circular?\n\n${circularLabel(row)}`)) return;
    setError('');
    try {
      await apiFetch(`/salary/admin/help/circulars/${row.id}`, { method: 'DELETE' });
      if (circularId === row.id) {
        setCircularId(null);
        setCircularForm(EMPTY_CIRCULAR);
        setShowCircularForm(false);
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the circular');
    }
  }

  async function saveGuide(event: React.FormEvent) {
    event.preventDefault();
    setGuideSaving(true);
    setError('');
    setNotice('');
    try {
      const res = await apiFetch<{ data: SalaryCalcGuide }>('/salary/admin/help/guide', {
        method: 'PUT',
        body: JSON.stringify({ body_bn: guideBn, body_en: guideEn }),
      });
      setGuideBn(res.data.body_bn);
      setGuideEn(res.data.body_en);
      setNotice('Calculation instructions saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the instructions');
    } finally {
      setGuideSaving(false);
    }
  }

  async function saveTrNotice(event: React.FormEvent) {
    event.preventDefault();
    setTrSaving(true);
    setError('');
    setNotice('');
    try {
      const res = await apiFetch<{ data: SalaryTrNotice }>('/salary/admin/help/tr-notice', {
        method: 'PUT',
        body: JSON.stringify({
          body_bn: trBodyBn,
          body_en: trBodyEn,
          confirm_bn: trConfirmBn,
          confirm_en: trConfirmEn,
        }),
      });
      setTrBodyBn(res.data.body_bn);
      setTrBodyEn(res.data.body_en);
      setTrConfirmBn(res.data.confirm_bn);
      setTrConfirmEn(res.data.confirm_en);
      setNotice('T.R. Form notice saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the T.R. Form notice');
    } finally {
      setTrSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Salary help"
        description="Questions and circulars appear on the salary page. Instructions open from the Instructions button. Bangla is shown first; English is used when Bangla is empty."
      />

      {error ? <Alert variant="error">{error}</Alert> : null}
      {notice ? <Alert variant="success">{notice}</Alert> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={tab === 'questions' ? 'default' : 'outline'} onClick={() => setTab('questions')}>
          Questions
          {pendingCount > 0 ? (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">{pendingCount} waiting</span>
          ) : null}
        </Button>
        <Button type="button" variant={tab === 'circulars' ? 'default' : 'outline'} onClick={() => setTab('circulars')}>
          Circulars
        </Button>
        <Button type="button" variant={tab === 'guide' ? 'default' : 'outline'} onClick={() => setTab('guide')}>
          Instructions
        </Button>
        <Button type="button" variant={tab === 'tr' ? 'default' : 'outline'} onClick={() => setTab('tr')}>
          T.R. Form notice
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : tab === 'tr' ? (
        <form onSubmit={(event) => void saveTrNotice(event)} className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div>
            <h2 className="text-base font-semibold">Before the T.R. Form</h2>
            <p className="mt-1 text-sm text-muted">
              Shown after Download T.R. Form, before the name and office form. The user must tick the confirmation text to continue.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Information (Bangla)</Label>
            <RichTextEditor value={trBodyBn} onChange={setTrBodyBn} placeholder="টি.আর. ফরম নেওয়ার আগে যা পড়তে হবে…" />
          </div>
          <div className="space-y-2">
            <Label>Information (English)</Label>
            <RichTextEditor value={trBodyEn} onChange={setTrBodyEn} placeholder="What the user must read before the T.R. Form…" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <Label>Confirmation text (Bangla)</Label>
              <textarea
                className={`${fieldClass} min-h-20`}
                maxLength={500}
                value={trConfirmBn}
                onChange={(event) => setTrConfirmBn(event.target.value)}
                placeholder="আমি উপরের তথ্য পড়েছি এবং সম্মত।"
              />
            </label>
            <label className="space-y-1.5">
              <Label>Confirmation text (English)</Label>
              <textarea
                className={`${fieldClass} min-h-20`}
                maxLength={500}
                value={trConfirmEn}
                onChange={(event) => setTrConfirmEn(event.target.value)}
                placeholder="I have read the above and agree to continue."
              />
            </label>
          </div>
          <Button type="submit" disabled={trSaving}>
            {trSaving ? 'Saving…' : 'Save T.R. Form notice'}
          </Button>
        </form>
      ) : tab === 'guide' ? (
        <form onSubmit={(event) => void saveGuide(event)} className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div>
            <h2 className="text-base font-semibold">Instructions</h2>
            <p className="mt-1 text-sm text-muted">
              Shown from the Instructions button under Salary Help. Use headings, lists, alignment, and emphasis.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Instructions (Bangla)</Label>
            <RichTextEditor value={guideBn} onChange={setGuideBn} placeholder="বেতন ও বকেয়া হিসাবের নির্দেশনা লিখুন…" />
          </div>
          <div className="space-y-2">
            <Label>Instructions (English)</Label>
            <RichTextEditor value={guideEn} onChange={setGuideEn} placeholder="Write how salary and arrears are calculated…" />
          </div>
          <Button type="submit" disabled={guideSaving}>
            {guideSaving ? 'Saving…' : 'Save instructions'}
          </Button>
        </form>
      ) : tab === 'questions' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {(['all', 'pending', 'published', 'rejected'] as const).map((status) => (
                <Button key={status} type="button" size="sm" variant={faqStatus === status ? 'default' : 'outline'} onClick={() => setFaqStatus(status)}>
                  {status === 'all' ? 'All' : status === 'pending' ? 'Waiting' : status[0]?.toUpperCase() + status.slice(1)}
                </Button>
              ))}
            </div>
            <Button
              type="button"
              onClick={() => {
                setShowFaqForm(true);
                setFaqId(null);
                setFaqForm(EMPTY_FAQ);
              }}
            >
              <Plus className="h-4 w-4" />
              Add question
            </Button>
          </div>

          {showFaqForm ? (
            <form id="salary-faq-form" onSubmit={(event) => void saveFaq(event)} className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold">{faqId ? 'Edit question' : 'New question'}</h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowFaqForm(false);
                    setFaqId(null);
                    setFaqForm(EMPTY_FAQ);
                  }}
                >
                  Cancel
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <Label>Question (Bangla)</Label>
                  <textarea className={`${fieldClass} min-h-20`} value={faqForm.question_bn} onChange={(e) => setFaqForm({ ...faqForm, question_bn: e.target.value })} />
                </label>
                <label className="space-y-1.5">
                  <Label>Question (English)</Label>
                  <textarea className={`${fieldClass} min-h-20`} value={faqForm.question_en} onChange={(e) => setFaqForm({ ...faqForm, question_en: e.target.value })} />
                </label>
                <label className="space-y-1.5">
                  <Label>Answer (Bangla)</Label>
                  <textarea className={`${fieldClass} min-h-28`} value={faqForm.answer_bn} onChange={(e) => setFaqForm({ ...faqForm, answer_bn: e.target.value })} />
                </label>
                <label className="space-y-1.5">
                  <Label>Answer (English)</Label>
                  <textarea className={`${fieldClass} min-h-28`} value={faqForm.answer_en} onChange={(e) => setFaqForm({ ...faqForm, answer_en: e.target.value })} />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="space-y-1.5">
                  <Label>Status</Label>
                  <select className={fieldClass} value={faqForm.status} onChange={(e) => setFaqForm({ ...faqForm, status: e.target.value as SalaryFaqStatus })}>
                    <option value="published">Published</option>
                    <option value="pending">Waiting for answer</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </label>
                <label className="mt-6 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={faqForm.pinned} onChange={(e) => setFaqForm({ ...faqForm, pinned: e.target.checked })} />
                  Pin to the top
                </label>
              </div>
              {circulars.length > 0 ? (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Linked circulars</legend>
                  <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-border p-2">
                    {circulars.map((circular) => {
                      const checked = faqForm.circular_ids.includes(circular.id);
                      return (
                        <label key={circular.id} className="flex items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...faqForm.circular_ids, circular.id]
                                : faqForm.circular_ids.filter((id) => id !== circular.id);
                              setFaqForm({ ...faqForm, circular_ids: next });
                            }}
                          />
                          <span>
                            {circularLabel(circular)}
                            {!circular.is_published ? <span className="text-slate-500"> (draft)</span> : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ) : (
                <p className="text-sm text-muted">Add a circular first if this answer should link to a source.</p>
              )}
              <Button type="submit" disabled={faqSaving}>
                {faqSaving ? 'Saving…' : faqId ? 'Update question' : 'Save question'}
              </Button>
            </form>
          ) : null}

          <Input value={faqQuery} onChange={(e) => setFaqQuery(e.target.value)} placeholder="Search questions" />

          {visibleFaqs.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">No questions in this view.</p>
          ) : (
            <ul className="space-y-2">
              {visibleFaqs.map((row) => (
                <li key={row.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {statusBadge(row.status)}
                        {row.pinned ? <Badge>Pinned</Badge> : null}
                        {row.asker_name ? <span className="text-xs text-muted">Asked by {row.asker_name}</span> : null}
                      </div>
                      <p className="font-semibold text-foreground">{questionLabel(row)}</p>
                      {row.answer_bn || row.answer_en ? (
                        <p className="line-clamp-2 text-sm text-muted">{row.answer_bn.trim() || row.answer_en.trim()}</p>
                      ) : (
                        <p className="text-sm text-amber-700">No answer yet.</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {row.status === 'pending' ? (
                        <Button type="button" size="sm" onClick={() => editFaq(row, true)}>
                          Answer
                        </Button>
                      ) : null}
                      <Button type="button" size="sm" variant="outline" onClick={() => editFaq(row)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => void removeFaq(row)}>
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => {
                setShowCircularForm(true);
                setCircularId(null);
                setCircularForm(EMPTY_CIRCULAR);
              }}
            >
              <Plus className="h-4 w-4" />
              Add circular
            </Button>
          </div>

          {showCircularForm ? (
            <form id="salary-circular-form" onSubmit={(event) => void saveCircular(event)} className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold">{circularId ? 'Edit circular' : 'New circular'}</h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCircularForm(false);
                    setCircularId(null);
                    setCircularForm(EMPTY_CIRCULAR);
                  }}
                >
                  Cancel
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 sm:col-span-2">
                  <Label>Name (Bangla)</Label>
                  <Input value={circularForm.title_bn} onChange={(e) => setCircularForm({ ...circularForm, title_bn: e.target.value })} />
                </label>
                <label className="space-y-1.5 sm:col-span-2">
                  <Label>Name (English)</Label>
                  <Input value={circularForm.title_en} onChange={(e) => setCircularForm({ ...circularForm, title_en: e.target.value })} />
                </label>
                <label className="space-y-1.5">
                  <Label>Circular / memo no.</Label>
                  <Input value={circularForm.circular_no} onChange={(e) => setCircularForm({ ...circularForm, circular_no: e.target.value })} placeholder="07.00.0000.000.00.000.26.00" />
                </label>
                <label className="space-y-1.5">
                  <Label>Publish date</Label>
                  <Input type="date" value={circularForm.publish_date} onChange={(e) => setCircularForm({ ...circularForm, publish_date: e.target.value })} required />
                </label>
                <label className="space-y-1.5">
                  <Label>Issuing authority</Label>
                  <Input
                    value={circularForm.source_name}
                    onChange={(e) => setCircularForm({ ...circularForm, source_name: e.target.value })}
                    placeholder="Finance Division"
                    required
                  />
                </label>
                <label className="space-y-1.5">
                  <Label>Source link</Label>
                  <Input
                    value={circularForm.source_url}
                    onChange={(e) => setCircularForm({ ...circularForm, source_url: e.target.value })}
                    placeholder="https://mof.gov.bd/..."
                    required
                  />
                </label>
                <label className="space-y-1.5">
                  <Label>Short note (Bangla)</Label>
                  <textarea
                    className={`${fieldClass} min-h-20`}
                    value={circularForm.summary_bn}
                    onChange={(e) => setCircularForm({ ...circularForm, summary_bn: e.target.value })}
                    placeholder="What this circular changes for salary"
                  />
                </label>
                <label className="space-y-1.5">
                  <Label>Short note (English)</Label>
                  <textarea
                    className={`${fieldClass} min-h-20`}
                    value={circularForm.summary_en}
                    onChange={(e) => setCircularForm({ ...circularForm, summary_en: e.target.value })}
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={circularForm.is_published}
                  onChange={(e) => setCircularForm({ ...circularForm, is_published: e.target.checked })}
                />
                Show on the salary page
              </label>
              <Button type="submit" disabled={circularSaving}>
                {circularSaving ? 'Saving…' : circularId ? 'Update circular' : 'Save circular'}
              </Button>
            </form>
          ) : null}

          {circulars.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">No circulars yet.</p>
          ) : (
            <ul className="space-y-2">
              {circulars.map((row) => (
                <li key={row.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        {row.is_published ? <Badge variant="success">On salary page</Badge> : <Badge variant="secondary">Draft</Badge>}
                        <span>{row.publish_date.split('-').reverse().join('-')}</span>
                        {row.circular_no ? <span>{row.circular_no}</span> : null}
                        <span>{row.source_name}</span>
                      </div>
                      <p className="font-semibold">{circularLabel(row)}</p>
                      {row.summary_bn || row.summary_en ? <p className="text-sm text-muted">{row.summary_bn.trim() || row.summary_en.trim()}</p> : null}
                      <a href={row.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                        Open source
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => editCircular(row)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => void removeCircular(row)}>
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
