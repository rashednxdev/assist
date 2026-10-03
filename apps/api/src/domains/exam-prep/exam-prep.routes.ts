import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../../middleware/auth.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { listPartsForUser, selectPart } from './exam-prep.service.js';

/** Exam Preparation part picker (Part 1 / Part 2 …) and what the learner owns in each part. */
export const examPrepRouter = Router();

examPrepRouter.use(authenticate);

examPrepRouter.get(
  '/parts',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await listPartsForUser(req.user!) });
  }),
);

examPrepRouter.put(
  '/part',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ data: await selectPart(req.user!, req.body) });
  }),
);
