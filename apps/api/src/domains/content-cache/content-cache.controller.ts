import type { Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../../middleware/auth.js';
import { CONTENT_CACHE_KEYS } from './cache-store.js';
import { contentCacheStatus, rebuildContentCache } from './content-cache.service.js';

const rebuildSchema = z.object({
  keys: z.array(z.enum(CONTENT_CACHE_KEYS)).optional(),
});

export async function getContentCacheStatusHandler(_req: AuthRequest, res: Response): Promise<void> {
  const data = await contentCacheStatus();
  res.json({ data });
}

export async function rebuildContentCacheHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = rebuildSchema.parse(req.body ?? {});
  const data = await rebuildContentCache(dto.keys);
  res.json({ data });
}
