import type { Response } from 'express';
import { updateAppSettingsSchema } from '@ibas/shared-types';
import type { AuthRequest } from '../../middleware/auth.js';
import * as appSettingsService from './app-settings.service.js';

export async function getAppSettingsHandler(_req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await appSettingsService.getAppSettings() });
}

export async function updateAppSettingsHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateAppSettingsSchema.parse(req.body);
  res.json({ data: await appSettingsService.updateAppSettings(dto, req.user!.id) });
}
