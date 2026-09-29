import 'dotenv/config';
import { createApp } from './app.js';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { loadCacheFromDisk } from './domains/content-cache/cache-store.js';
import { logger } from './shared/logger.js';
import { ensurePlatformModules } from './domains/setup/ensure-platform-modules.js';
import { ensureDefaultAreas } from './domains/policy/areas.service.js';
import { startScheduleRunner } from './domains/schedule/schedule.runner.js';
import { ensureDefaultScheduleTypes } from './domains/schedule/schedule-types.service.js';
import { ensureDefaultCommunityCategories } from './domains/community/community.service.js';

async function main() {
  await connectDb();
  await loadCacheFromDisk();
  await ensurePlatformModules().catch((err) => logger.warn(err, 'Could not ensure platform modules'));
  await ensureDefaultAreas().catch((err) => logger.warn(err, 'Could not ensure iBAS++ areas'));
  await ensureDefaultScheduleTypes().catch((err) => logger.warn(err, 'Could not ensure schedule types'));
  await ensureDefaultCommunityCategories().catch((err) => logger.warn(err, 'Could not ensure community categories'));
  const app = createApp();
  app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`API listening on port ${env.PORT}`);
  });
  if (env.SCHEDULE_RUNNER === 'true') startScheduleRunner();
}

main().catch((err) => {
  logger.error(err, 'Failed to start server');
  process.exit(1);
});
