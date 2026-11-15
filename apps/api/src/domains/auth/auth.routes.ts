import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { loginHandler, loginOtpHandler, loginOtpResendHandler, logoutHandler, meHandler } from './auth.controller.js';
import {
  registerHandler,
  verifyRegisterOtpHandler,
  resendRegisterOtpHandler,
  forgotPasswordHandler,
  verifyResetOtpHandler,
  resetPasswordHandler,
} from '../account/account.controller.js';

export const authRouter = Router();

authRouter.post('/register', asyncHandler(registerHandler));
authRouter.post('/register/verify', asyncHandler(verifyRegisterOtpHandler));
authRouter.post('/register/resend', asyncHandler(resendRegisterOtpHandler));
authRouter.post('/login', asyncHandler(loginHandler));
authRouter.post('/login/otp', asyncHandler(loginOtpHandler));
authRouter.post('/login/otp/resend', asyncHandler(loginOtpResendHandler));
authRouter.post('/logout', asyncHandler(logoutHandler));
authRouter.post('/password/forgot', asyncHandler(forgotPasswordHandler));
authRouter.post('/password/forgot/verify', asyncHandler(verifyResetOtpHandler));
authRouter.post('/password/reset', asyncHandler(resetPasswordHandler));
authRouter.get('/me', authenticate, asyncHandler(meHandler));
