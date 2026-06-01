import mongoose from 'mongoose';
import type { StartRunDto, RespondStepDto } from '@ibas/shared-types';
import type { AuthUser } from '../../middleware/auth.js';
import { Task } from './models/Task.model.js';
import { TaskStep } from './models/TaskStep.model.js';
import { TaskRun } from './models/TaskRun.model.js';
import { StepResponse } from './models/StepResponse.model.js';
import { User } from '../users/models/User.model.js';
import { notFound, badRequest, forbidden } from '../../shared/errors/AppError.js';
import { withTransaction } from '../../shared/transactions.js';
import { appendAudit } from './audit.service.js';
import { createHandoffNotifications } from './notifications.service.js';
import type { StepField } from './models/TaskStep.model.js';

function serializeRun(run: InstanceType<typeof TaskRun>) {
  return {
    id: String(run._id),
    task_id: String(run.task_id),
    task_name_en: run.task_name_en,
    task_name_bn: run.task_name_bn,
    task_version: run.task_version,
    initiated_by: String(run.initiated_by),
    current_step: run.current_step,
    current_role: run.current_role,
    status: run.status,
    started_at: run.started_at,
    completed_at: run.completed_at,
    last_activity_at: run.last_activity_at,
    duration_ms: run.duration_ms,
    rejection_reason: run.rejection_reason,
    office_code: run.office_code,
    fiscal_year: run.fiscal_year,
    month: run.month,
    reference_no: run.reference_no,
    metadata: run.metadata,
  };
}

function userHasRole(user: AuthUser, roleCode: string): boolean {
  if (user.is_super_admin) return true;
  return user.workflow_roles.some((r) => r.role_code === roleCode && r.is_active);
}

function validateFieldResponses(fields: StepField[], responses: Record<string, unknown> = {}) {
  for (const field of fields) {
    const val = responses[field.name];
    if (field.required && (val === undefined || val === null || val === '')) {
      throw badRequest(`Field "${field.label}" is required`);
    }
    if (val && field.validation) {
      const re = new RegExp(field.validation);
      if (!re.test(String(val))) {
        throw badRequest(`Field "${field.label}" failed validation`);
      }
    }
  }
}

async function processAutoSteps(run: InstanceType<typeof TaskRun>, actor: AuthUser, ip?: string) {
  let changed = false;

  while (run.status === 'in_progress') {
    const step = await TaskStep.findOne({ task_id: run.task_id, step_number: run.current_step });
    if (!step || !step.is_auto) break;

    const systemUser = await User.findOne({ is_super_admin: true });
    const performerId = systemUser?._id ?? new mongoose.Types.ObjectId(actor.id);

    await StepResponse.create({
      run_id: run._id,
      step_id: step._id,
      step_number: step.step_number,
      performed_by: performerId,
      role_code: step.role_code,
      action: 'submit',
      field_responses: {},
      remarks: 'Auto-processed',
      attachments: [],
      performed_at: new Date(),
      ip_address: ip,
    });

    const nextStep = await TaskStep.findOne({ task_id: run.task_id, step_number: run.current_step + 1 });
    if (nextStep) {
      run.current_step = nextStep.step_number;
      run.current_role = nextStep.role_code;
      run.last_activity_at = new Date();
      changed = true;
    } else {
      run.status = 'completed';
      run.completed_at = new Date();
      run.duration_ms = run.completed_at.getTime() - run.started_at.getTime();
      run.last_activity_at = new Date();
      changed = true;
      break;
    }
  }

  if (changed) await run.save();
  return run;
}

export async function startRun(
  taskId: string,
  dto: StartRunDto,
  actor: AuthUser,
  meta?: { ip?: string; userAgent?: string },
) {
  const task = await Task.findById(taskId);
  if (!task || !task.is_published) throw notFound('Published task not found');

  const firstStep = await TaskStep.findOne({ task_id: taskId, step_number: 1 });
  if (!firstStep) throw badRequest('Task has no steps');

  if (!userHasRole(actor, firstStep.role_code) && !actor.is_super_admin) {
    throw forbidden('You do not have the role required to start this task');
  }

  const run = await withTransaction(async (session) => {
    const [created] = await TaskRun.create(
      [
        {
          task_id: task._id,
          task_name_en: task.name_en,
          task_name_bn: task.name_bn,
          task_version: task.version,
          initiated_by: new mongoose.Types.ObjectId(actor.id),
          current_step: firstStep.step_number,
          current_role: firstStep.role_code,
          status: 'in_progress',
          started_at: new Date(),
          last_activity_at: new Date(),
          office_code: dto.office_code,
          fiscal_year: dto.fiscal_year,
          month: dto.month,
          reference_no: dto.reference_no,
          metadata: dto.metadata,
        },
      ],
      { session },
    );

    task.run_count += 1;
    await task.save({ session });

    await appendAudit({
      actor,
      action: 'RUN_START',
      entityType: 'task_runs',
      entityId: String(created!._id),
      description: `Started task run: ${task.name_en}`,
      runId: String(created!._id),
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
      officeCode: dto.office_code,
      fiscalYear: dto.fiscal_year,
    });

    return created!;
  });

  await processAutoSteps(run, actor, meta?.ip);
  return getRunDetail(String(run._id), actor);
}

