'use client';

import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import type { ExplanationProcess, ProcessStep } from '@ibas/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProcessFlowPreview } from '@/components/books/process-flow-preview';

export function emptyExplanationProcess(): ExplanationProcess {
  return { title: '', details: '', steps: [] };
}

function emptyStep(): ProcessStep {
  return { title: '', description: '', role: '' };
}

export function ProcessStepsEditor({
  value,
  onChange,
  disabled,
}: {
  value: ExplanationProcess;
  onChange: (next: ExplanationProcess) => void;
  disabled?: boolean;
}) {
  function patch(partial: Partial<ExplanationProcess>) {
    onChange({ ...value, ...partial });
  }

  function updateStep(index: number, stepPatch: Partial<ProcessStep>) {
    patch({ steps: value.steps.map((s, i) => (i === index ? { ...s, ...stepPatch } : s)) });
  }

  function addStep() {
    patch({ steps: [...value.steps, emptyStep()] });
  }

  function removeStep(index: number) {
    patch({ steps: value.steps.filter((_, i) => i !== index) });
  }

  function moveStep(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= value.steps.length) return;
    const steps = [...value.steps];
    [steps[index], steps[target]] = [steps[target]!, steps[index]!];
    patch({ steps });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Process title (optional)</Label>
          <Input
            disabled={disabled}
            value={value.title ?? ''}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="e.g. Bill submission process"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Process details (optional)</Label>
          <textarea
            className="ibas-textarea text-sm"
            disabled={disabled}
            value={value.details ?? ''}
            onChange={(e) => patch({ details: e.target.value })}
            placeholder="Overview of this process"
          />
        </div>

        {value.steps.map((step, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-muted">Step {i + 1}</span>
              <div className="ml-auto flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  disabled={disabled || i === 0}
                  onClick={() => moveStep(i, -1)}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  disabled={disabled || i === value.steps.length - 1}
                  onClick={() => moveStep(i, 1)}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-destructive"
                  disabled={disabled}
                  onClick={() => removeStep(i)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <Input
              disabled={disabled}
              value={step.role ?? ''}
              onChange={(e) => updateStep(i, { role: e.target.value })}
              placeholder="Role (optional, e.g. DDO)"
              className="h-8 text-sm"
            />
            <Input
              disabled={disabled}
              value={step.title}
              onChange={(e) => updateStep(i, { title: e.target.value })}
              placeholder="Step title *"
              className="h-8 text-sm"
            />
            <textarea
              className="ibas-textarea text-sm"
              disabled={disabled}
              value={step.description ?? ''}
              onChange={(e) => updateStep(i, { description: e.target.value })}
              placeholder="Step details (optional)"
            />
          </div>
        ))}
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={addStep}>
          <Plus className="h-4 w-4" />
          Add step
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Preview</Label>
        <div className="rounded-lg border border-border bg-surface p-4">
          <ProcessFlowPreview steps={value.steps.filter((s) => s.title.trim())} />
        </div>
      </div>
    </div>
  );
}
