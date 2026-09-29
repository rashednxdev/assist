import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../../middleware/auth.js';
import { loadModuleAccessChecker } from '../../middleware/moduleAccessChecker.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { unifiedSearch } from './search.service.js';

export const searchRouter = Router();

searchRouter.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const checker = await loadModuleAccessChecker(req.user!);
    res.json({ data: await unifiedSearch(String(req.query.q ?? ''), checker) });
  }),
);
