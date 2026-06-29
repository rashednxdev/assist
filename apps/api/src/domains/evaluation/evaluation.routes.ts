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
} from './evaluation.controller.js';

export const evaluationRouter = Router();

evaluationRouter.use(authenticate);

evaluationRouter.get('/questions/batch', asyncHandler(batchQuestionEvaluationsHandler));
evaluationRouter.get('/questions/:questionId/practice', asyncHandler(getQuestionPracticeStemHandler));
evaluationRouter.get('/questions/:questionId', asyncHandler(getQuestionEvaluationHandler));
evaluationRouter.put('/questions/:questionId', asyncHandler(upsertQuestionEvaluationHandler));

evaluationRouter.get('/books/:bookId', asyncHandler(getBookEvaluationHandler));
evaluationRouter.get('/papers/:paperId', asyncHandler(getPaperEvaluationHandler));
