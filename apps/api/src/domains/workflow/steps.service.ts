import mongoose from 'mongoose';
import type { CreateStepDto, UpdateStepDto } from '@ibas/shared-types';
import { Task } from './models/Task.model.js';
import { TaskStep } from './models/TaskStep.model.js';
import { Role } from './models/Role.model.js';
import { notFound, badRequest } from '../../shared/errors/AppError.js';
import { serializeStep } from './tasks.service.js';

async function resolveRole(roleCode: string) {
  const role = await Role.findOne({ code: roleCode, is_active: true });
  if (!role) throw notFound(`Role ${roleCode} not found`);
  return role;
}

export async function listSteps(taskId: string) {
  const task = await Task.findById(taskId);
  if (!task) throw notFound('Task not found');
  const steps = await TaskStep.find({ task_id: taskId }).sort({ step_number: 1 });
  return steps.map(serializeStep);
}

export async function createStep(taskId: string, dto: CreateStepDto) {
  const task = await Task.findById(taskId);
  if (!task) throw notFound('Task not found');

  const role = await resolveRole(dto.role_code);
  const count = await TaskStep.countDocuments({ task_id: taskId });
  const stepNumber = count + 1;

  const step = await TaskStep.create({
    task_id: task._id,
    step_number: stepNumber,
    title_en: dto.title_en,
    title_bn: dto.title_bn,
    description_en: dto.description_en,
    description_bn: dto.description_bn,
    role_id: role._id,
    role_code: role.code,
    role_name_en: role.name_en,
    fields: dto.fields ?? [],
    condition_text: dto.condition_text,
    handoff_msg: dto.handoff_msg,
    handoff_role: dto.handoff_role,
    is_optional: dto.is_optional ?? false,
    is_auto: dto.is_auto ?? role.is_system,
    nav_menu_path: dto.nav_menu_path,
    sort_order: stepNumber,
    version: 1,
  });

  task.total_steps = stepNumber;
  await task.save();

  return serializeStep(step);
}

export async function updateStep(taskId: string, stepId: string, dto: UpdateStepDto) {
  const step = await TaskStep.findOne({ _id: stepId, task_id: taskId });
  if (!step) throw notFound('Step not found');

  if (dto.role_code) {
    const role = await resolveRole(dto.role_code);
    step.role_id = role._id;
    step.role_code = role.code;
    step.role_name_en = role.name_en;
    if (role.is_system) step.is_auto = true;
  }

  if (dto.title_en !== undefined) step.title_en = dto.title_en;
  if (dto.title_bn !== undefined) step.title_bn = dto.title_bn;
  if (dto.description_en !== undefined) step.description_en = dto.description_en;
  if (dto.description_bn !== undefined) step.description_bn = dto.description_bn;
  if (dto.fields !== undefined) step.fields = dto.fields;
  if (dto.condition_text !== undefined) step.condition_text = dto.condition_text;
  if (dto.handoff_msg !== undefined) step.handoff_msg = dto.handoff_msg;
  if (dto.handoff_role !== undefined) step.handoff_role = dto.handoff_role;
  if (dto.is_optional !== undefined) step.is_optional = dto.is_optional;
  if (dto.is_auto !== undefined) step.is_auto = dto.is_auto;
  if (dto.nav_menu_path !== undefined) step.nav_menu_path = dto.nav_menu_path;

  await step.save();
  return serializeStep(step);
}

export async function deleteStep(taskId: string, stepId: string) {
  const step = await TaskStep.findOne({ _id: stepId, task_id: taskId });
  if (!step) throw notFound('Step not found');
  await step.deleteOne();

  const remaining = await TaskStep.find({ task_id: taskId }).sort({ sort_order: 1 });
  for (let i = 0; i < remaining.length; i++) {
    remaining[i]!.step_number = i + 1;
    remaining[i]!.sort_order = i + 1;
    await remaining[i]!.save();
  }

  const task = await Task.findById(taskId);
  if (task) {
    task.total_steps = remaining.length;
    await task.save();
  }

  return { deleted: true };
}

export async function reorderSteps(taskId: string, stepIds: string[]) {
  const steps = await TaskStep.find({ task_id: taskId });
  if (steps.length !== stepIds.length) throw badRequest('Step count mismatch');

  const idSet = new Set(stepIds);
  if (steps.some((s) => !idSet.has(String(s._id)))) throw badRequest('Invalid step id');

  for (let i = 0; i < stepIds.length; i++) {
    await TaskStep.updateOne(
      { _id: stepIds[i], task_id: taskId },
      { step_number: i + 1, sort_order: i + 1 },
    );
  }

  return listSteps(taskId);
}
