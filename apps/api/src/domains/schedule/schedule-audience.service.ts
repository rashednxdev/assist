import mongoose, { type FilterQuery, type Types } from 'mongoose';
import {
  SCHEDULE_TARGET_LABELS,
  scheduleAudienceSchema,
  type ScheduleTargetLocation,
  type ScheduleTargetOffice,
  type ScheduleTargetType,
} from '@ibas/shared-types';
import { badRequest } from '../../shared/errors/AppError.js';
import { User } from '../users/models/User.model.js';
import { OfficeType } from '../org/models/OfficeType.model.js';
import { Division } from '../setup/models/Division.model.js';
import { District } from '../setup/models/District.model.js';
import { Thana } from '../setup/models/Thana.model.js';
import { ancestorChain, officeIndex, parentPath, subtreeIds, type IndexedOffice } from '../org/org.service.js';
import type { IScheduleEvent } from './models/ScheduleEvent.model.js';

/**
 * Office-based audiences follow each user's current office (User.office_id), so moving a user
 * to another office changes which schedules they see.
 */
export interface AudienceSpec {
  target_type: ScheduleTargetType;
  target_user_ids: string[];
  target_office_type_ids: string[];
  target_office_ids: string[];
  target_location: ScheduleTargetLocation;
}

export interface AudienceInfo {
  label: string;
  offices: ScheduleTargetOffice[];
}

/** Where a viewer sits in the office tree; null when they haven't set an office. */
export interface ViewerOffice {
  office_id: string;
  ancestor_ids: string[];
  office_type_id: string;
  division_id: string | null;
  district_id: string | null;
  thana_id: string | null;
}

const idStr = (v: Types.ObjectId | null | undefined): string | undefined => (v ? String(v) : undefined);
const oids = (ids: string[]) => ids.map((id) => new mongoose.Types.ObjectId(id));

export function specOf(doc: IScheduleEvent): AudienceSpec {
  return {
    target_type: doc.target_type ?? 'all',
    target_user_ids: (doc.target_user_ids ?? []).map(String),
    target_office_type_ids: (doc.target_office_type_ids ?? []).map(String),
    target_office_ids: (doc.target_office_ids ?? []).map(String),
    target_location: {
      division_id: idStr(doc.target_location?.division_id),
      district_id: idStr(doc.target_location?.district_id),
      thana_id: idStr(doc.target_location?.thana_id),
    },
  };
}

export async function viewerOffice(userId: string): Promise<ViewerOffice | null> {
  const u = await User.findById(userId).select('office_id').lean();
  if (!u?.office_id) return null;
  const map = await officeIndex();
  const o = map.get(String(u.office_id));
  if (!o) return null;
  return {
    office_id: o.id,
    ancestor_ids: ancestorChain(map, o.id).map((a) => a.id),
    office_type_id: o.office_type_id,
    division_id: o.division_id,
    district_id: o.district_id,
    thana_id: o.thana_id,
  };
}

function inArea(o: { division_id: string | null; district_id: string | null; thana_id: string | null }, l: ScheduleTargetLocation): boolean {
  if (!l.division_id || o.division_id !== l.division_id) return false;
  if (l.district_id && o.district_id !== l.district_id) return false;
  if (l.thana_id && o.thana_id !== l.thana_id) return false;
  return true;
}

export function viewerMatches(spec: AudienceSpec, userId: string, v: ViewerOffice | null): boolean {
  switch (spec.target_type) {
    case 'all':
      return true;
    case 'specific':
      return spec.target_user_ids.includes(userId);
    case 'office_type':
      return !!v && spec.target_office_type_ids.includes(v.office_type_id);
    case 'office':
      return !!v && spec.target_office_ids.includes(v.office_id);
    case 'office_tree':
      return !!v && v.ancestor_ids.some((id) => spec.target_office_ids.includes(id));
    case 'location':
      return !!v && inArea(v, spec.target_location);
  }
}

