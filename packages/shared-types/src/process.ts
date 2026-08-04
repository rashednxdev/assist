import { z } from 'zod';

export const processStepSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  /** Free-text responsible party for this step — not tied to the Workflow Role collection. */
  role: z.string().optional(),
});

export const createProcessSchema = z.object({
  title: z.string().min(1),
  details: z.string().optional(),
  steps: z.array(processStepSchema).default([]),
  sort_order: z.number().int().positive().optional(),
});

export const updateProcessSchema = createProcessSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export type ProcessStep = z.infer<typeof processStepSchema>;
export type CreateProcessDto = z.infer<typeof createProcessSchema>;
export type UpdateProcessDto = z.infer<typeof updateProcessSchema>;

export interface ProcessRecord {
  id: string;
  title: string;
  details?: string;
  steps: ProcessStep[];
  sort_order: number;
}
