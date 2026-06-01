'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import type { WorkflowField } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { generateTaskCode, moduleId, slugifyTaskCode } from '@/lib/workflow-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { Alert } from '@/components/ui/alert';
import { RoleBadge } from '@/components/workflow/role-badge';
import { FieldBuilder } from '@/components/workflow/field-builder';
import { FlowPreview } from '@/components/workflow/flow-preview';

interface TaskItem {
  id: string;
  name_en: string;
  module_name_en: string;
  total_steps: number;
  is_published: boolean;
}

interface StepItem {
  id: string;
  step_number: number;
  title_en: string;
  description_en: string;
  role_code: string;
  fields: WorkflowField[];
  condition_text?: string;
  handoff_msg?: string;
  handoff_role?: string;
  is_auto?: boolean;
}

interface RoleItem {
  code: string;
  name_en: string;
  color: string;
  is_system?: boolean;
}

interface ModuleItem {
  _id?: string;
  id?: string;
  code: string;
  name_en: string;
}

const emptyTaskForm = () => ({
  name_en: '',
  code: generateTaskCode(),
  module_id: '',
  description_en: '',
});

const emptyStepForm = () => ({
  title_en: '',
  description_en: '',
  role_code: 'SDO',
  condition_text: '',
  handoff_msg: '',
  handoff_role: '',
  is_auto: false,
  fields: [] as WorkflowField[],
});

