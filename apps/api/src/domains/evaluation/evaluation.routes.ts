import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import {
  getQuestionEvaluationHandler,
  getQuestionPracticeStemHandler,
  batchQuestionEvaluationsHandler,
  upsertQuestionEvaluationHandler,
  getBookEvaluationHandler,
  getPaperEvaluationHandler,
  getProgressDashboardHandler,
  submitPaperAttemptHandler,
  listPaperAttemptsHandler,
} from './evaluation.controller.js';

export const evaluationRouter = Router();

evaluationRouter.use(authenticate);

evaluationRouter.get('/dashboard', asyncHandler(getProgressDashboardHandler));
evaluationRouter.get('/questions/batch', asyncHandler(batchQuestionEvaluationsHandler));
evaluationRouter.get('/questions/:questionId/practice', asyncHandler(getQuestionPracticeStemHandler));
evaluationRouter.get('/questions/:questionId', asyncHandler(getQuestionEvaluationHandler));
evaluationRouter.put('/questions/:questionId', asyncHandler(upsertQuestionEvaluationHandler));

evaluationRouter.get('/books/:bookId', asyncHandler(getBookEvaluationHandler));
evaluationRouter.get('/papers/:paperId', asyncHandler(getPaperEvaluationHandler));
evaluationRouter.get('/papers/:paperId/attempts', asyncHandler(listPaperAttemptsHandler));
evaluationRouter.post('/papers/:paperId/attempts', asyncHandler(submitPaperAttemptHandler));