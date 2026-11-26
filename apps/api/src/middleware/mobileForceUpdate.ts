import type { NextFunction, Request, Response } from 'express';
import { isMobileForceUpdateRequired } from '@ibas/shared-types';
import * as appSettingsService from '../domains/app-settings/app-settings.service.js';

const CACHE_TTL_MS = 60_000;
let cachedLatest: { version: string; updateUrl: string; message: string; at: number } | null =
  null;

async function resolveLatest(): Promise<{ version: string; updateUrl: string; message: string }> {
  const now = Date.now();
  if (cachedLatest && now - cachedLatest.at < CACHE_TTL_MS) {
    return cachedLatest;
  }
  const policy = await appSettingsService.getMobileAppVersionPolicy(null);
  cachedLatest = {
    version: policy.latest_version,
    updateUrl: policy.update_url,
    message: policy.force_message,
    at: now,
  };
  return cachedLatest;
}

/**
 * When mobile sends X-App-Version and its major.minor line is older than the
 * published latest line, block with 426 Upgrade Required (absolute prior versions).
 * Web clients omit the header and are unaffected.
 */
export async function mobileForceUpdateGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const path = req.path || '';
    if (
      path.startsWith('/api/v1/health') ||
      path.startsWith('/api/v1/app-settings/mobile-version')
    ) {
      next();
      return;
    }

    const header = req.headers['x-app-version'];
    const current = typeof header === 'string' ? header.trim() : '';
    if (!current) {
      next();
      return;
    }

    const latest = await resolveLatest();
    if (!isMobileForceUpdateRequired(current, latest.version)) {
      next();
      return;
    }

    res.status(426).json({
      error: {
        code: 'MOBILE_FORCE_UPDATE',
        message: latest.message,
        latest_version: latest.version,
        update_url: latest.updateUrl,
      },
    });
  } catch {
    next();
  }
}
