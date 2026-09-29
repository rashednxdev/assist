import { Module } from './models/Module.model.js';
import { logger } from '../../shared/logger.js';

const PLATFORM_MODULES = [
  {
    code: 'CIRCULARS',
    name_en: 'Circular Archive',
    description_en: 'Circulars, gazettes and clarifications from Finance Division, CAG, CGA and NBR',
    color: '#4338CA',
    sort_order: 30,
  },
];

/**
 * Inserts missing module rows only — never overwrites names, order or stop state set by admins.
 * iBAS++ area modules are created by `ensureDefaultAreas` and the Areas admin screen.
 */
export async function ensurePlatformModules(): Promise<void> {
  const res = await Module.bulkWrite(
    PLATFORM_MODULES.map((m) => ({
      updateOne: {
        filter: { code: m.code },
        update: { $setOnInsert: { ...m, is_active: true } },
        upsert: true,
      },
    })),
  );
  if (res.upsertedCount > 0) logger.info(`Added ${res.upsertedCount} platform module(s)`);
}
