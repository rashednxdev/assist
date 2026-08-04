'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react';
import type { ProcessStep } from '@ibas/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProcessFlowPreview } from './process-flow-preview';

export interface ProcessDraft {
  title: string;
  details: string;
  steps: ProcessStep[];
}

function emptyStep(): ProcessStep {
  return { title: '', description: '', role: '' };
}

export function ProcessModal({
  open,
  initialValue,
  onCancel,
  onSave,
}: {
  open: boolean;
  initialValue: ProcessDraft;
  onCancel: () => void;
  onSave: (draft: ProcessDraft) => void;
}) {
  const [draft, setDraft] = useState<ProcessDraft>(initialValue);
  const wasOpen = useRef(false);

  useEffect(() => {
    // Only reseed on the closed -> open transition — see comparison-table-modal.tsx for why.
    if (open && !wasOpen.current) setDraft(initialValue);
    wasOpen.current = open;
  }, [open, initialValue]);

  if (!open) return null;

  function updateStep(index: number, patch: Partial<ProcessStep>) {
    setDraft((prev) => ({
      ...prev,
      steps: prev.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  }

  function addStep() {
    setDraft((prev) => ({ ...prev, steps: [...prev.steps, emptyStep()] }));
  }

  function removeStep(index: number) {
    setDraft((prev) => ({ ...prev, steps: prev.steps.filter((_, i) => i !== index) }));
  }

  function moveStep(index: number, dir: -1 | 1) {
    setDraft((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.steps.length) return prev;
      const steps = [...prev.steps];
      [steps[index], steps[target]] = [steps[target]!, steps[index]!];
      return { ...prev, steps };
    });
  }

  const canSave = draft.title.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex h-[100dvh] max-h-[100dvh] w-full max-w-[100vw] flex-col overflow-hidden rounded-none border border-border bg-background shadow-xl sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-4xl sm:rounded-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">Process</h2>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid flex-1 gap-5 overflow-y-auto px-5 py-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="e.g. Bill submission process"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Details (optional)</Label>
              <textarea
                className="ibas-textarea text-sm"
                value={draft.details}
                onChange={(e) => setDraft({ ...draft, details: e.target.value })}
                placeholder="Overview of this process"
              />
            </div>

            <div className="space-y-2 border-t border-border pt-3">
              <Label className="text-xs">Steps</Label>
              {draft.steps.map((step, i) => (
                <div key={i} className="space-y-2 rounded-lg border border-border p-3">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-muted">Step {i + 1}</span>
                    <div className="ml-auto flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        disabled={i === 0}
                        onClick={() => moveStep(i, -1)}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        disabled={i === draft.steps.length - 1}
                        onClick={() => moveStep(i, 1)}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive"
                        onClick={() => removeStep(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <Input
                    value={step.role ?? ''}
                    onChange={(e) => updateStep(i, { role: e.target.value })}
                    placeholder="Role (optional, e.g. DDO)"
                    className="h-8 text-sm"
                  />
                  <Input
                    value={step.title}
                    onChange={(e) => updateStep(i, { title: e.target.value })}
                    placeholder="Step title *"
                    className="h-8 text-sm"
                  />
                  <textarea
                    className="ibas-textarea text-sm"
                    value={step.description ?? ''}
                    onChange={(e) => updateStep(i, { description: e.target.value })}
                    placeholder="Step details (optional)"
                  />
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={addStep}>
                <Plus className="h-4 w-4" />
                Add step
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Preview</Label>
            <div className="rounded-lg border border-border bg-surface p-4">
              <ProcessFlowPreview
                steps={draft.steps.filter((s) => s.title.trim())}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={!canSave} onClick={() => onSave(draft)}>
            Save process
          </Button>
        </div>
      </div>
    </div>
  );
}
