import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { errorHandler } from './shared/errors/errorHandler.js';
import { logger } from './shared/logger.js';
import { authRouter } from './domains/auth/auth.routes.js';
import { healthRouter } from './domains/health/health.routes.js';
import { usersRouter } from './domains/users/users.routes.js';
import { setupRouter } from './domains/setup/setup.routes.js';
import { workflowRouter, notificationsRouter, auditRouter } from './domains/workflow/workflow.routes.js';
import { booksRouter } from './domains/books/books.routes.js';
import { questionsRouter } from './domains/questions/questions.routes.js';
import { examsRouter } from './domains/exams/exams.routes.js';
import { syllabusRouter } from './domains/syllabus/syllabus.routes.js';
import { papersRouter } from './domains/papers/papers.routes.js';
import { accountRouter } from './domains/account/account.routes.js';

export function createApp(): Application {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));

  app.use(
    '/api/v1/auth',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/setup', setupRouter);
  app.use('/api/v1/workflow', workflowRouter);
  app.use('/api/v1/notifications', notificationsRouter);
  app.use('/api/v1/audit', auditRouter);
  app.use('/api/v1/books', booksRouter);
  app.use('/api/v1/questions', questionsRouter);
  app.use('/api/v1/exams', examsRouter);
  app.use('/api/v1/syllabus', syllabusRouter);
  app.use('/api/v1/papers', papersRouter);
  app.use('/api/v1/account', accountRouter);

  app.use(errorHandler);
  return app;
}
