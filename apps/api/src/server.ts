import 'dotenv/config';
import { createApp } from './app.js';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './shared/logger.js';

async function main() {
  await connectDb();
  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  logger.error(err, 'Failed to start server');
  process.exit(1);
});
