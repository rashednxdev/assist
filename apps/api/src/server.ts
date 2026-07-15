import 'dotenv/config';
import { createApp } from './app.js';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { loadCacheFromDisk } from './domains/content-cache/cache-store.js';
import { logger } from './shared/logger.js';

async function main() {
  await connectDb();
  await loadCacheFromDisk();
  const app = createApp();
  app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`API listening on port ${env.PORT}`);
  });
}

main().catch((err) => {
  logger.error(err, 'Failed to start server');
  process.exit(1);
});
