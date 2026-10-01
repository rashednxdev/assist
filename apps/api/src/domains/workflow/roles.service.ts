import mongoose from 'mongoose';
import type { WorkflowRoleAdminItem, WorkflowRoleInput } from '@ibas/shared-types';
import { Role, type IRole } from './models/Role.model.js';
import { Task } from './models/Task.model.js';
import { TaskStep } from './models/TaskStep.model.js';
import { User } from '../users/models/User.model.js';
import { badRequest, notFound } from '../../shared/errors/AppError.js';

type RoleDoc = Omit<IRole, keyof mongoose.Document> & { _id: mongoose.Types.ObjectId };

function toAdminItem(r: RoleDoc, stepCounts: Map<string, number>, userCounts: Map<string, number>): WorkflowRoleAdminItem {
  return {
    id: String(r._id),
    code: r.code,
    name_en: r.name_en,
    name_bn: r.name_bn,
    description_en: r.description_en ?? '',
    color: r.color,
    level: r.level,
    can_submit: !!r.can_submit,
    can_forward: !!r.can_forward,
    can_approve: !!r.can_approve,
    is_system: !!r.is_system,
    is_active: r.is_active !== false,
    step_count: stepCounts.get(r.code) ?? 0,
    user_count: userCounts.get(r.code) ?? 0,
  };
}

async function usageCounts(codes: string[]) {
  const [steps, users] = await Promise.all([
    TaskStep.aggregate<{ _id: string; n: number }>([
      { $match: { role_code: { $in: codes } } },
      { $group: { _id: '$role_code', n: { $sum: 1 } } },
    ]),
    User.aggregate<{ _id: string; n: number }>([
      { $match: { 'workflow_roles.role_code': { $in: codes } } },
      { $unwind: '$workflow_roles' },
      { $match: { 'workflow_roles.role_code': { $in: codes }, 'workflow_roles.is_active': true } },
      { $group: { _id: '$workflow_roles.role_code', n: { $sum: 1 } } },
    ]),
  ]);
  return {
    stepCounts: new Map(steps.map((s) => [s._id, s.n])),
    userCounts: new Map(users.map((u) => [u._id, u.n])),
  };
}

async function itemFor(r: RoleDoc) {
  const { stepCounts, userCounts } = await usageCounts([r.code]);
  return toAdminItem(r, stepCounts, userCounts);
}

export async function listAllRoles(): Promise<WorkflowRoleAdminItem[]> {
  const roles = await Role.find().sort({ is_active: -1, level: 1, code: 1 }).lean<RoleDoc[]>();
  const { stepCounts, userCounts } = await usageCounts(roles.map((r) => r.code));
  return roles.map((r) => toAdminItem(r, stepCounts, userCounts));
}

export async function createRole(input: WorkflowRoleInput): Promise<WorkflowRoleAdminItem> {
  if (await Role.exists({ code: input.code })) throw badRequest(`A role with code ${input.code} already exists`);
  const doc = await Role.create({ ...input, is_system: false });
  return itemFor(doc.toObject() as RoleDoc);
}

async function activeStepsUsing(code: string) {
  const activeTaskIds = await Task.find({ is_active: true }).distinct('_id');
  return TaskStep.countDocuments({
    task_id: { $in: activeTaskIds },
    $or: [{ role_code: code }, { handoff_role: code }],
  });
}

export async function updateRole(id: string, input: WorkflowRoleInput): Promise<WorkflowRoleAdminItem> {
  if (!mongoose.isValidObjectId(id)) throw notFound('Role not found');
  const role = await Role.findById(id);
  if (!role) throw notFound('Role not found');
  if (input.code !== role.code) throw badRequest('Role code cannot be changed once created');

  if (role.is_active && !input.is_active) {
    if (role.is_system) throw badRequest('System roles cannot be deactivated');
    const inUse = await activeStepsUsing(role.code);
    if (inUse > 0) throw badRequest(`This role is used by ${inUse} process step(s); reassign them first`);
  }

  const renamed = role.name_en !== input.name_en;
  role.set({
    name_en: input.name_en,
    name_bn: input.name_bn,
    description_en: input.description_en,
    color: input.color,
    level: input.level,
    can_submit: input.can_submit,
    can_forward: input.can_forward,
    can_approve: input.can_approve,
    is_active: input.is_active,
  });
  await role.save();
  if (renamed) await TaskStep.updateMany({ role_code: role.code }, { $set: { role_name_en: role.name_en } });
  return itemFor(role.toObject() as RoleDoc);
}

export async function deactivateRole(id: string): Promise<WorkflowRoleAdminItem> {
  if (!mongoose.isValidObjectId(id)) throw notFound('Role not found');
  const role = await Role.findById(id);
  if (!role) throw notFound('Role not found');
  if (role.is_system) throw badRequest('System roles cannot be deactivated');
  const inUse = await activeStepsUsing(role.code);
  if (inUse > 0) throw badRequest(`This role is used by ${inUse} process step(s); reassign them first`);
  role.is_active = false;
  await role.save();
  return itemFor(role.toObject() as RoleDoc);
}