export default function WorkflowAdminPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [steps, setSteps] = useState<StepItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [stepForm, setStepForm] = useState(emptyStepForm);

  const loadTasks = useCallback(() => {
    return apiFetch<{ data: TaskItem[] }>('/workflow/tasks').then((r) => setTasks(r.data));
  }, []);

  useEffect(() => {
    Promise.all([
      loadTasks(),
      apiFetch<{ data: RoleItem[] }>('/workflow/roles').then((r) => setRoles(r.data)),
      apiFetch<{ data: ModuleItem[] }>('/setup/modules').then((r) => {
        setModules(r.data);
        if (r.data.length > 0) {
          setTaskForm((prev) => ({
            ...prev,
            module_id: prev.module_id || moduleId(r.data[0]!),
          }));
        }
      }),
    ]).finally(() => setLoading(false));
  }, [loadTasks]);

  function clearFeedback() {
    setMessage('');
    setError('');
  }

  async function selectTask(id: string) {
    clearFeedback();
    setIsCreateMode(false);
    setSelectedId(id);
    setBusy(true);
    try {
      const res = await apiFetch<{
        data: {
          task: TaskItem & { module_id?: string; description_en?: string; code?: string };
          steps: StepItem[];
        };
      }>(`/workflow/tasks/${id}`);
      setTaskForm({
        name_en: res.data.task.name_en,
        code: res.data.task.code ?? '',
        module_id: res.data.task.module_id ?? '',
        description_en: res.data.task.description_en ?? '',
      });
      setSteps(res.data.steps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task');
    } finally {
      setBusy(false);
    }
  }

  function beginCreateTask() {
    clearFeedback();
    setSelectedId(null);
    setIsCreateMode(true);
    setSteps([]);
    const defaultModule = modules[0] ? moduleId(modules[0]) : '';
    setTaskForm({
      name_en: '',
      code: generateTaskCode(),
      module_id: defaultModule,
      description_en: '',
    });
  }

  function onTaskNameChange(name: string) {
    setTaskForm((prev) => ({ ...prev, name_en: name }));
  }

  async function createTask() {
    clearFeedback();
    if (!taskForm.name_en.trim()) {
      setError('Task name is required');
      return;
    }
    if (!taskForm.module_id) {
      setError('Select a module — run seed if the list is empty');
      return;
    }
    if (!taskForm.description_en.trim()) {
      setError('Description is required');
      return;
    }

    const code = (taskForm.code || slugifyTaskCode(taskForm.name_en) || generateTaskCode()).toUpperCase();
    setBusy(true);
    try {
      const res = await apiFetch<{ data: TaskItem & { id: string } }>('/workflow/tasks', {
        method: 'POST',
        body: JSON.stringify({
          name_en: taskForm.name_en.trim(),
          code,
          module_id: taskForm.module_id,
          description_en: taskForm.description_en.trim(),
        }),
      });
      await loadTasks();
      setMessage('Task created — add steps below, then publish');
      await selectTask(res.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setBusy(false);
    }
  }

  async function saveTask() {
    if (!selectedId) return;
    clearFeedback();
    if (!taskForm.name_en.trim()) {
      setError('Task name is required');
      return;
    }
    if (!taskForm.module_id) {
      setError('Select a module');
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, string> = {
        name_en: taskForm.name_en.trim(),
        module_id: taskForm.module_id,
        description_en: taskForm.description_en.trim() || taskForm.name_en.trim(),
      };
      if (taskForm.code.trim()) payload.code = taskForm.code.trim().toUpperCase();

      await apiFetch(`/workflow/tasks/${selectedId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      setMessage('Task saved');
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task');
    } finally {
      setBusy(false);
    }
  }

  async function publishTask() {
    if (!selectedId) return;
    clearFeedback();
    if (steps.length === 0) {
      setError('Add at least one step before publishing');
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/workflow/tasks/${selectedId}/publish`, { method: 'POST' });
      setMessage('Task published — visible in Tasks and Run guide');
      await loadTasks();
      await selectTask(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish task');
    } finally {
      setBusy(false);
    }
  }

  async function addStep() {
    if (!selectedId || !stepForm.title_en.trim()) return;
    clearFeedback();
    setBusy(true);
    try {
      await apiFetch(`/workflow/tasks/${selectedId}/steps`, {
        method: 'POST',
        body: JSON.stringify({
          title_en: stepForm.title_en.trim(),
          description_en: stepForm.description_en.trim() || stepForm.title_en.trim(),
          role_code: stepForm.role_code,
          fields: stepForm.fields,
          condition_text: stepForm.condition_text.trim() || undefined,
          handoff_msg: stepForm.handoff_msg.trim() || undefined,
          handoff_role: stepForm.handoff_role.trim() || undefined,
          is_auto: stepForm.is_auto,
        }),
      });
      setStepForm(emptyStepForm());
      await selectTask(selectedId);
      setMessage('Step added');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add step');
    } finally {
      setBusy(false);
    }
  }

  async function deleteStep(stepId: string) {
    if (!selectedId) return;
    clearFeedback();
    setBusy(true);
    try {
      await apiFetch(`/workflow/tasks/${selectedId}/steps/${stepId}`, { method: 'DELETE' });
      await selectTask(selectedId);
      setMessage('Step removed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove step');
    } finally {
      setBusy(false);
    }
  }

  async function moveStep(index: number, direction: -1 | 1) {
    if (!selectedId) return;
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    clearFeedback();
    const reordered = [...steps];
    [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
    setBusy(true);
    try {
      await apiFetch(`/workflow/tasks/${selectedId}/steps/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ step_ids: reordered.map((s) => s.id) }),
      });
      await selectTask(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder steps');
    } finally {
      setBusy(false);
    }
  }

  const roleColorMap = Object.fromEntries(roles.map((r) => [r.code, r.color]));
  const editing = isCreateMode || selectedId !== null;
  const selectedTask = tasks.find((t) => t.id === selectedId);

  return (
    <div className="space-y-6">
      <PageHeader title="Workflow admin" description="Create tasks, build steps, preview flow, and publish." />

      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      {modules.length === 0 && !loading && (
        <Alert variant="warning">
          No modules found. Run <code className="text-xs">pnpm seed</code> to load system modules before creating tasks.
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-[220px_1fr_260px]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted">Loading...</p>
            ) : (
              tasks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={busy}
                  onClick={() => selectTask(t.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    selectedId === t.id && !isCreateMode
                      ? 'border-primary bg-primary-muted'
                      : 'border-border hover:bg-slate-50'
                  }`}
                >
                  <div className="font-medium">{t.name_en}</div>
                  <div className="text-xs text-muted">
                    {t.total_steps} steps · {t.is_published ? 'Published' : 'Draft'}
                  </div>
                </button>
              ))
            )}
            <Button
              className="w-full"
              size="sm"
              variant={isCreateMode ? 'default' : 'outline'}
              disabled={busy || modules.length === 0}
              onClick={beginCreateTask}
            >
              <Plus className="h-4 w-4" />
              New task
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {isCreateMode ? 'New task' : selectedId ? 'Task editor' : 'Select a task'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!editing ? (
              <p className="text-sm text-muted">Select an existing task or click &quot;New task&quot; to begin.</p>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Task name *</Label>
                    <Input
                      value={taskForm.name_en}
                      disabled={busy}
                      placeholder="e.g. Submit monthly salary bill"
                      onChange={(e) => onTaskNameChange(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Code</Label>
                    <Input
                      value={taskForm.code}
                      disabled={busy}
                      placeholder="AUTO_GENERATED"
                      onChange={(e) =>
                        setTaskForm({
                          ...taskForm,
                          code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''),
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Module *</Label>
                    <select
                      className="ibas-select"
                      disabled={busy}
                      value={taskForm.module_id}
                      onChange={(e) => setTaskForm({ ...taskForm, module_id: e.target.value })}
                    >
                      <option value="">Select module...</option>
                      {modules.map((m) => (
                        <option key={moduleId(m)} value={moduleId(m)}>
                          {m.name_en}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedTask && (
                    <div className="flex items-end">
                      <span className="text-sm text-muted">
                        Status: {selectedTask.is_published ? 'Published' : 'Draft'} · {steps.length} steps
                      </span>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Description *</Label>
                  <textarea
                    className="ibas-textarea"
                    disabled={busy}
                    value={taskForm.description_en}
                    placeholder="What this task does and who it is for"
                    onChange={(e) => setTaskForm({ ...taskForm, description_en: e.target.value })}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {isCreateMode ? (
                    <>
                      <Button size="sm" disabled={busy} onClick={createTask}>
                        Create task
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => {
                          setIsCreateMode(false);
                          clearFeedback();
                        }}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" disabled={busy} onClick={saveTask}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={publishTask}>
                        Publish
                      </Button>
                    </>
                  )}
                </div>

                {!isCreateMode && selectedId && (
                  <>
                    <div>
                      <Label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">Steps</Label>
                      {steps.length === 0 ? (
                        <p className="text-sm text-muted">No steps yet — add at least one before publishing.</p>
                      ) : (
                        <div className="space-y-3">
                          {steps.map((s, i) => (
                            <div key={s.id} className="rounded-xl border border-border bg-slate-50/80 p-3">
                              <div className="mb-1 flex flex-wrap items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                                  {s.step_number}
                                </span>
                                <RoleBadge code={s.role_code} color={roleColorMap[s.role_code]} />
                                <span className="font-medium">{s.title_en}</span>
                                <div className="ml-auto flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    disabled={busy || i === 0}
                                    onClick={() => moveStep(i, -1)}
                                  >
                                    <ChevronUp className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    disabled={busy || i === steps.length - 1}
                                    onClick={() => moveStep(i, 1)}
                                  >
                                    <ChevronDown className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7"
                                    disabled={busy}
                                    onClick={() => deleteStep(s.id)}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </div>
                              <p className="text-sm text-muted">{s.description_en}</p>
                              {s.fields.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {s.fields.map((f) => (
                                    <span key={f.name} className="rounded-full border bg-surface px-2 py-0.5 text-xs">
                                      {f.label} ({f.type})
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-dashed border-border p-4">
                      <div className="mb-3 text-sm font-semibold">Add step</div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label>Role</Label>
                          <select
                            className="ibas-select"
                            disabled={busy}
                            value={stepForm.role_code}
                            onChange={(e) => {
                              const code = e.target.value;
                              const role = roles.find((r) => r.code === code);
                              setStepForm({
                                ...stepForm,
                                role_code: code,
                                is_auto: role?.is_system ?? false,
                              });
                            }}
                          >
                            {roles.map((r) => (
                              <option key={r.code} value={r.code}>
                                {r.code} — {r.name_en}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label>Step title *</Label>
                          <Input
                            disabled={busy}
                            value={stepForm.title_en}
                            onChange={(e) => setStepForm({ ...stepForm, title_en: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="mt-2 space-y-1">
                        <Label>Instructions</Label>
                        <textarea
                          className="ibas-textarea"
                          disabled={busy}
                          value={stepForm.description_en}
                          onChange={(e) => setStepForm({ ...stepForm, description_en: e.target.value })}
                        />
                      </div>
                      <div className="mt-3">
                        <Label className="mb-2 block">Form fields</Label>
                        <FieldBuilder
                          fields={stepForm.fields}
                          onChange={(fields) => setStepForm({ ...stepForm, fields })}
                        />
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label>Condition</Label>
                          <Input
                            disabled={busy}
                            value={stepForm.condition_text}
                            onChange={(e) => setStepForm({ ...stepForm, condition_text: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Handoff message</Label>
                          <Input
                            disabled={busy}
                            value={stepForm.handoff_msg}
                            onChange={(e) => setStepForm({ ...stepForm, handoff_msg: e.target.value })}
                          />
                        </div>
                      </div>
                      <label className="mt-3 flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          disabled={busy}
                          checked={stepForm.is_auto}
                          onChange={(e) => setStepForm({ ...stepForm, is_auto: e.target.checked })}
                        />
                        Auto-processed step (no user input)
                      </label>
                      <Button
                        className="mt-4"
                        size="sm"
                        disabled={busy || !stepForm.title_en.trim()}
                        onClick={addStep}
                      >
                        Add step
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="hidden xl:block">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Flow preview</CardTitle>
          </CardHeader>
          <CardContent>
            <FlowPreview steps={steps} roleColors={roleColorMap} />
          </CardContent>
        </Card>
      </div>

      {selectedId && steps.length > 0 && (
        <Card className="xl:hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Flow preview</CardTitle>
          </CardHeader>
          <CardContent>
            <FlowPreview steps={steps} roleColors={roleColorMap} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
