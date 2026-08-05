import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { loginHandler, logoutHandler, meHandler } from './auth.controller.js';
import {
  registerHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
} from '../account/account.controller.js';

export const authRouter = Router();

authRouter.post('/register', asyncHandler(registerHandler));
authRouter.post('/login', asyncHandler(loginHandler));
authRouter.post('/logout', asyncHandler(logoutHandler));
authRouter.post('/password/forgot', asyncHandler(forgotPasswordHandler));
authRouter.post('/password/reset', asyncHandler(resetPasswordHandler));
authRouter.get('/me', authenticate, asyncHandler(meHandler));
