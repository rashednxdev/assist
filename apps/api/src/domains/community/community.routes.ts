import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import * as community from './community.service.js';

/** Community discussions: free for every signed-in user. */
export const communityRouter = Router();

communityRouter.use(authenticate);

const str = (v: unknown) => (typeof v === 'string' ? v : '');

communityRouter.get(
  '/overview',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json({ data: await community.getOverview() });
  }),
);

communityRouter.get(
  '/categories',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const all = req.query.all === 'true' && community.isAdminUser(req.user!);
    res.json({ data: await community.listCategories(all) });
  }),
);

communityRouter.get(
  '/link-options',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await community.linkOptions(str(req.query.q), str(req.query.kind) || undefined) });
  }),
);

communityRouter.get(
  '/threads',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { items, ...meta } = await community.listThreads(req.query, req.user!);
    res.json({ data: items, meta });
  }),
);

communityRouter.post(
  '/threads',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.status(201).json({ data: await community.createThread(req.user!, req.body) });
  }),
);

communityRouter.get(
  '/threads/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await community.getThread(String(req.params.id), req.user!, req.query.view !== 'false') });
  }),
);

communityRouter.put(
  '/threads/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await community.updateThread(String(req.params.id), req.body, req.user!) });
  }),
);

communityRouter.delete(
  '/threads/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await community.deleteThread(String(req.params.id), req.user!);
    res.json({ data: { ok: true } });
  }),
);

communityRouter.post(
  '/threads/:id/vote',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await community.toggleVote('thread', String(req.params.id), req.user!) });
  }),
);

communityRouter.post(
  '/threads/:id/follow',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await community.toggleFollow(String(req.params.id), req.user!) });
  }),
);

communityRouter.post(
  '/threads/:id/accept',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const answerId = typeof req.body?.answer_id === 'string' && req.body.answer_id ? req.body.answer_id : null;
    res.json({ data: await community.acceptAnswer(String(req.params.id), answerId, req.user!) });
  }),
);

communityRouter.post(
  '/threads/:id/answers',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.status(201).json({ data: await community.createAnswer(String(req.params.id), req.body, req.user!) });
  }),
);

communityRouter.put(
  '/answers/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await community.updateAnswer(String(req.params.id), req.body, req.user!) });
  }),
);

communityRouter.delete(
  '/answers/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await community.deleteAnswer(String(req.params.id), req.user!);
    res.json({ data: { ok: true } });
  }),
);

communityRouter.post(
  '/answers/:id/vote',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await community.toggleVote('answer', String(req.params.id), req.user!) });
  }),
);

communityRouter.post(
  '/reports',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.status(201).json({ data: await community.reportContent(req.body, req.user!) });
  }),
);

/* --------------------------------- admin --------------------------------- */

communityRouter.post(
  '/admin/categories',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.status(201).json({ data: await community.createCategory(req.body, req.user!.id) });
  }),
);

communityRouter.put(
  '/admin/categories/:id',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await community.updateCategory(String(req.params.id), req.body, req.user!.id) });
  }),
);

communityRouter.delete(
  '/admin/categories/:id',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await community.deleteCategory(String(req.params.id));
    res.json({ data: { ok: true } });
  }),
);

communityRouter.post(
  '/admin/threads/:id/moderate',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await community.moderateThread(String(req.params.id), req.body, req.user!) });
  }),
);

communityRouter.post(
  '/admin/answers/:id/moderate',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await community.moderateAnswer(String(req.params.id), req.body, req.user!) });
  }),
);

communityRouter.get(
  '/admin/reports',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await community.listReports(str(req.query.status) || undefined) });
  }),
);

communityRouter.post(
  '/admin/reports/:id/resolve',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await community.resolveReport(String(req.params.id), req.body, req.user!) });
  }),
);
