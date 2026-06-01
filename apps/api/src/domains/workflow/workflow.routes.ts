import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import {
  listTasksHandler,
  getTaskHandler,
  createTaskHandler,
  updateTaskHandler,
  deleteTaskHandler,
  publishTaskHandler,
  listStepsHandler,
  createStepHandler,
  updateStepHandler,
  deleteStepHandler,
  reorderStepsHandler,
  startRunHandler,
  getRunHandler,
  respondStepHandler,
  cancelRunHandler,
  myRunsHandler,
  memberSummaryHandler,
  inboxHandler,
  listRolesHandler,
  listNotificationsHandler,
  markNotificationReadHandler,
  listAuditLogsHandler,
  markAllNotificationsReadHandler,
} from './workflow.controller.js';

export const workflowRouter = Router();
export const notificationsRouter = Router();
export const auditRouter = Router();

workflowRouter.use(authenticate);

workflowRouter.get('/roles', asyncHandler(listRolesHandler));
workflowRouter.get('/summary', asyncHandler(memberSummaryHandler));
workflowRouter.get('/inbox', asyncHandler(inboxHandler));
workflowRouter.get('/runs/mine', asyncHandler(myRunsHandler));
workflowRouter.get('/tasks', asyncHandler(listTasksHandler));
workflowRouter.get('/tasks/:id', asyncHandler(getTaskHandler));
workflowRouter.post('/tasks/:id/runs', asyncHandler(startRunHandler));
workflowRouter.get('/runs/:runId', asyncHandler(getRunHandler));
workflowRouter.post('/runs/:runId/steps/:stepNumber/respond', asyncHandler(respondStepHandler));
workflowRouter.post('/runs/:runId/cancel', asyncHandler(cancelRunHandler));

workflowRouter.post('/tasks', requireAdmin, asyncHandler(createTaskHandler));
workflowRouter.patch('/tasks/:id', requireAdmin, asyncHandler(updateTaskHandler));
workflowRouter.delete('/tasks/:id', requireAdmin, asyncHandler(deleteTaskHandler));
workflowRouter.post('/tasks/:id/publish', requireAdmin, asyncHandler(publishTaskHandler));

workflowRouter.get('/tasks/:id/steps', requireAdmin, asyncHandler(listStepsHandler));
workflowRouter.post('/tasks/:id/steps', requireAdmin, asyncHandler(createStepHandler));
workflowRouter.patch('/tasks/:id/steps/reorder', requireAdmin, asyncHandler(reorderStepsHandler));
workflowRouter.patch('/tasks/:id/steps/:stepId', requireAdmin, asyncHandler(updateStepHandler));
workflowRouter.delete('/tasks/:id/steps/:stepId', requireAdmin, asyncHandler(deleteStepHandler));

notificationsRouter.use(authenticate);
notificationsRouter.get('/', asyncHandler(listNotificationsHandler));
notificationsRouter.patch('/read-all', asyncHandler(markAllNotificationsReadHandler));
notificationsRouter.patch('/:id/read', asyncHandler(markNotificationReadHandler));

auditRouter.use(authenticate, requireAdmin);
auditRouter.get('/logs', asyncHandler(listAuditLogsHandler));
