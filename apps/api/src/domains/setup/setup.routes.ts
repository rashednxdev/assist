import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import {
  listDivisionsHandler,
  listDistrictsHandler,
  listThanasHandler,
  listModulesHandler,
  updateModuleHandler,
  listRolesHandler,
  geographyTreeHandler,
  createDivisionHandler,
  updateDivisionHandler,
  deleteDivisionHandler,
  createDistrictHandler,
  updateDistrictHandler,
  deleteDistrictHandler,
  createThanaHandler,
  updateThanaHandler,
  deleteThanaHandler,
} from './setup.controller.js';

export const setupRouter = Router();

setupRouter.use(authenticate, requireAdmin);

setupRouter.get('/geography/tree', asyncHandler(geographyTreeHandler));
setupRouter.get('/divisions', asyncHandler(listDivisionsHandler));
setupRouter.post('/divisions', asyncHandler(createDivisionHandler));
setupRouter.patch('/divisions/:id', asyncHandler(updateDivisionHandler));
setupRouter.delete('/divisions/:id', asyncHandler(deleteDivisionHandler));
setupRouter.get('/divisions/:divisionId/districts', asyncHandler(listDistrictsHandler));
setupRouter.post('/divisions/:divisionId/districts', asyncHandler(createDistrictHandler));
setupRouter.patch('/districts/:id', asyncHandler(updateDistrictHandler));
setupRouter.delete('/districts/:id', asyncHandler(deleteDistrictHandler));
setupRouter.get('/districts/:districtId/thanas', asyncHandler(listThanasHandler));
setupRouter.post('/districts/:districtId/thanas', asyncHandler(createThanaHandler));
setupRouter.patch('/thanas/:id', asyncHandler(updateThanaHandler));
setupRouter.delete('/thanas/:id', asyncHandler(deleteThanaHandler));
setupRouter.get('/modules', asyncHandler(listModulesHandler));
setupRouter.patch('/modules/:id', asyncHandler(updateModuleHandler));
setupRouter.get('/roles', asyncHandler(listRolesHandler));
