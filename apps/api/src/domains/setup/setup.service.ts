import { Division } from './models/Division.model.js';
import { District } from './models/District.model.js';
import { Thana } from './models/Thana.model.js';
import { Module } from './models/Module.model.js';
import { Role } from '../workflow/models/Role.model.js';
import { notFound, badRequest } from '../../shared/errors/AppError.js';
import type { z } from 'zod';
import { createDivisionSchema, updateGeoSchema } from '@ibas/shared-types';

type CreateDivisionDto = z.infer<typeof createDivisionSchema>;
type UpdateGeoDto = z.infer<typeof updateGeoSchema>;

export async function listDivisions(includeInactive = false) {
  const filter = includeInactive ? {} : { is_active: true };
  return Division.find(filter).sort({ name_en: 1 }).lean();
}

export async function listDistricts(divisionId: string, includeInactive = false) {
  const filter: Record<string, unknown> = { division_id: divisionId };
  if (!includeInactive) filter.is_active = true;
  return District.find(filter).sort({ name_en: 1 }).lean();
}

export async function listThanas(districtId: string, includeInactive = false) {
  const filter: Record<string, unknown> = { district_id: districtId };
  if (!includeInactive) filter.is_active = true;
  return Thana.find(filter).sort({ name_en: 1 }).lean();
}

export async function listModules() {
  return Module.find({ is_active: true }).sort({ sort_order: 1 }).lean();
}

export async function listRoles() {
  return Role.find({ is_active: true }).sort({ level: 1 }).lean();
}

export async function createDivision(dto: CreateDivisionDto) {
  return Division.create({ ...dto, is_active: true });
}

export async function updateDivision(id: string, dto: UpdateGeoDto) {
  const doc = await Division.findByIdAndUpdate(id, dto, { new: true });
  if (!doc) throw notFound('Division not found');
  return doc;
}

export async function deleteDivision(id: string) {
  const doc = await Division.findById(id);
  if (!doc) throw notFound('Division not found');
  const districtCount = await District.countDocuments({ division_id: doc._id, is_active: true });
  if (districtCount > 0) throw badRequest('Remove districts in this division first');
  doc.is_active = false;
  await doc.save();
  return { deleted: true };
}

export async function createDistrict(divisionId: string, dto: CreateDivisionDto) {
  const division = await Division.findById(divisionId);
  if (!division) throw notFound('Division not found');
  return District.create({ ...dto, division_id: division._id, is_active: true });
}

export async function updateDistrict(id: string, dto: UpdateGeoDto) {
  const doc = await District.findByIdAndUpdate(id, dto, { new: true });
  if (!doc) throw notFound('District not found');
  return doc;
}

export async function deleteDistrict(id: string) {
  const doc = await District.findById(id);
  if (!doc) throw notFound('District not found');
  const thanaCount = await Thana.countDocuments({ district_id: doc._id, is_active: true });
  if (thanaCount > 0) throw badRequest('Remove thanas in this district first');
  doc.is_active = false;
  await doc.save();
  return { deleted: true };
}

export async function createThana(districtId: string, dto: CreateDivisionDto) {
  const district = await District.findById(districtId);
  if (!district) throw notFound('District not found');
  return Thana.create({ ...dto, district_id: district._id, is_active: true });
}

export async function updateThana(id: string, dto: UpdateGeoDto) {
  const doc = await Thana.findByIdAndUpdate(id, dto, { new: true });
  if (!doc) throw notFound('Thana not found');
  return doc;
}

export async function deleteThana(id: string) {
  const doc = await Thana.findById(id);
  if (!doc) throw notFound('Thana not found');
  doc.is_active = false;
  await doc.save();
  return { deleted: true };
}

export async function getGeographyTree(): Promise<object[]> {
  const divisions = await Division.find({ is_active: true }).sort({ name_en: 1 }).lean();
  const districts = await District.find({ is_active: true }).lean();
  const thanas = await Thana.find({ is_active: true }).lean();

  return divisions.map((d) => ({
    ...d,
    districts: districts
      .filter((dist) => String(dist.division_id) === String(d._id))
      .map((dist) => ({
        ...dist,
        thanas: thanas.filter((t) => String(t.district_id) === String(dist._id)),
      })),
  }));
}
