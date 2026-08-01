import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { requireModuleAccess } from '../../middleware/requireModuleAccess.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { submitHandler, listMineHandler, listAdminHandler, acceptHandler, rejectHandler } from './user-questions.controller.js';

export const userQuestionsRouter = Router();

userQuestionsRouter.use(authenticate);

const readAccess = requireModuleAccess('USER_QUESTIONS');

userQuestionsRouter.post('/', readAccess, asyncHandler(submitHandler));
userQuestionsRouter.get('/mine', readAccess, asyncHandler(listMineHandler));

userQuestionsRouter.get('/admin', requireAdmin, asyncHandler(listAdminHandler));
userQuestionsRouter.post('/:id/accept', requireAdmin, asyncHandler(acceptHandler));
userQuestionsRouter.post('/:id/reject', requireAdmin, asyncHandler(rejectHandler));
