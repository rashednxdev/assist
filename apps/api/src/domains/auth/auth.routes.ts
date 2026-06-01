import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { loginHandler, logoutHandler, meHandler } from './auth.controller.js';
import { registerHandler } from '../account/account.controller.js';

export const authRouter = Router();

authRouter.post('/register', asyncHandler(registerHandler));
authRouter.post('/login', asyncHandler(loginHandler));
authRouter.post('/logout', asyncHandler(logoutHandler));
authRouter.get('/me', authenticate, asyncHandler(meHandler));
