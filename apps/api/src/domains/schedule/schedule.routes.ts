import { Router, type Response } from 'express';
import { scheduleFeedQuerySchema } from '@ibas/shared-types';
import { authenticate, type AuthRequest } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { schedulePdfUpload } from './schedule.storage.js';
import * as schedule from './schedule.service.js';
import * as types from './schedule-types.service.js';

/** Schedule module — free for every signed-in user; universal items are managed by admins. */
export const scheduleRouter = Router();

scheduleRouter.use(authenticate);

scheduleRouter.get(
  '/feed',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { from, to } = scheduleFeedQuerySchema.parse(req.query);
    res.json({ data: await schedule.getFeed(req.user!, from, to) });
  }),
);

scheduleRouter.get(
  '/rest-recreation',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await schedule.getRestRecreation(req.user!.id) });
  }),
);

scheduleRouter.put(
  '/profile',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await schedule.updateProfile(req.user!.id, req.body);
    res.json({ data: await schedule.getRestRecreation(req.user!.id) });
  }),
);

scheduleRouter.get(
  '/settings',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json({ data: await schedule.getSettings() });
  }),
);

scheduleRouter.put(
  '/settings',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await schedule.updateSettings(req.body, req.user!.id) });
  }),
);

scheduleRouter.get(
  '/types',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const admin = schedule.isAdminUser(req.user!);
    res.json({ data: await types.listTypes(admin && req.query.all === 'true', admin && req.query.all === 'true') });
  }),
);

scheduleRouter.post(
  '/types',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.status(201).json({ data: await types.createType(req.body, req.user!.id) });
  }),
);

scheduleRouter.put(
  '/types/:id',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await types.updateType(String(req.params.id), req.body, req.user!.id) });
  }),
);

scheduleRouter.delete(
  '/types/:id',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await types.deleteType(String(req.params.id));
    res.json({ data: { ok: true } });
  }),
);

scheduleRouter.get(
  '/admin/events',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const rows = await schedule.listUniversal(String(req.query.q ?? ''), req.query.include_past === 'true', req.user!);
    res.json({ data: rows.map((r) => schedule.toRecord(r.doc, req.user!, r.links, r.audience)) });
  }),
);

scheduleRouter.post(
  '/admin/audience-preview',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await schedule.previewAudience(req.body) });
  }),
);

scheduleRouter.get(
  '/admin/link-options',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await schedule.linkOptions(String(req.query.q ?? '')) });
  }),
);

for (const [action, fn] of [
  ['postpone', schedule.postponeEvent],
  ['cancel', schedule.cancelEvent],
  ['restore', schedule.restoreEvent],
] as const) {
  scheduleRouter.post(
    `/events/:id/${action}`,
    asyncHandler(async (req: AuthRequest, res: Response) => {
      res.json({ data: await fn(String(req.params.id), req.body, req.user!) });
    }),
  );
}

scheduleRouter.post(
  '/events',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.status(201).json({ data: await schedule.createEvent(req.body, req.user!) });
  }),
);

scheduleRouter.get(
  '/events/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await schedule.getEvent(String(req.params.id), req.user!) });
  }),
);

scheduleRouter.put(
  '/events/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await schedule.updateEvent(String(req.params.id), req.body, req.user!) });
  }),
);

scheduleRouter.delete(
  '/events/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await schedule.deleteEvent(String(req.params.id), req.user!);
    res.json({ data: { ok: true } });
  }),
);

scheduleRouter.post(
  '/events/:id/attachments',
  requireAdmin,
  schedulePdfUpload.single('pdf'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.status(201).json({ data: await schedule.addAttachment(String(req.params.id), req.file, req.user!) });
  }),
);

scheduleRouter.delete(
  '/events/:id/attachments/:fileId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await schedule.removeAttachment(String(req.params.id), String(req.params.fileId), req.user!) });
  }),
);

scheduleRouter.get(
  '/events/:id/attachments/:fileId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const file = await schedule.getAttachmentFile(String(req.params.id), String(req.params.fileId), req.user!);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    await new Promise<void>((resolve, reject) => {
      res.sendFile(file.path, (err) => {
        if (!err) return resolve();
        if (!res.headersSent) {
          res.removeHeader('Content-Disposition');
          res.status(404).json({ error: { code: 'NOT_FOUND', message: 'File is missing on the server' } });
          return resolve();
        }
        reject(err);
      });
    });
  }),
);
