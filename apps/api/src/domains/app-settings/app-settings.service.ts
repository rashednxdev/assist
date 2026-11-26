import type {
  AppSettingsRecord,
  MobileAppVersionPolicy,
  UpdateAppSettingsDto,
} from '@ibas/shared-types';
import {
  DEFAULT_MOBILE_FORCE_MESSAGE,
  DEFAULT_UNPAID_MESSAGE,
  getAppVersionLine,
  isMobileForceUpdateRequired,
} from '@ibas/shared-types';
import { env } from '../../config/env.js';
import { AppSettings } from './models/AppSettings.model.js';

function toRecord(doc: {
  unpaid_message: string;
  mobile_latest_version?: string | null;
  mobile_update_url?: string | null;
  mobile_force_message?: string | null;
  updated_at: Date;
} | null): AppSettingsRecord {
  const message = doc?.unpaid_message?.trim();
  return {
    unpaid_message: message || DEFAULT_UNPAID_MESSAGE,
    mobile_latest_version: doc?.mobile_latest_version?.trim() || null,
    mobile_update_url: doc?.mobile_update_url?.trim() || null,
    mobile_force_message: doc?.mobile_force_message?.trim() || null,
    updated_at: (doc?.updated_at ?? new Date(0)).toISOString(),
  };
}

export async function getAppSettings(): Promise<AppSettingsRecord> {
  const doc = await AppSettings.findOne({ key: 'global' });
  return toRecord(doc);
}

export async function updateAppSettings(
  dto: UpdateAppSettingsDto,
  updatedBy: string,
): Promise<AppSettingsRecord> {
  const unpaid_message = dto.unpaid_message.trim();
  const $set: Record<string, unknown> = {
    unpaid_message,
    updated_by: updatedBy,
    updated_at: new Date(),
  };
  if (dto.mobile_latest_version !== undefined) {
    $set.mobile_latest_version = dto.mobile_latest_version.trim() || null;
  }
  if (dto.mobile_update_url !== undefined) {
    $set.mobile_update_url = dto.mobile_update_url.trim() || null;
  }
  if (dto.mobile_force_message !== undefined) {
    $set.mobile_force_message = dto.mobile_force_message.trim() || null;
  }

  const doc = await AppSettings.findOneAndUpdate(
    { key: 'global' },
    { $set },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return toRecord(doc);
}

/**
 * Public policy for mobile force-update.
 * Prefer AppSettings overrides; fall back to env so ops can set without a DB write.
 * Prior major.minor lines become absolute when latest_line advances.
 */
export async function getMobileAppVersionPolicy(
  currentVersion?: string | null,
): Promise<MobileAppVersionPolicy> {
  const settings = await getAppSettings();
  const latest_version =
    settings.mobile_latest_version?.trim() ||
    env.MOBILE_LATEST_VERSION?.trim() ||
    'ProAssist.2.0.0.1';
  const update_url =
    settings.mobile_update_url?.trim() ||
    env.MOBILE_UPDATE_URL?.trim() ||
    'https://sites.google.com/view/ourproassist/home';
  const force_message =
    settings.mobile_force_message?.trim() ||
    env.MOBILE_FORCE_MESSAGE?.trim() ||
    DEFAULT_MOBILE_FORCE_MESSAGE;

  return {
    latest_version,
    latest_line: getAppVersionLine(latest_version),
    update_url,
    force_message,
    force_update: isMobileForceUpdateRequired(currentVersion, latest_version),
  };
}
