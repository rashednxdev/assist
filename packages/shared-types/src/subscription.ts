import { z } from 'zod';

const mongoId = z.string().regex(/^[a-f\d]{24}$/i);

export const subscribePlanSchema = z.object({
  plan_id: mongoId,
});

export type SubscribePlanDto = z.infer<typeof subscribePlanSchema>;
