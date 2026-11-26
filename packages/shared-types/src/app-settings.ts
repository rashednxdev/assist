import { z } from 'zod';

export const updateAppSettingsSchema = z.object({
  unpaid_message: z.string().min(1).max(2000),
  /** Full label e.g. ProAssist.2.1.0.0 — drives force-update line (first two digits). */
  mobile_latest_version: z.string().min(1).max(64).optional(),
  mobile_update_url: z.string().url().max(500).optional().or(z.literal('')),
  mobile_force_message: z.string().max(2000).optional().or(z.literal('')),
});

export type UpdateAppSettingsDto = z.infer<typeof updateAppSettingsSchema>;

export interface AppSettingsRecord {
  unpaid_message: string;
  mobile_latest_version?: string | null;
  mobile_update_url?: string | null;
  mobile_force_message?: string | null;
  updated_at: string;
}

export const DEFAULT_UNPAID_MESSAGE =
  'You are unpaid user. Paid to Get Full access. Message us on WhatsApp to complete payment.';

export const DEFAULT_MOBILE_FORCE_MESSAGE =
  'A required ProAssist update is available. Please install the latest version to continue.';

/** Public mobile version policy (no auth). */
export interface MobileAppVersionPolicy {
  latest_version: string;
  /** First two numeric segments of latest_version, e.g. "2.1". */
  latest_line: string;
  update_url: string;
  force_message: string;
  /**
   * True when the caller's current version line is older than latest_line
   * (major.minor change → absolute / blocking). Same line = optional patch.
   */
  force_update: boolean;
}
