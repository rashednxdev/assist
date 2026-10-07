import mongoose from 'mongoose';
import type {
  SalaryFreeTrFormSettingsRecord,
  SalaryFreeTrFormState,
  UpdateSalaryFreeTrFormDto,
} from '@ibas/shared-types';
import { User } from '../users/models/User.model.js';
import { SalaryCalcUsage } from './models/SalaryCalcUsage.model.js';
import { SalarySettings } from './models/SalarySettings.model.js';

const SETTINGS_KEY = 'global';

async function periods(): Promise<Array<{ from: Date; to: Date | null }>> {
  const doc = await SalarySettings.findOne({ key: SETTINGS_KEY }).select('free_tr_periods').lean();
  return doc?.free_tr_periods ?? [];
}

export async function getSalaryFreeTrForm(): Promise<SalaryFreeTrFormSettingsRecord> {
  const doc = await SalarySettings.findOne({ key: SETTINGS_KEY }).select('free_tr_periods updated_at').lean();
  const open = (doc?.free_tr_periods ?? []).find((p) => !p.to);
  return {
    enabled: Boolean(open),
    enabled_since: open?.from.toISOString() ?? null,
    updated_at: doc?.updated_at?.toISOString() ?? null,
  };
}

/** Turning it off keeps the free T.R. Form of users who registered while it was on. */
export async function updateSalaryFreeTrForm(
  dto: UpdateSalaryFreeTrFormDto,
  updatedBy: string,
): Promise<SalaryFreeTrFormSettingsRecord> {
  const current = await getSalaryFreeTrForm();
  if (current.enabled === dto.enabled) return current;
  const now = new Date();
  const meta = { updated_by: new mongoose.Types.ObjectId(updatedBy), updated_at: now };
  if (dto.enabled) {
    await SalarySettings.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { $push: { free_tr_periods: { from: now, to: null } }, $set: meta },
      { upsert: true, setDefaultsOnInsert: true },
    );
  } else {
    await SalarySettings.updateOne(
      { key: SETTINGS_KEY, 'free_tr_periods.to': null },
      { $set: { 'free_tr_periods.$.to': now, ...meta } },
    );
  }
  return getSalaryFreeTrForm();
}

export async function salaryFreeTrStates(userIds: string[]): Promise<Map<string, SalaryFreeTrFormState>> {
  const states = new Map<string, SalaryFreeTrFormState>(userIds.map((id) => [id, 'none']));
  const list = await periods();
  if (userIds.length === 0 || list.length === 0) return states;
  const [eligible, used] = await Promise.all([
    User.find({
      _id: { $in: userIds },
      $or: list.map((p) => ({ created_at: p.to ? { $gte: p.from, $lt: p.to } : { $gte: p.from } })),
    })
      .select('_id')
      .lean(),
    SalaryCalcUsage.find({ user_id: { $in: userIds }, free_tr_used: true }).select('user_id').lean(),
  ]);
  const usedIds = new Set(used.map((u) => String(u.user_id)));
  for (const u of eligible) states.set(String(u._id), usedIds.has(String(u._id)) ? 'used' : 'available');
  return states;
}

export async function salaryFreeTrState(userId: string): Promise<SalaryFreeTrFormState> {
  return (await salaryFreeTrStates([userId])).get(userId) ?? 'none';
}

/** Atomically uses the free single T.R. Form; false when the user has none left. */
export async function claimSalaryFreeTrForm(userId: string): Promise<boolean> {
  if ((await salaryFreeTrState(userId)) !== 'available') return false;
  const id = new mongoose.Types.ObjectId(userId);
  await SalaryCalcUsage.updateOne({ user_id: id }, { $setOnInsert: { user_id: id } }, { upsert: true });
  const claimed = await SalaryCalcUsage.findOneAndUpdate(
    { user_id: id, free_tr_used: { $ne: true } },
    { $set: { free_tr_used: true, updated_at: new Date() } },
  );
  return Boolean(claimed);
}
