import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import {
  listDivisionsHandler,
  listDistrictsHandler,
  listThanasHandler,
  listModulesHandler,
  listRolesHandler,
  geographyTreeHandler,
  createDivisionHandler,
  updateDivisionHandler,
  createDistrictHandler,
  updateDistrictHandler,
  createThanaHandler,
  updateThanaHandler,
} from './setup.controller.js';

export const setupRouter = Router();

setupRouter.use(authenticate, requireAdmin);

setupRouter.get('/geography/tree', asyncHandler(geographyTreeHandler));
setupRouter.get('/divisions', asyncHandler(listDivisionsHandler));
setupRouter.post('/divisions', asyncHandler(createDivisionHandler));
setupRouter.patch('/divisions/:id', asyncHandler(updateDivisionHandler));
setupRouter.get('/divisions/:divisionId/districts', asyncHandler(listDistrictsHandler));
setupRouter.post('/divisions/:divisionId/districts', asyncHandler(createDistrictHandler));
setupRouter.patch('/districts/:id', asyncHandler(updateDistrictHandler));
setupRouter.get('/districts/:districtId/thanas', asyncHandler(listThanasHandler));
setupRouter.post('/districts/:districtId/thanas', asyncHandler(createThanaHandler));
setupRouter.patch('/thanas/:id', asyncHandler(updateThanaHandler));
setupRouter.get('/modules', asyncHandler(listModulesHandler));
setupRouter.get('/roles', asyncHandler(listRolesHandler));
