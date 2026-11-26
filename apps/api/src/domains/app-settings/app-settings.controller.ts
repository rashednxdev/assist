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

/** Public — no auth. Used by mobile ForceUpdateGate before/after login. */
export async function getMobileAppVersionHandler(req: AuthRequest, res: Response): Promise<void> {
  const current =
    (typeof req.query.current === 'string' ? req.query.current : null) ||
    (typeof req.headers['x-app-version'] === 'string' ? req.headers['x-app-version'] : null);
  res.json({ data: await appSettingsService.getMobileAppVersionPolicy(current) });
}
