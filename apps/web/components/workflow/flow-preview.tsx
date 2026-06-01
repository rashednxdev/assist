'use client';

import { RoleBadge } from '@/components/workflow/role-badge';

interface StepPreview {
  step_number: number;
  title_en: string;
  description_en: string;
  role_code: string;
  fields?: Array<{ label: string; type?: string }>;
  condition_text?: string;
  handoff_msg?: string;
  is_auto?: boolean;
}

export function FlowPreview({
  steps,
  roleColors,
}: {
  steps: StepPreview[];
  roleColors?: Record<string, string>;
}) {
  if (steps.length === 0) {
    return <p className="text-sm text-muted">Add steps to see the flow preview.</p>;
  }

  return (
    <div className="space-y-0">
      {steps.map((step, i) => (
        <div key={step.step_number} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold"
              style={{
                borderColor: roleColors?.[step.role_code] ?? '#0d9488',
                color: roleColors?.[step.role_code] ?? '#0d9488',
              }}
            >
              {step.step_number}
            </div>
            {i < steps.length - 1 && <div className="my-1 w-0.5 flex-1 min-h-[24px] bg-border" />}
          </div>
          <div className="pb-6 flex-1">
            <RoleBadge code={step.role_code} color={roleColors?.[step.role_code]} className="mb-1" />
            {step.is_auto && <span className="ml-2 text-xs text-muted">Auto</span>}
            <div className="font-semibold text-foreground">{step.title_en}</div>
            <p className="mt-0.5 text-sm text-muted">{step.description_en}</p>
            {step.fields && step.fields.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {step.fields.map((f) => (
                  <span key={f.label} className="rounded-full border border-border bg-slate-50 px-2 py-0.5 text-xs">
                    {f.label}
                  </span>
                ))}
              </div>
            )}
            {step.condition_text && (
              <p className="mt-1 text-xs text-warning">Condition: {step.condition_text}</p>
            )}
            {step.handoff_msg && (
              <p className="mt-1 text-xs text-primary">Handoff: {step.handoff_msg}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
