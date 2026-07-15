import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import {
  getContentCacheStatusHandler,
  rebuildContentCacheHandler,
} from './content-cache.controller.js';

export const contentCacheRouter = Router();

contentCacheRouter.use(authenticate, requireAdmin);
contentCacheRouter.get('/status', asyncHandler(getContentCacheStatusHandler));
contentCacheRouter.post('/rebuild', asyncHandler(rebuildContentCacheHandler));
