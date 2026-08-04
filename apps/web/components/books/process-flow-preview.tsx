'use client';

export interface ProcessStepPreview {
  title: string;
  description?: string;
  role?: string;
}

/**
 * Read-only step timeline for a book Process — adapted from the Workflow feature's
 * `apps/web/components/workflow/flow-preview.tsx`, simplified: role is free text (no
 * `RoleBadge`/color lookup), no form fields, condition, handoff, or auto-step concepts.
 */
export function ProcessFlowPreview({ steps }: { steps: ProcessStepPreview[] }) {
  if (steps.length === 0) {
    return <p className="text-sm text-muted">No steps added yet.</p>;
  }

  return (
    <div className="space-y-0">
      {steps.map((step, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-primary text-xs font-bold text-primary">
              {i + 1}
            </div>
            {i < steps.length - 1 && <div className="my-1 w-0.5 flex-1 min-h-[24px] bg-border" />}
          </div>
          <div className="pb-6 flex-1">
            {step.role?.trim() && (
              <span className="mb-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                {step.role.trim()}
              </span>
            )}
            <div className="font-semibold text-foreground">{step.title}</div>
            {step.description?.trim() && (
              <p className="mt-0.5 text-sm text-muted">{step.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
