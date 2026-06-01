import type { Response } from 'express';
import { createDivisionSchema, updateGeoSchema } from '@ibas/shared-types';
import type { AuthRequest } from '../../middleware/auth.js';
import * as setupService from './setup.service.js';

export async function listDivisionsHandler(req: AuthRequest, res: Response): Promise<void> {
  const all = req.query.all === 'true';
  const data = await setupService.listDivisions(all);
  res.json({ data });
}

export async function listDistrictsHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await setupService.listDistricts(String(req.params.divisionId));
  res.json({ data });
}

export async function listThanasHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await setupService.listThanas(String(req.params.districtId));
  res.json({ data });
}

export async function listModulesHandler(_req: AuthRequest, res: Response): Promise<void> {
  const data = await setupService.listModules();
  res.json({ data });
}

export async function listRolesHandler(_req: AuthRequest, res: Response): Promise<void> {
  const data = await setupService.listRoles();
  res.json({ data });
}

export async function geographyTreeHandler(_req: AuthRequest, res: Response): Promise<void> {
  const data = await setupService.getGeographyTree();
  res.json({ data });
}

export async function createDivisionHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createDivisionSchema.parse(req.body);
  const data = await setupService.createDivision(dto);
  res.status(201).json({ data });
}

export async function updateDivisionHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateGeoSchema.parse(req.body);
  const data = await setupService.updateDivision(String(req.params.id), dto);
  res.json({ data });
}

export async function createDistrictHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createDivisionSchema.parse(req.body);
  const data = await setupService.createDistrict(String(req.params.divisionId), dto);
  res.status(201).json({ data });
}

export async function updateDistrictHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateGeoSchema.parse(req.body);
  const data = await setupService.updateDistrict(String(req.params.id), dto);
  res.json({ data });
}

export async function createThanaHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createDivisionSchema.parse(req.body);
  const data = await setupService.createThana(String(req.params.districtId), dto);
  res.status(201).json({ data });
}

export async function updateThanaHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateGeoSchema.parse(req.body);
  const data = await setupService.updateThana(String(req.params.id), dto);
  res.json({ data });
}
