'use client';

import { FlowPreview, type StepPreview } from '@/components/workflow/flow-preview';

export interface GuideStep {
  step_number: number;
  title_en: string;
  description_en: string;
  role_code: string;
  condition_text?: string | null;
  handoff_msg?: string | null;
  handoff_role?: string | null;
  is_auto?: boolean;
  fields: Array<{ name: string; label: string; type: string; required?: boolean }>;
}

function toFlowSteps(steps: GuideStep[]): StepPreview[] {
  return steps.map((step) => ({
    step_number: step.step_number,
    title_en: step.title_en,
    description_en: step.description_en,
    role_code: step.role_code,
    condition_text: step.condition_text ?? undefined,
    handoff_msg: step.handoff_msg ?? undefined,
    handoff_role: step.handoff_role ?? undefined,
    is_auto: step.is_auto,
    fields: step.fields.map((f) => ({
      label: f.required ? `${f.label} *` : f.label,
      type: f.type,
    })),
  }));
}

export function TaskGuideSteps({
  steps,
  roleColors,
}: {
  steps: GuideStep[];
  roleColors?: Record<string, string>;
}) {
  if (steps.length === 0) {
    return <p className="text-sm text-muted">No steps defined for this process yet.</p>;
  }

  return <FlowPreview steps={toFlowSteps(steps)} roleColors={roleColors} />;
}
