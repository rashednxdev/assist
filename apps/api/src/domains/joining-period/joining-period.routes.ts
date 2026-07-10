import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { calculateJoiningPeriodHandler } from './joining-period.controller.js';

export const joiningPeriodRouter = Router();

joiningPeriodRouter.use(authenticate);
joiningPeriodRouter.post('/calculate', asyncHandler(calculateJoiningPeriodHandler));
