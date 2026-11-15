import mongoose from 'mongoose';
import { EXAM_PREP_MODULE_CODES } from '@ibas/shared-constants';
import type { UpsertModuleAccessDto } from '@ibas/shared-types';
import { UserModuleAccess } from './models/UserModuleAccess.model.js';
import { Module } from '../setup/models/Module.model.js';
import { User } from './models/User.model.js';
import { notFound } from '../../shared/errors/AppError.js';
import { logger } from '../../shared/logger.js';
import { PROASSIST_SUPPORT_PHONE, sendSms } from '../../shared/sms.js';

/** Shell codes that open the Learning module. A package purchase is not one of these rows. */
const LEARNING_SHELL_CODES = [...EXAM_PREP_MODULE_CODES, 'QOTD', 'EXAM_ROUTINE'];

const LEARNING_OPENED_SMS = `Dear ProAssist User, your Learning portal is now unlocked! Select a package to prepare with expert mentors & curated resources. Thank you for using ProAssist! Support: ${PROASSIST_SUPPORT_PHONE}`;

function serializeAccess(doc: InstanceType<typeof UserModuleAccess>) {
  return {
    id: String(doc._id),
    user_id: String(doc.user_id),
    module_id: String(doc.module_id),
    module_code: doc.module_code,
    can_read: doc.can_read,
    can_create: doc.can_create,
    can_update: doc.can_update,
    can_delete: doc.can_delete,
    can_grade: doc.can_grade,
    can_publish: doc.can_publish,
    bypass_stop: Boolean(doc.bypass_stop),
    task_restrictions: doc.task_restrictions,
    expires_at: doc.expires_at,
    is_active: doc.is_active,
    granted_at: doc.granted_at,
  };
}

export async function listModuleAccess(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw notFound('User not found');

  const items = await UserModuleAccess.find({ user_id: userId, is_active: true }).sort({ module_code: 1 });
  return items.map(serializeAccess);
}

/** Grants with module display names — used for session / navigation. */
export async function listModuleAccessForSession(userId: string) {
  const items = await UserModuleAccess.find({ user_id: userId, is_active: true }).sort({ module_code: 1 });
  if (items.length === 0) return [];

  const moduleIds = items.map((i) => i.module_id);
  const modules = await Module.find({ _id: { $in: moduleIds } }).select('name_en code');
  const nameById = new Map(modules.map((m) => [String(m._id), m.name_en]));

  return items.map((doc) => ({
    module_code: doc.module_code,
    module_name_en: nameById.get(String(doc.module_id)) ?? doc.module_code,
    can_read: doc.can_read,
    can_create: doc.can_create,
    can_update: doc.can_update,
    can_delete: doc.can_delete,
    can_grade: doc.can_grade,
    can_publish: doc.can_publish,
    bypass_stop: Boolean(doc.bypass_stop),
  }));
}

export async function upsertModuleAccess(userId: string, dto: UpsertModuleAccessDto, grantedBy: string) {
  const user = await User.findById(userId);
  if (!user) throw notFound('User not found');

  const mod = await Module.findById(dto.module_id);
  if (!mod) throw notFound('Module not found');

  const openingLearning =
    dto.can_read &&
    LEARNING_SHELL_CODES.includes(mod.code as (typeof LEARNING_SHELL_CODES)[number]) &&
    !(await UserModuleAccess.exists({
      user_id: userId,
      is_active: true,
      can_read: true,
      module_code: { $in: LEARNING_SHELL_CODES },
    }));

  const permissions: string[] = [];
  if (dto.can_read) permissions.push('read');
  if (dto.can_create) permissions.push('create');
  if (dto.can_update) permissions.push('update');
  if (dto.can_delete) permissions.push('delete');
  if (dto.can_grade) permissions.push('grade');
  if (dto.can_publish) permissions.push('publish');

  const doc = await UserModuleAccess.findOneAndUpdate(
    { user_id: userId, module_id: dto.module_id },
    {
      user_id: new mongoose.Types.ObjectId(userId),
      module_id: mod._id,
      module_code: mod.code,
      permissions,
      can_read: dto.can_read,
      can_create: dto.can_create,
      can_update: dto.can_update,
      can_delete: dto.can_delete,
      can_grade: dto.can_grade,
      can_publish: dto.can_publish,
      bypass_stop: dto.bypass_stop ?? false,
      task_restrictions: dto.task_restrictions ?? [],
      granted_by: new mongoose.Types.ObjectId(grantedBy),
      granted_at: new Date(),
      expires_at: dto.expires_at,
      is_active: true,
    },
    { upsert: true, new: true },
  );

  if (openingLearning) await textLearningOpened(user.phone);
  return serializeAccess(doc);
}

/** One text when an admin first opens Learning. A failed text does not undo the grant. */
async function textLearningOpened(phone: string | undefined): Promise<void> {
  if (!phone || !/^01[3-9]\d{8}$/.test(phone)) return;
  try {
    await sendSms(phone, LEARNING_OPENED_SMS);
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : 'sms failed' }, 'Learning access SMS failed');
  }
}

/** True if the user has an active grant for moduleCode with the given permission flag set. */
export async function hasModulePermission(
  userId: string,
  moduleCode: string,
  permission: 'can_read' | 'can_create' | 'can_update' | 'can_delete' | 'can_grade' | 'can_publish',
): Promise<boolean> {
  const grant = await UserModuleAccess.exists({
    user_id: userId,
    module_code: moduleCode,
    is_active: true,
    [permission]: true,
  });
  return Boolean(grant);
}

export async function revokeModuleAccess(userId: string, moduleId: string) {
  const doc = await UserModuleAccess.findOne({ user_id: userId, module_id: moduleId });
  if (!doc) throw notFound('Module access not found');
  doc.is_active = false;
  await doc.save();
  return serializeAccess(doc);
}
