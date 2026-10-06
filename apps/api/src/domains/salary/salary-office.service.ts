import mongoose from 'mongoose';
import {
  SALARY_OFFICE_REQUIRED_CODE,
  type OfficeOption,
  type SalaryOfficeRecord,
  type SalaryOfficeSettingsRecord,
  type SaveSalaryOfficeDto,
  type UpdateSalaryOfficeSettingsDto,
} from '@ibas/shared-types';
import { AppError, badRequest } from '../../shared/errors/AppError.js';
import { departmentOf, officeIndex, parentPath, type IndexedOffice } from '../org/org.service.js';
import { SalarySettings } from './models/SalarySettings.model.js';
import { SalaryUserOffice, type ISalaryUserOffice } from './models/SalaryUserOffice.model.js';

const SETTINGS_KEY = 'global';

export async function getSalaryOfficeSettings(): Promise<SalaryOfficeSettingsRecord> {
  const doc = await SalarySettings.findOne({ key: SETTINGS_KEY }).select('others_allowed updated_at').lean();
  return { others_allowed: doc?.others_allowed ?? true, updated_at: doc?.updated_at?.toISOString() ?? null };
}

export async function updateSalaryOfficeSettings(
  dto: UpdateSalaryOfficeSettingsDto,
  updatedBy: string,
): Promise<SalaryOfficeSettingsRecord> {
  await SalarySettings.findOneAndUpdate(
    { key: SETTINGS_KEY },
    {
      others_allowed: dto.others_allowed,
      updated_by: new mongoose.Types.ObjectId(updatedBy),
      updated_at: new Date(),
    },
    { upsert: true, setDefaultsOnInsert: true },
  );
  return getSalaryOfficeSettings();
}

function toOption(map: Map<string, IndexedOffice>, o: IndexedOffice): OfficeOption {
  return {
    id: o.id,
    name: o.name,
    short_name: o.short_name,
    office_code: o.office_code,
    parent_path: parentPath(map, o.parent_id),
  };
}

function officeName(o: OfficeOption): string {
  return o.short_name && o.short_name !== o.name ? `${o.name} (${o.short_name})` : o.name;
}

/** Null when nothing is saved or the listed office has since been removed or deactivated. */
function toRecord(map: Map<string, IndexedOffice>, doc: ISalaryUserOffice | null): SalaryOfficeRecord | null {
  if (!doc) return null;
  const circleNode = doc.circle_id ? map.get(String(doc.circle_id)) : undefined;
  const circle = circleNode?.is_active ? toOption(map, circleNode) : null;
  if (doc.office_id) {
    const node = map.get(String(doc.office_id));
    if (!node?.is_active) return null;
    const office = toOption(map, node);
    return { circle, office, other_office_name: '', label: officeName(office), updated_at: doc.updated_at.toISOString() };
  }
  if (!doc.other_office_name) return null;
  return {
    circle,
    office: null,
    other_office_name: doc.other_office_name,
    label: doc.other_office_name,
    updated_at: doc.updated_at.toISOString(),
  };
}

export async function getMySalaryOffice(userId: string): Promise<SalaryOfficeRecord | null> {
  const [map, doc] = await Promise.all([officeIndex(), SalaryUserOffice.findOne({ user_id: userId })]);
  return toRecord(map, doc);
}

export async function saveMySalaryOffice(userId: string, dto: SaveSalaryOfficeDto): Promise<SalaryOfficeRecord> {
  const map = await officeIndex();
  if (dto.circle_id) {
    const circle = map.get(dto.circle_id);
    if (!circle?.is_active || circle.parent_id) throw badRequest('Select a circle from the list');
  }
  if (dto.office_id) {
    const office = map.get(dto.office_id);
    if (!office?.is_active) throw badRequest('Select an office from the list');
    if (departmentOf(map, office.id)?.id !== dto.circle_id) throw badRequest('This office is not in the selected circle');
  } else if (!(await getSalaryOfficeSettings()).others_allowed) {
    throw badRequest('Choose your office from the list.');
  }
  const doc = await SalaryUserOffice.findOneAndUpdate(
    { user_id: userId },
    {
      $set: {
        circle_id: dto.circle_id ? new mongoose.Types.ObjectId(dto.circle_id) : null,
        office_id: dto.office_id ? new mongoose.Types.ObjectId(dto.office_id) : null,
        other_office_name: dto.office_id ? '' : dto.other_office_name,
        updated_at: new Date(),
      },
      $setOnInsert: { user_id: new mongoose.Types.ObjectId(userId) },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return toRecord(map, doc)!;
}

export async function assertSalaryOfficeChosen(userId: string): Promise<void> {
  if (!(await getMySalaryOffice(userId))) {
    throw new AppError(403, SALARY_OFFICE_REQUIRED_CODE, 'Select your office on the salary page first.');
  }
}

export async function salaryOfficeLabels(userIds: string[]): Promise<Map<string, string>> {
  const [map, docs] = await Promise.all([officeIndex(), SalaryUserOffice.find({ user_id: { $in: userIds } })]);
  const out = new Map<string, string>();
  for (const doc of docs) {
    const rec = toRecord(map, doc);
    if (rec) out.set(String(doc.user_id), rec.office ? rec.label : `${rec.label} (Others)`);
  }
  return out;
}
