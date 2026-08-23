import type { AppSettingsRecord, UpdateAppSettingsDto } from '@ibas/shared-types';
import { DEFAULT_UNPAID_MESSAGE } from '@ibas/shared-types';
import { AppSettings } from './models/AppSettings.model.js';

export async function getAppSettings(): Promise<AppSettingsRecord> {
  const doc = await AppSettings.findOne({ key: 'global' });
  const message = doc?.unpaid_message?.trim();
  return {
    unpaid_message: message || DEFAULT_UNPAID_MESSAGE,
    updated_at: (doc?.updated_at ?? new Date(0)).toISOString(),
  };
}

export async function updateAppSettings(
  dto: UpdateAppSettingsDto,
  updatedBy: string,
): Promise<AppSettingsRecord> {
  const unpaid_message = dto.unpaid_message.trim();
  const doc = await AppSettings.findOneAndUpdate(
    { key: 'global' },
    { unpaid_message, updated_by: updatedBy, updated_at: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return {
    unpaid_message: doc.unpaid_message,
    updated_at: doc.updated_at.toISOString(),
  };
}
