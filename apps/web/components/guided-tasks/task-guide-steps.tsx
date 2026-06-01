'use client';

import { RoleBadge } from '@/components/workflow/role-badge';
import { Alert } from '@/components/ui/alert';

export interface GuideStep {
  step_number: number;
  title_en: string;
  description_en: string;
  role_code: string;
  condition_text?: string | null;
  handoff_msg?: string | null;
  handoff_role?: string | null;
  fields: Array<{ name: string; label: string; type: string; required?: boolean }>;
}

export function TaskGuideSteps({ steps }: { steps: GuideStep[] }) {
  if (steps.length === 0) {
    return <p className="text-sm text-muted">No steps defined for this process yet.</p>;
  }

  return (
    <ol className="relative space-y-0 border-l-2 border-primary/20 pl-6">
      {steps.map((step, idx) => (
        <li key={step.step_number} className="relative pb-8 last:pb-0">
          <span className="absolute -left-[1.35rem] flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
            {step.step_number}
          </span>
          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <RoleBadge code={step.role_code} />
              <h3 className="font-semibold">{step.title_en}</h3>
            </div>
            <p className="mt-2 text-sm text-muted">{step.description_en}</p>
            {step.condition_text && (
              <Alert variant="warning" className="mt-3 text-sm">
                Condition: {step.condition_text}
              </Alert>
            )}
            {step.fields.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-muted">
                {step.fields.map((f) => (
                  <li key={f.name}>
                    <span className="font-medium text-foreground">{f.label}</span>
                    {f.required && <span className="text-destructive"> *</span>}
                    <span className="text-muted"> ({f.type})</span>
                  </li>
                ))}
              </ul>
            )}
            {step.handoff_msg && (
              <div className="mt-3 rounded-lg border border-primary/20 bg-primary-muted px-3 py-2 text-sm">
                <span className="font-medium text-primary">After this step: </span>
                {step.handoff_msg}
                {step.handoff_role && (
                  <span className="ml-1">
                    → <RoleBadge code={step.handoff_role} />
                  </span>
                )}
              </div>
            )}
          </div>
          {idx < steps.length - 1 && (
            <div className="absolute -left-[0.65rem] top-7 h-[calc(100%-1.75rem)] w-0.5 bg-primary/10" />
          )}
        </li>
      ))}
    </ol>
  );
}
