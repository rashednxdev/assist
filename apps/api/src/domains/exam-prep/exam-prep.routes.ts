import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../../middleware/auth.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { listPartsForUser, selectPart } from './exam-prep.service.js';
import { chapterPractice, listPreparationSubjects, preparationWorkspace } from './subject-workspace.service.js';

/** Exam Preparation part picker (Part 1 / Part 2 …) and subject-first workspace endpoints. */
export const examPrepRouter = Router();

examPrepRouter.use(authenticate);

examPrepRouter.get(
  '/parts',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await listPartsForUser(req.user!) });
  }),
);

examPrepRouter.get(
  '/subjects',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await listPreparationSubjects(req.user!) });
  }),
);

examPrepRouter.get(
  '/subjects/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const read = req.query.read === 'read' || req.query.read === 'unread' ? req.query.read : 'all';
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const book_id = typeof req.query.book_id === 'string' ? req.query.book_id : undefined;
    res.json({
      data: await preparationWorkspace(req.user!, String(req.params.id), { read, q, book_id }),
    });
  }),
);

examPrepRouter.get(
  '/subjects/:id/chapters/:chapterId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({
      data: await chapterPractice(req.user!, String(req.params.id), String(req.params.chapterId), req.query.wrong === '1'),
    });
  }),
);

examPrepRouter.put(
  '/part',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await selectPart(req.user!, req.body) });
  }),
);
