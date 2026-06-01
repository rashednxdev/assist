import mongoose from 'mongoose';
import type { CreateTaskDto, UpdateTaskDto } from '@ibas/shared-types';
import { Task } from './models/Task.model.js';
import { TaskStep } from './models/TaskStep.model.js';
import { Module } from '../setup/models/Module.model.js';
import { notFound, badRequest } from '../../shared/errors/AppError.js';

async function ensureUniqueTaskCode(baseCode: string): Promise<string> {
  const normalized = baseCode.toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 30) || 'TASK';
  let candidate = normalized;
  let n = 1;
  while (await Task.findOne({ code: candidate })) {
    const suffix = `_${n}`;
    candidate = `${normalized.slice(0, 30 - suffix.length)}${suffix}`;
    n += 1;
  }
  return candidate;
}

function serializeTask(task: InstanceType<typeof Task>, stepCount?: number) {
  return {
    id: String(task._id),
    name_en: task.name_en,
    name_bn: task.name_bn,
    code: task.code,
    module_id: String(task.module_id),
    module_code: task.module_code,
    module_name_en: task.module_name_en,
    description_en: task.description_en,
    description_bn: task.description_bn,
    roles_involved: task.roles_involved,
    total_steps: stepCount ?? task.total_steps,
    estimated_time: task.estimated_time,
    is_active: task.is_active,
    is_published: task.is_published,
    version: task.version,
    tags: task.tags,
    run_count: task.run_count,
    created_at: task.created_at,
    updated_at: task.updated_at,
  };
}

export async function listTasks(publishedOnly: boolean) {
  const filter: Record<string, unknown> = { is_active: true };
  if (publishedOnly) filter.is_published = true;

  const tasks = await Task.find(filter).sort({ name_en: 1 });
  return tasks.map((t) => serializeTask(t));
}

export async function getTaskById(id: string) {
  const task = await Task.findById(id);
  if (!task) throw notFound('Task not found');
  const steps = await TaskStep.find({ task_id: id }).sort({ step_number: 1 });
  return { task: serializeTask(task, steps.length), steps: steps.map(serializeStep) };
}

function serializeStep(step: InstanceType<typeof TaskStep>) {
  return {
    id: String(step._id),
    task_id: String(step.task_id),
    step_number: step.step_number,
    title_en: step.title_en,
    title_bn: step.title_bn,
    description_en: step.description_en,
    description_bn: step.description_bn,
    role_id: String(step.role_id),
    role_code: step.role_code,
    role_name_en: step.role_name_en,
    fields: step.fields,
    condition_text: step.condition_text,
    handoff_msg: step.handoff_msg,
    handoff_role: step.handoff_role,
    is_optional: step.is_optional,
    is_auto: step.is_auto,
    nav_menu_path: step.nav_menu_path,
    sort_order: step.sort_order,
  };
}

export async function createTask(dto: CreateTaskDto, createdBy: string) {
  if (!mongoose.isValidObjectId(dto.module_id)) {
    throw badRequest('Invalid module id');
  }

  const mod = await Module.findById(dto.module_id);
  if (!mod) throw notFound('Module not found');

  const code = await ensureUniqueTaskCode(dto.code);

  const task = await Task.create({
    name_en: dto.name_en,
    name_bn: dto.name_bn,
    code,
    module_id: mod._id,
    module_code: mod.code,
    module_name_en: mod.name_en,
    description_en: dto.description_en,
    description_bn: dto.description_bn,
    roles_involved: [],
    total_steps: 0,
    estimated_time: dto.estimated_time,
    is_active: true,
    is_published: false,
    version: 1,
    tags: dto.tags ?? [],
    created_by: new mongoose.Types.ObjectId(createdBy),
    run_count: 0,
  });

  return serializeTask(task);
}

export async function updateTask(id: string, dto: UpdateTaskDto, updatedBy: string) {
  const task = await Task.findById(id);
  if (!task) throw notFound('Task not found');

  if (dto.module_id) {
    const mod = await Module.findById(dto.module_id);
    if (!mod) throw notFound('Module not found');
    task.module_id = mod._id;
    task.module_code = mod.code;
    task.module_name_en = mod.name_en;
  }

  if (dto.name_en !== undefined) task.name_en = dto.name_en;
  if (dto.name_bn !== undefined) task.name_bn = dto.name_bn;
  if (dto.code !== undefined) {
    const nextCode = dto.code.toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 30);
    if (nextCode !== task.code) {
      const taken = await Task.findOne({ code: nextCode, _id: { $ne: task._id } });
      if (taken) throw badRequest('Task code already exists');
      task.code = nextCode;
    }
  }
  if (dto.description_en !== undefined) task.description_en = dto.description_en;
  if (dto.description_bn !== undefined) task.description_bn = dto.description_bn;
  if (dto.estimated_time !== undefined) task.estimated_time = dto.estimated_time;
  if (dto.tags !== undefined) task.tags = dto.tags;
  if (dto.is_active !== undefined) task.is_active = dto.is_active;
  task.updated_by = new mongoose.Types.ObjectId(updatedBy);

  await task.save();
  return serializeTask(task);
}

export async function deleteTask(id: string) {
  const task = await Task.findById(id);
  if (!task) throw notFound('Task not found');
  task.is_active = false;
  await task.save();
  await TaskStep.deleteMany({ task_id: id });
  return serializeTask(task);
}

export async function publishTask(id: string, updatedBy: string) {
  const task = await Task.findById(id);
  if (!task) throw notFound('Task not found');

  const steps = await TaskStep.find({ task_id: id }).sort({ step_number: 1 });
  if (steps.length === 0) throw badRequest('Task must have at least one step');

  const roles = [...new Set(steps.map((s) => s.role_code))];
  task.roles_involved = roles;
  task.total_steps = steps.length;
  task.is_published = true;
  task.version += 1;
  task.updated_by = new mongoose.Types.ObjectId(updatedBy);
  await task.save();

  return serializeTask(task, steps.length);
}

export { serializeStep };
