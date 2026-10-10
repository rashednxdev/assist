import mongoose from 'mongoose';
import {
  SALARY_DEFAULT_FREE_TR_COUNT,
  type SalaryFreeTrFormSettingsRecord,
  type SalaryFreeTrFormState,
  type UpdateSalaryFreeTrFormDto,
} from '@ibas/shared-types';
import { User } from '../users/models/User.model.js';
import { SalaryCalcUsage } from './models/SalaryCalcUsage.model.js';
import { SalarySettings } from './models/SalarySettings.model.js';

const SETTINGS_KEY = 'global';

export interface SalaryFreeTrUsage {
  state: SalaryFreeTrFormState;
  left: number;
}

async function freeTrConfig() {
  const doc = await SalarySettings.findOne({ key: SETTINGS_KEY }).select('free_tr_periods free_tr_count updated_at').lean();
  return {
    periods: doc?.free_tr_periods ?? [],
    count: doc?.free_tr_count ?? SALARY_DEFAULT_FREE_TR_COUNT,
    updated_at: doc?.updated_at ?? null,
  };
}

function usedOf(doc: { free_tr_used?: boolean; free_tr_count?: number }): number {
  return Math.max(doc.free_tr_count ?? 0, doc.free_tr_used ? 1 : 0);
}

export async function getSalaryFreeTrForm(): Promise<SalaryFreeTrFormSettingsRecord> {
  const { periods, count, updated_at } = await freeTrConfig();
  const open = periods.find((p) => !p.to);
  return {
    enabled: Boolean(open),
    free_count: count,
    enabled_since: open?.from.toISOString() ?? null,
    updated_at: updated_at?.toISOString() ?? null,
  };
}

/** While on, every user gets the free T.R. Forms; turning it off keeps them only for users who registered while it was on. */
export async function updateSalaryFreeTrForm(
  dto: UpdateSalaryFreeTrFormDto,
  updatedBy: string,
): Promise<SalaryFreeTrFormSettingsRecord> {
  const current = await getSalaryFreeTrForm();
  const now = new Date();
  const meta = { updated_by: new mongoose.Types.ObjectId(updatedBy), updated_at: now };
  if (dto.free_count !== undefined && dto.free_count !== current.free_count) {
    await SalarySettings.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { $set: { free_tr_count: dto.free_count, ...meta } },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }
  if (dto.enabled === true && !current.enabled) {
    await SalarySettings.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { $push: { free_tr_periods: { from: now, to: null } }, $set: meta },
      { upsert: true, setDefaultsOnInsert: true },
    );
  } else if (dto.enabled === false && current.enabled) {
    await SalarySettings.updateOne(
      { key: SETTINGS_KEY, 'free_tr_periods.to': null },
      { $set: { 'free_tr_periods.$.to': now, ...meta } },
    );
  }
  return getSalaryFreeTrForm();
}

export async function salaryFreeTrUsages(userIds: string[]): Promise<Map<string, SalaryFreeTrUsage>> {
  const usages = new Map<string, SalaryFreeTrUsage>(userIds.map((id) => [id, { state: 'none', left: 0 }]));
  const { periods, count } = await freeTrConfig();
  if (userIds.length === 0 || periods.length === 0) return usages;
  const enabled = periods.some((p) => !p.to);
  const [eligible, used] = await Promise.all([
    User.find({
      _id: { $in: userIds },
      ...(enabled
        ? {}
        : { $or: periods.map((p) => ({ created_at: p.to ? { $gte: p.from, $lt: p.to } : { $gte: p.from } })) }),
    })
      .select('_id')
      .lean(),
    SalaryCalcUsage.find({ user_id: { $in: userIds }, $or: [{ free_tr_used: true }, { free_tr_count: { $gt: 0 } }] })
      .select('user_id free_tr_used free_tr_count')
      .lean(),
  ]);
  const usedBy = new Map(used.map((u) => [String(u.user_id), usedOf(u)]));
  for (const u of eligible) {
    const id = String(u._id);
    const left = Math.max(0, count - (usedBy.get(id) ?? 0));
    usages.set(id, { state: left > 0 ? 'available' : 'used', left });
  }
  return usages;
}

export async function salaryFreeTrStates(userIds: string[]): Promise<Map<string, SalaryFreeTrFormState>> {
  const usages = await salaryFreeTrUsages(userIds);
  return new Map([...usages].map(([id, u]) => [id, u.state]));
}

export async function salaryFreeTrUsage(userId: string): Promise<SalaryFreeTrUsage> {
  return (await salaryFreeTrUsages([userId])).get(userId) ?? { state: 'none', left: 0 };
}

/** Atomically uses one free single T.R. Form; false when the user has none left. */
export async function claimSalaryFreeTrForm(userId: string): Promise<boolean> {
  if ((await salaryFreeTrUsage(userId)).state !== 'available') return false;
  const { count } = await freeTrConfig();
  const id = new mongoose.Types.ObjectId(userId);
  await SalaryCalcUsage.updateOne({ user_id: id }, { $setOnInsert: { user_id: id } }, { upsert: true });
  await SalaryCalcUsage.updateOne(
    { user_id: id, free_tr_used: true, free_tr_count: { $not: { $gte: 1 } } },
    { $set: { free_tr_count: 1 } },
  );
  const claimed = await SalaryCalcUsage.findOneAndUpdate(
    { user_id: id, $or: [{ free_tr_count: { $exists: false } }, { free_tr_count: { $lt: count } }] },
    { $inc: { free_tr_count: 1 }, $set: { free_tr_used: true, updated_at: new Date() } },
  );
  return Boolean(claimed);
}
