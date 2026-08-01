import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { getTermsHandler, updateTermsHandler } from './terms.controller.js';

export const termsRouter = Router();

// Public — must be readable before a user registers/logs in.
termsRouter.get('/', asyncHandler(getTermsHandler));
termsRouter.put('/', authenticate, requireAdmin, asyncHandler(updateTermsHandler));
