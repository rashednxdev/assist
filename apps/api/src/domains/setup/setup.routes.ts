import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { requireModulePermission } from '../../middleware/requireModulePermission.js';
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

setupRouter.use(authenticate);

/** Users admin UI needs the module catalog; SETUP grant or USER grant (admins bypass). */
const modulesCatalogAccess = requireModulePermission([
  { moduleCode: 'SETUP', permission: 'can_read' },
  { moduleCode: 'USER', permission: 'can_read' },
]);
const rolesCatalogAccess = requireModulePermission([
  { moduleCode: 'SETUP', permission: 'can_read' },
  { moduleCode: 'USER', permission: 'can_read' },
]);

setupRouter.get('/geography/tree', requireAdmin, asyncHandler(geographyTreeHandler));
setupRouter.get('/divisions', requireAdmin, asyncHandler(listDivisionsHandler));
setupRouter.post('/divisions', requireAdmin, asyncHandler(createDivisionHandler));
setupRouter.patch('/divisions/:id', requireAdmin, asyncHandler(updateDivisionHandler));
setupRouter.delete('/divisions/:id', requireAdmin, asyncHandler(deleteDivisionHandler));
setupRouter.get('/divisions/:divisionId/districts', requireAdmin, asyncHandler(listDistrictsHandler));
setupRouter.post('/divisions/:divisionId/districts', requireAdmin, asyncHandler(createDistrictHandler));
setupRouter.patch('/districts/:id', requireAdmin, asyncHandler(updateDistrictHandler));
setupRouter.delete('/districts/:id', requireAdmin, asyncHandler(deleteDistrictHandler));
setupRouter.get('/districts/:districtId/thanas', requireAdmin, asyncHandler(listThanasHandler));
setupRouter.post('/districts/:districtId/thanas', requireAdmin, asyncHandler(createThanaHandler));
setupRouter.patch('/thanas/:id', requireAdmin, asyncHandler(updateThanaHandler));
setupRouter.delete('/thanas/:id', requireAdmin, asyncHandler(deleteThanaHandler));
setupRouter.get('/modules', modulesCatalogAccess, asyncHandler(listModulesHandler));
setupRouter.patch('/modules/:id', requireAdmin, asyncHandler(updateModuleHandler));
setupRouter.get('/roles', rolesCatalogAccess, asyncHandler(listRolesHandler));
