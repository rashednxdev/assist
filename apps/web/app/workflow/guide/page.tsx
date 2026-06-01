'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { RoleBadge } from '@/components/workflow/role-badge';
import { RunFieldInput } from '@/components/workflow/run-field-input';

interface TaskItem {
  id: string;
  name_en: string;
  total_steps: number;
  is_published?: boolean;
}

interface RunDetail {
  run: {
    id: string;
    status: string;
    current_step: number;
    current_role: string;
    task_name_en: string;
    rejection_reason?: string;
  };
  current_step: {
    step_number: number;
    title_en: string;
    description_en: string;
    role_code: string;
    fields: Array<{ name: string; label: string; type: string; required: boolean; placeholder?: string; options?: string[] }>;
    handoff_msg?: string;
    condition_text?: string;
  } | null;
  can_act: boolean;
  can_reject?: boolean;
  can_cancel?: boolean;
  steps: Array<{ step_number: number; title_en: string; role_code: string }>;
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'warning' {
  if (status === 'completed') return 'default';
  if (status === 'rejected' || status === 'cancelled') return 'destructive';
  return 'secondary';
}

function GuideContent() {
  const searchParams = useSearchParams();
  const preselectedTask = searchParams.get('task');
  const preselectedRun = searchParams.get('run');

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(preselectedTask);
  const [runDetail, setRunDetail] = useState<RunDetail | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [fiscalYear, setFiscalYear] = useState('2025-26');
  const [month, setMonth] = useState('June');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ data: TaskItem[] }>('/workflow/tasks').then((r) => {
      const published = r.data.filter((t) => t.is_published !== false);
      setTasks(published);
      if (preselectedTask) setSelectedTaskId(preselectedTask);
    });
  }, [preselectedTask]);

  useEffect(() => {
    if (!preselectedRun) return;
    setLoading(true);
    apiFetch<{ data: RunDetail }>(`/workflow/runs/${preselectedRun}`)
      .then((r) => setRunDetail(r.data))
      .finally(() => setLoading(false));
  }, [preselectedRun]);

  async function startRun() {
    if (!selectedTaskId) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{ data: RunDetail }>(`/workflow/tasks/${selectedTaskId}/runs`, {
        method: 'POST',
        body: JSON.stringify({ fiscal_year: fiscalYear, month, office_code: 'HQ-001' }),
      });
      setRunDetail(res.data);
      setFieldValues({});
      setMessage('Run started');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start run');
    } finally {
      setLoading(false);
    }
  }

  async function submitStep(action: 'submit' | 'reject' = 'submit') {
    if (!runDetail?.current_step) return;
    if (action === 'reject' && !rejectRemarks.trim()) {
      setError('Remarks are required when rejecting');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{ data: RunDetail }>(
        `/workflow/runs/${runDetail.run.id}/steps/${runDetail.current_step.step_number}/respond`,
        {
          method: 'POST',
          body: JSON.stringify({
            action,
            field_responses: action === 'submit' ? fieldValues : undefined,
            remarks: action === 'reject' ? rejectRemarks : undefined,
          }),
        },
      );
      setRunDetail(res.data);
      setFieldValues({});
      setRejectRemarks('');
      setShowReject(false);
      const status = res.data.run.status;
      setMessage(
        status === 'completed'
          ? 'Task completed!'
          : status === 'rejected'
            ? 'Run rejected'
            : `Step ${res.data.current_step?.step_number ?? ''} ready`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit step');
    } finally {
      setLoading(false);
    }
  }

  async function cancelRun() {
    if (!runDetail) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{ data: RunDetail }>(`/workflow/runs/${runDetail.run.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason || undefined }),
      });
      setRunDetail(res.data);
      setShowCancel(false);
      setCancelReason('');
      setMessage('Run cancelled');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel run');
    } finally {
      setLoading(false);
    }
  }

  const progress = runDetail
    ? Math.round(((runDetail.run.current_step - 1) / runDetail.steps.length) * 100)
    : 0;

  const terminal = runDetail && ['completed', 'rejected', 'cancelled'].includes(runDetail.run.status);

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Select task</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tasks.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setSelectedTaskId(t.id);
                setRunDetail(null);
                setMessage('');
                setError('');
              }}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                selectedTaskId === t.id ? 'border-primary bg-primary-muted' : 'border-border hover:bg-slate-50'
              }`}
            >
              {t.name_en}
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Run guide</CardTitle>
          {runDetail && (
            <Badge variant={statusVariant(runDetail.run.status)}>{runDetail.run.status}</Badge>
          )}
        </CardHeader>
        <CardContent>
          {message && <Alert variant="success" className="mb-3">{message}</Alert>}
          {error && <Alert variant="error" className="mb-3">{error}</Alert>}

          {!runDetail ? (
            <div className="space-y-4">
              <p className="text-sm text-muted">Start a new run for the selected task.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Fiscal year</Label>
                  <Input value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Month</Label>
                  <Input value={month} onChange={(e) => setMonth(e.target.value)} />
                </div>
              </div>
              <Button onClick={startRun} disabled={!selectedTaskId || loading}>
                Start run
              </Button>
            </div>
          ) : (
            <div>
              <div className="mb-4">
                <div className="mb-1 flex justify-between text-xs text-muted">
                  <span>{runDetail.run.task_name_en}</span>
                  <span>
                    Step {runDetail.run.current_step} of {runDetail.steps.length}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>

              {runDetail.run.status === 'completed' && (
                <p className="text-lg font-semibold text-primary">Task completed successfully.</p>
              )}

              {runDetail.run.status === 'rejected' && (
                <Alert variant="error">
                  Run rejected
                  {runDetail.run.rejection_reason && `: ${runDetail.run.rejection_reason}`}
                </Alert>
              )}

              {runDetail.run.status === 'cancelled' && (
                <Alert variant="warning">
                  Run cancelled
                  {runDetail.run.rejection_reason && `: ${runDetail.run.rejection_reason}`}
                </Alert>
              )}

              {!terminal && runDetail.current_step && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <RoleBadge code={runDetail.current_step.role_code} />
                    <h3 className="text-lg font-semibold">{runDetail.current_step.title_en}</h3>
                  </div>
                  <p className="text-sm text-muted">{runDetail.current_step.description_en}</p>
                  {runDetail.current_step.condition_text && (
                    <Alert variant="warning">Condition: {runDetail.current_step.condition_text}</Alert>
                  )}

                  {runDetail.current_step.fields.length > 0 && (
                    <div className="space-y-3">
                      {runDetail.current_step.fields.map((f) => (
                        <RunFieldInput
                          key={f.name}
                          field={f}
                          value={fieldValues[f.name] ?? ''}
                          disabled={!runDetail.can_act}
                          onChange={(v) => setFieldValues({ ...fieldValues, [f.name]: v })}
                        />
                      ))}
                    </div>
                  )}

                  {runDetail.current_step.handoff_msg && (
                    <div className="rounded-xl border border-primary/30 bg-primary-muted px-3 py-2 text-sm">
                      <div className="font-semibold text-primary">After this step</div>
                      {runDetail.current_step.handoff_msg}
                    </div>
                  )}

                  {runDetail.can_act ? (
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => submitStep('submit')} disabled={loading}>
                        Submit step
                      </Button>
                      {runDetail.can_reject && (
                        <Button variant="outline" onClick={() => setShowReject(!showReject)} disabled={loading}>
                          Reject
                        </Button>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted">
                      Waiting for role <strong>{runDetail.run.current_role}</strong> to act.
                    </p>
                  )}

                  {showReject && runDetail.can_reject && (
                    <div className="rounded-xl border border-border p-4 space-y-3">
                      <Label>Rejection remarks *</Label>
                      <textarea
                        className="ibas-textarea"
                        value={rejectRemarks}
                        onChange={(e) => setRejectRemarks(e.target.value)}
                        placeholder="Reason for rejection"
                      />
                      <div className="flex gap-2">
                        <Button variant="destructive" size="sm" onClick={() => submitStep('reject')} disabled={loading}>
                          Confirm reject
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setShowReject(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!terminal && runDetail.can_cancel && (
                <div className="mt-6 border-t border-border pt-4">
                  {!showCancel ? (
                    <Button variant="ghost" size="sm" className="text-muted" onClick={() => setShowCancel(true)}>
                      Cancel run
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <Label>Cancel reason (optional)</Label>
                      <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
                      <div className="flex gap-2">
                        <Button variant="destructive" size="sm" onClick={cancelRun} disabled={loading}>
                          Confirm cancel
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setShowCancel(false)}>
                          Back
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function WorkflowGuidePage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Run guide" description="Execute a task step by step — submit, reject, or cancel." />
      <Suspense fallback={<p className="text-muted">Loading...</p>}>
        <GuideContent />
      </Suspense>
    </div>
  );
}