export async function getRunDetail(runId: string, actor: AuthUser) {
  const run = await TaskRun.findById(runId);
  if (!run) throw notFound('Run not found');

  const steps = await TaskStep.find({ task_id: run.task_id }).sort({ step_number: 1 });
  const responses = await StepResponse.find({ run_id: runId }).sort({ step_number: 1 });
  const currentStepDef = steps.find((s) => s.step_number === run.current_step);

  return {
    run: serializeRun(run),
    steps: steps.map((s) => ({
      id: String(s._id),
      step_number: s.step_number,
      title_en: s.title_en,
      description_en: s.description_en,
      role_code: s.role_code,
      role_name_en: s.role_name_en,
      fields: s.fields,
      condition_text: s.condition_text,
      handoff_msg: s.handoff_msg,
      is_optional: s.is_optional,
      is_auto: s.is_auto,
    })),
    responses: responses.map((r) => ({
      id: String(r._id),
      step_number: r.step_number,
      role_code: r.role_code,
      action: r.action,
      field_responses: r.field_responses,
      remarks: r.remarks,
      performed_at: r.performed_at,
    })),
    current_step: currentStepDef
      ? {
          step_number: currentStepDef.step_number,
          title_en: currentStepDef.title_en,
          description_en: currentStepDef.description_en,
          role_code: currentStepDef.role_code,
          fields: currentStepDef.fields,
          handoff_msg: currentStepDef.handoff_msg,
          condition_text: currentStepDef.condition_text,
        }
      : null,
    can_act:
      run.status === 'in_progress' &&
      currentStepDef &&
      !currentStepDef.is_auto &&
      userHasRole(actor, run.current_role),
    can_reject:
      run.status === 'in_progress' &&
      currentStepDef &&
      !currentStepDef.is_auto &&
      userHasRole(actor, run.current_role),
    can_cancel:
      run.status === 'in_progress' &&
      (String(run.initiated_by) === actor.id ||
        actor.is_super_admin ||
        actor.user_type === 'system_admin' ||
        actor.user_type === 'admin'),
  };
}

export async function respondToStep(
  runId: string,
  stepNumber: number,
  dto: RespondStepDto,
  actor: AuthUser,
  meta?: { ip?: string; userAgent?: string },
) {
  const run = await TaskRun.findById(runId);
  if (!run) throw notFound('Run not found');
  if (run.status !== 'in_progress') throw badRequest('Run is not in progress');
  if (run.current_step !== stepNumber) throw badRequest('This is not the current step');

  const step = await TaskStep.findOne({ task_id: run.task_id, step_number: stepNumber });
  if (!step) throw notFound('Step not found');
  if (step.is_auto) throw badRequest('This step is auto-processed');

  if (!userHasRole(actor, step.role_code)) {
    throw forbidden(`Role ${step.role_code} required for this step`);
  }

  if (dto.action === 'reject') {
    run.status = 'rejected';
    run.rejection_reason = dto.remarks;
    run.rejected_by = new mongoose.Types.ObjectId(actor.id);
    run.last_activity_at = new Date();
    await run.save();

    await StepResponse.create({
      run_id: run._id,
      step_id: step._id,
      step_number: step.step_number,
      performed_by: new mongoose.Types.ObjectId(actor.id),
      role_code: step.role_code,
      action: 'reject',
      remarks: dto.remarks,
      attachments: [],
      performed_at: new Date(),
      ip_address: meta?.ip,
    });

    await appendAudit({
      actor,
      action: 'RUN_REJECT',
      entityType: 'task_runs',
      entityId: runId,
      description: `Rejected at step ${stepNumber}`,
      runId,
      stepNumber,
      ipAddress: meta?.ip,
      officeCode: run.office_code,
      fiscalYear: run.fiscal_year,
      severity: 'warning',
    });

    return getRunDetail(runId, actor);
  }

  validateFieldResponses(step.fields, dto.field_responses ?? {});

  const existing = await StepResponse.findOne({ run_id: runId, step_number: stepNumber });
  if (existing) throw badRequest('Step already completed');

  await StepResponse.create({
    run_id: run._id,
    step_id: step._id,
    step_number: step.step_number,
    performed_by: new mongoose.Types.ObjectId(actor.id),
    role_code: step.role_code,
    action: dto.action,
    field_responses: dto.field_responses,
    remarks: dto.remarks,
    attachments: [],
    performed_at: new Date(),
    ip_address: meta?.ip,
  });

  const nextStep = await TaskStep.findOne({ task_id: run.task_id, step_number: stepNumber + 1 });

  if (nextStep) {
    run.current_step = nextStep.step_number;
    run.current_role = nextStep.role_code;
    run.last_activity_at = new Date();
    await run.save();

    const notifyRole = step.handoff_role ?? nextStep.role_code;
    const message = step.handoff_msg ?? `Task "${run.task_name_en}" is ready for ${notifyRole}`;
    await createHandoffNotifications({
      runId,
      stepId: String(nextStep._id),
      roleCode: notifyRole,
      title: `Handoff: ${run.task_name_en}`,
      message,
    });
  } else {
    run.status = 'completed';
    run.completed_at = new Date();
    run.duration_ms = run.completed_at.getTime() - run.started_at.getTime();
    run.last_activity_at = new Date();
    await run.save();
  }

  await appendAudit({
    actor,
    action: 'STEP_SUBMIT',
    entityType: 'task_runs',
    entityId: runId,
    description: `Completed step ${stepNumber}: ${step.title_en}`,
    runId,
    stepNumber,
    ipAddress: meta?.ip,
    officeCode: run.office_code,
    fiscalYear: run.fiscal_year,
  });

  await processAutoSteps(run, actor, meta?.ip);
  return getRunDetail(runId, actor);
}