/** Mongo conditions (to OR together) for universal schedules this viewer is in. */
export function viewerConditions(userId: string, v: ViewerOffice | null): FilterQuery<IScheduleEvent>[] {
  const out: FilterQuery<IScheduleEvent>[] = [
    { target_type: 'all' },
    { target_type: 'specific', target_user_ids: new mongoose.Types.ObjectId(userId) },
  ];
  if (!v) return out;
  out.push(
    { target_type: 'office_type', target_office_type_ids: new mongoose.Types.ObjectId(v.office_type_id) },
    { target_type: 'office', target_office_ids: new mongoose.Types.ObjectId(v.office_id) },
    { target_type: 'office_tree', target_office_ids: { $in: oids(v.ancestor_ids) } },
  );
  if (v.division_id) {
    out.push({
      target_type: 'location',
      'target_location.division_id': new mongoose.Types.ObjectId(v.division_id),
      $and: [
        { $or: [{ 'target_location.district_id': null }, ...(v.district_id ? [{ 'target_location.district_id': new mongoose.Types.ObjectId(v.district_id) }] : [])] },
        { $or: [{ 'target_location.thana_id': null }, ...(v.thana_id ? [{ 'target_location.thana_id': new mongoose.Types.ObjectId(v.thana_id) }] : [])] },
      ],
    });
  }
  return out;
}

/** Offices whose users make up the audience; null for 'all' and 'specific'. */
function audienceOfficeIds(spec: AudienceSpec, map: Map<string, IndexedOffice>): string[] | null {
  switch (spec.target_type) {
    case 'all':
    case 'specific':
      return null;
    case 'office_type': {
      const types = new Set(spec.target_office_type_ids);
      return [...map.values()].filter((o) => types.has(o.office_type_id)).map((o) => o.id);
    }
    case 'office':
      return spec.target_office_ids.filter((id) => map.has(id));
    case 'office_tree':
      return [...new Set(spec.target_office_ids.flatMap((id) => (map.has(id) ? subtreeIds(map, id, false) : [])))];
    case 'location':
      return [...map.values()].filter((o) => inArea(o, spec.target_location)).map((o) => o.id);
  }
}

async function audienceFilter(spec: AudienceSpec): Promise<FilterQuery<unknown>> {
  if (spec.target_type === 'specific') return { _id: { $in: oids(spec.target_user_ids) } };
  const officeIds = audienceOfficeIds(spec, await officeIndex());
  if (officeIds === null) return { status: 'active' };
  return { status: 'active', office_id: { $in: oids(officeIds) } };
}

export async function audienceUserIds(spec: AudienceSpec): Promise<string[]> {
  const users = await User.find(await audienceFilter(spec)).select('_id').lean();
  return users.map((u) => String(u._id));
}

export async function previewAudience(body: unknown): Promise<{ users: number; offices: number | null }> {
  const parsed = scheduleAudienceSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join('; '));
  const spec = await validateAudience(parsed.data);
  const [users, map] = await Promise.all([User.countDocuments(await audienceFilter(spec)), officeIndex()]);
  const offices = audienceOfficeIds(spec, map);
  return { users, offices: offices === null ? null : offices.length };
}

/** Checks the referenced office types / offices / area exist and drops fields the type doesn't use. */
export async function validateAudience(d: AudienceSpec): Promise<AudienceSpec> {
  const spec: AudienceSpec = {
    target_type: d.target_type,
    target_user_ids: d.target_type === 'specific' ? [...new Set(d.target_user_ids)] : [],
    target_office_type_ids: d.target_type === 'office_type' ? [...new Set(d.target_office_type_ids)] : [],
    target_office_ids: d.target_type === 'office' || d.target_type === 'office_tree' ? [...new Set(d.target_office_ids)] : [],
    target_location: d.target_type === 'location' ? d.target_location : {},
  };
  if (spec.target_user_ids.length) {
    const found = await User.countDocuments({ _id: { $in: spec.target_user_ids } });
    if (found !== spec.target_user_ids.length) throw badRequest('Some selected users were not found');
  }
  if (spec.target_office_type_ids.length) {
    const found = await OfficeType.countDocuments({ _id: { $in: spec.target_office_type_ids } });
    if (found !== spec.target_office_type_ids.length) throw badRequest('Some selected office types were not found');
  }
  if (spec.target_office_ids.length) {
    const map = await officeIndex();
    if (spec.target_office_ids.some((id) => !map.has(id))) throw badRequest('Some selected offices were not found');
  }
  const l = spec.target_location;
  if (l.division_id && !(await Division.exists({ _id: l.division_id }))) throw badRequest('Division not found');
  if (l.district_id) {
    const dist = await District.findById(l.district_id).select('division_id').lean();
    if (!dist || String(dist.division_id) !== l.division_id) throw badRequest('That district is not in the selected division');
  }
  if (l.thana_id) {
    const t = await Thana.findById(l.thana_id).select('district_id').lean();
    if (!t || String(t.district_id) !== l.district_id) throw badRequest('That upazila is not in the selected district');
  }
  return spec;
}

