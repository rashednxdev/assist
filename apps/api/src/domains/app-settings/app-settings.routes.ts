import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { getAppSettingsHandler, updateAppSettingsHandler } from './app-settings.controller.js';

export const appSettingsRouter = Router();

appSettingsRouter.get('/', authenticate, asyncHandler(getAppSettingsHandler));
appSettingsRouter.put('/', authenticate, requireAdmin, asyncHandler(updateAppSettingsHandler));