export async function cancelRun(
  runId: string,
  actor: AuthUser,
  reason?: string,
  meta?: { ip?: string; userAgent?: string },
) {
  const run = await TaskRun.findById(runId);
  if (!run) throw notFound('Run not found');
  if (run.status !== 'in_progress') throw badRequest('Run is not in progress');

  const isInitiator = String(run.initiated_by) === actor.id;
  const isAdmin = actor.is_super_admin || actor.user_type === 'system_admin' || actor.user_type === 'admin';
  if (!isInitiator && !isAdmin) throw forbidden('Only the initiator or an admin can cancel this run');

  run.status = 'cancelled';
  run.cancelled_by = new mongoose.Types.ObjectId(actor.id);
  run.rejection_reason = reason;
  run.last_activity_at = new Date();
  await run.save();

  await appendAudit({
    actor,
    action: 'RUN_CANCEL',
    entityType: 'task_runs',
    entityId: runId,
    description: reason ? `Run cancelled: ${reason}` : 'Run cancelled',
    runId,
    ipAddress: meta?.ip,
    officeCode: run.office_code,
    fiscalYear: run.fiscal_year,
    severity: 'warning',
  });

  return getRunDetail(runId, actor);
}

export async function getInbox(actor: AuthUser) {
  const roles = actor.workflow_roles.filter((r) => r.is_active).map((r) => r.role_code);
  if (roles.length === 0 && !actor.is_super_admin) return [];

  const filter: Record<string, unknown> = { status: 'in_progress' };
  if (!actor.is_super_admin) {
    filter.current_role = { $in: roles };
  }

  const runs = await TaskRun.find(filter).sort({ last_activity_at: -1 }).limit(50);
  return runs.map((run) => ({
    ...serializeRun(run),
    task_name: run.task_name_en,
  }));
}

export async function listRoles() {
  const { Role } = await import('./models/Role.model.js');
  const roles = await Role.find({ is_active: true }).sort({ level: 1 });
  return roles.map((r) => ({
    id: String(r._id),
    code: r.code,
    name_en: r.name_en,
    color: r.color,
    level: r.level,
    is_system: r.is_system,
  }));
}

function toAuthUser(user: InstanceType<typeof User>): AuthUser {
  return {
    id: String(user._id),
    email: user.email,
    user_type: user.user_type,
    status: user.status,
    is_super_admin: user.is_super_admin,
    workflow_roles: user.workflow_roles.map((r) => ({
      role_code: r.role_code,
      is_active: r.is_active,
    })),
  };
}

export async function listMyRuns(actor: AuthUser) {
  const runs = await TaskRun.find({ initiated_by: actor.id })
    .sort({ last_activity_at: -1 })
    .limit(30);
  return runs.map((run) => serializeRun(run));
}

export async function getMemberWorkflowSummary(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw notFound('User not found');

  const actor = toAuthUser(user);
  const [inboxItems, publishedTasks, myRuns] = await Promise.all([
    getInbox(actor),
    Task.find({ is_active: true, is_published: true }).select('_id name_en code total_steps'),
    TaskRun.find({ initiated_by: user._id }).sort({ last_activity_at: -1 }).limit(5),
  ]);

  const activeRoles = actor.workflow_roles.filter((r) => r.is_active).map((r) => r.role_code);

  let canStartCount = 0;
  for (const task of publishedTasks) {
    const firstStep = await TaskStep.findOne({ task_id: task._id, step_number: 1 }).select('role_code');
    if (firstStep && (userHasRole(actor, firstStep.role_code) || actor.is_super_admin)) {
      canStartCount += 1;
    }
  }

  return {
    inbox_count: inboxItems.length,
    published_task_count: publishedTasks.length,
    can_start_task_count: canStartCount,
    my_runs_in_progress: myRuns.filter((r) => r.status === 'in_progress').length,
    workflow_role_codes: activeRoles,
    recent_runs: myRuns.map((run) => serializeRun(run)),
  };
}