export function audienceFields(spec: AudienceSpec) {
  const l = spec.target_location;
  return {
    target_type: spec.target_type,
    target_user_ids: oids(spec.target_user_ids),
    target_office_type_ids: oids(spec.target_office_type_ids),
    target_office_ids: oids(spec.target_office_ids),
    target_location:
      spec.target_type === 'location'
        ? {
            division_id: l.division_id ? new mongoose.Types.ObjectId(l.division_id) : null,
            district_id: l.district_id ? new mongoose.Types.ObjectId(l.district_id) : null,
            thana_id: l.thana_id ? new mongoose.Types.ObjectId(l.thana_id) : null,
          }
        : undefined,
  };
}

function listNames(names: string[], max = 3): string {
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} +${names.length - max} more`;
}

/** Human labels (and picked offices) for many schedules at once. */
export async function audienceInfo(docs: IScheduleEvent[]): Promise<Map<string, AudienceInfo>> {
  const specs = docs.map((d) => [String(d._id), specOf(d)] as const);
  const typeIds = new Set<string>();
  const geo = { division: new Set<string>(), district: new Set<string>(), thana: new Set<string>() };
  let needOffices = false;
  for (const [, s] of specs) {
    s.target_office_type_ids.forEach((id) => typeIds.add(id));
    if (s.target_office_ids.length) needOffices = true;
    if (s.target_location.division_id) geo.division.add(s.target_location.division_id);
    if (s.target_location.district_id) geo.district.add(s.target_location.district_id);
    if (s.target_location.thana_id) geo.thana.add(s.target_location.thana_id);
  }
  const [map, types, divisions, districts, thanas] = await Promise.all([
    needOffices ? officeIndex() : Promise.resolve(new Map<string, IndexedOffice>()),
    typeIds.size ? OfficeType.find({ _id: { $in: [...typeIds] } }).select('short_name').lean() : [],
    geo.division.size ? Division.find({ _id: { $in: [...geo.division] } }).select('name_en').lean() : [],
    geo.district.size ? District.find({ _id: { $in: [...geo.district] } }).select('name_en').lean() : [],
    geo.thana.size ? Thana.find({ _id: { $in: [...geo.thana] } }).select('name_en').lean() : [],
  ]);
  const typeName = new Map(types.map((t) => [String(t._id), t.short_name]));
  const geoName = new Map([...divisions, ...districts, ...thanas].map((g) => [String(g._id), g.name_en]));

  const out = new Map<string, AudienceInfo>();
  for (const [id, s] of specs) {
    const offices: ScheduleTargetOffice[] = s.target_office_ids.map((oid) => {
      const o = map.get(oid);
      return o
        ? { id: oid, name: o.name, short_name: o.short_name, parent_path: parentPath(map, o.parent_id) }
        : { id: oid, name: 'Deleted office', parent_path: '' };
    });
    const officeNames = offices.map((o) => o.short_name || o.name);
    const l = s.target_location;
    const label = (() => {
      switch (s.target_type) {
        case 'all':
          return SCHEDULE_TARGET_LABELS.all;
        case 'specific':
          return `${s.target_user_ids.length} selected user(s)`;
        case 'office_type':
          return `Office type: ${listNames(s.target_office_type_ids.map((t) => typeName.get(t) ?? '?'))}`;
        case 'office':
          return `Office: ${listNames(officeNames)}`;
        case 'office_tree':
          return `Office + sub-offices: ${listNames(officeNames)}`;
        case 'location':
          return `Area: ${[l.division_id, l.district_id, l.thana_id]
            .filter((g): g is string => !!g)
            .map((g) => geoName.get(g) ?? '?')
            .join(' › ')}`;
      }
    })();
    out.set(id, { label, offices });
  }
  return out;
}
