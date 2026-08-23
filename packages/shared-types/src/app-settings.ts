import { z } from 'zod';

export const updateAppSettingsSchema = z.object({
  unpaid_message: z.string().min(1).max(2000),
});

export type UpdateAppSettingsDto = z.infer<typeof updateAppSettingsSchema>;

export interface AppSettingsRecord {
  unpaid_message: string;
  updated_at: string;
}

export const DEFAULT_UNPAID_MESSAGE =
  'You are unpaid user. Paid to Get Full access. Message us on WhatsApp to complete payment.';
