import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import {
  getAppSettingsHandler,
  getMobileAppVersionHandler,
  updateAppSettingsHandler,
} from './app-settings.controller.js';

export const appSettingsRouter = Router();

/** Public mobile version policy (force-update). Must stay unauthenticated. */
appSettingsRouter.get('/mobile-version', asyncHandler(getMobileAppVersionHandler));

appSettingsRouter.get('/', authenticate, asyncHandler(getAppSettingsHandler));
appSettingsRouter.put('/', authenticate, requireAdmin, asyncHandler(updateAppSettingsHandler));
