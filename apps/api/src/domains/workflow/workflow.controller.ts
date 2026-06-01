import type { Response } from 'express';
import {
  createTaskSchema,
  updateTaskSchema,
  createStepSchema,
  updateStepSchema,
  reorderStepsSchema,
  startRunSchema,
  cancelRunSchema,
  respondStepSchema,
} from '@ibas/shared-types';
import type { AuthRequest } from '../../middleware/auth.js';
import * as tasksService from './tasks.service.js';
import * as stepsService from './steps.service.js';
import * as workflowService from './workflow.service.js';
import * as notificationsService from './notifications.service.js';
import * as auditService from './audit.service.js';
import { parsePagination } from '../../shared/pagination.js';

function isAdmin(user: AuthRequest['user']) {
  return user?.is_super_admin || user?.user_type === 'system_admin' || user?.user_type === 'admin';
}

export async function listTasksHandler(req: AuthRequest, res: Response): Promise<void> {
  const publishedOnly = !isAdmin(req.user);
  const data = await tasksService.listTasks(publishedOnly);
  res.json({ data });
}

export async function getTaskHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await tasksService.getTaskById(String(req.params.id));
  res.json({ data });
}

export async function createTaskHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createTaskSchema.parse(req.body);
  const data = await tasksService.createTask(dto, req.user!.id);
  res.status(201).json({ data });
}

export async function updateTaskHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateTaskSchema.parse(req.body);
  const data = await tasksService.updateTask(String(req.params.id), dto, req.user!.id);
  res.json({ data });
}

export async function deleteTaskHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await tasksService.deleteTask(String(req.params.id));
  res.json({ data });
}

export async function publishTaskHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await tasksService.publishTask(String(req.params.id), req.user!.id);
  res.json({ data });
}

export async function listStepsHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await stepsService.listSteps(String(req.params.id));
  res.json({ data });
}

export async function createStepHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createStepSchema.parse(req.body);
  const data = await stepsService.createStep(String(req.params.id), dto);
  res.status(201).json({ data });
}

export async function updateStepHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateStepSchema.parse(req.body);
  const data = await stepsService.updateStep(String(req.params.id), String(req.params.stepId), dto);
  res.json({ data });
}

export async function deleteStepHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await stepsService.deleteStep(String(req.params.id), String(req.params.stepId));
  res.json({ data });
}

export async function reorderStepsHandler(req: AuthRequest, res: Response): Promise<void> {
  const { step_ids } = reorderStepsSchema.parse(req.body);
  const data = await stepsService.reorderSteps(String(req.params.id), step_ids);
  res.json({ data });
}

export async function startRunHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = startRunSchema.parse(req.body);
  const data = await workflowService.startRun(String(req.params.id), dto, req.user!, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.status(201).json({ data });
}

export async function getRunHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await workflowService.getRunDetail(String(req.params.runId), req.user!);
  res.json({ data });
}

export async function respondStepHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = respondStepSchema.parse(req.body);
  const stepNumber = parseInt(String(req.params.stepNumber), 10);
  const data = await workflowService.respondToStep(String(req.params.runId), stepNumber, dto, req.user!, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.json({ data });
}

export async function cancelRunHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = cancelRunSchema.parse(req.body ?? {});
  const data = await workflowService.cancelRun(String(req.params.runId), req.user!, dto.reason, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.json({ data });
}

export async function myRunsHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await workflowService.listMyRuns(req.user!);
  res.json({ data });
}

export async function memberSummaryHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await workflowService.getMemberWorkflowSummary(req.user!.id);
  res.json({ data });
}

export async function inboxHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await workflowService.getInbox(req.user!);
  res.json({ data });
}

export async function listRolesHandler(_req: AuthRequest, res: Response): Promise<void> {
  const data = await workflowService.listRoles();
  res.json({ data });
}

export async function listNotificationsHandler(req: AuthRequest, res: Response): Promise<void> {
  const unreadOnly = req.query.unread === 'true';
  const data = await notificationsService.listNotifications(req.user!.id, unreadOnly);
  res.json({ data });
}

export async function markNotificationReadHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await notificationsService.markNotificationRead(req.user!.id, String(req.params.id));
  if (!data) {
    res.status(404).json({ error: { message: 'Notification not found' } });
    return;
  }
  res.json({ data });
}

export async function markAllNotificationsReadHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await notificationsService.markAllNotificationsRead(req.user!.id);
  res.json({ data });
}

export async function listAuditLogsHandler(req: AuthRequest, res: Response): Promise<void> {
  const { skip, limit } = parsePagination(req);
  const data = await auditService.listAuditLogs({ skip, limit });
  res.json({ data: data.items, meta: { total: data.total, skip, limit } });
}
