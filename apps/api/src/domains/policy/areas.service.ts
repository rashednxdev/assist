import { DEFAULT_IBAS_AREAS, type PolicyCollectionCode } from '@ibas/shared-constants';
import {
  createIbasAreaSchema,
  updateIbasAreaSchema,
  type IbasAreaRecord,
} from '@ibas/shared-types';
import { badRequest, notFound } from '../../shared/errors/AppError.js';
import { logger } from '../../shared/logger.js';
import { Module } from '../setup/models/Module.model.js';
import { Task } from '../workflow/models/Task.model.js';
import { ToolkitItem } from '../toolkit/models/ToolkitItem.model.js';
import { Circular } from './models/Circular.model.js';
import { ContentLink } from './models/ContentLink.model.js';
import { IbasArea } from './models/IbasArea.model.js';

export interface AreaInfo {
  code: string;
  name_en: string;
  name_bn: string;
  description_en: string;
  color: string;
  legacy_codes: string[];
  policy_collections: PolicyCollectionCode[];
  sort_order: number;
  is_active: boolean;
}

export interface AreaIndex {
  /** Every area, hidden ones included, in display order. */
  all: AreaInfo[];
  /** Areas shown in the workspace. */
  active: AreaInfo[];
  get(code: string): AreaInfo | undefined;
  /** Module codes whose grant opens the area: the area itself plus its legacy codes. */
  accessCodes(code: string): string[];
}

/** Short TTL so other API instances pick up admin edits without a restart. */
const CACHE_MS = 30_000;
let cached: { index: AreaIndex; at: number } | null = null;

function buildIndex(rows: AreaInfo[]): AreaIndex {
  const all = [...rows].sort((a, b) => a.sort_order - b.sort_order || a.name_en.localeCompare(b.name_en));
  const byCode = new Map(all.map((a) => [a.code, a]));
  return {
    all,
    active: all.filter((a) => a.is_active),
    get: (code) => byCode.get(code),
    accessCodes: (code) => {
      const a = byCode.get(code);
      return a ? [a.code, ...a.legacy_codes] : [code];
    },
  };
}

export async function getAreaIndex(): Promise<AreaIndex> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.index;
  const rows = await IbasArea.find()
    .select('code name_en name_bn description_en color legacy_codes policy_collections sort_order is_active')
    .lean();
  const index = buildIndex(
    rows.map((r) => ({
      code: r.code,
      name_en: r.name_en,
      name_bn: r.name_bn ?? '',
      description_en: r.description_en ?? '',
      color: r.color,
      legacy_codes: r.legacy_codes ?? [],
      policy_collections: (r.policy_collections ?? []) as PolicyCollectionCode[],
      sort_order: r.sort_order ?? 100,
      is_active: r.is_active !== false,
    })),
  );
  cached = { index, at: Date.now() };
  return index;
}

function invalidate() {
  cached = null;
}

/** Rejects area codes that do not exist (hidden areas are allowed so existing tags survive edits). */
export async function assertAreaCodes(codes: readonly string[] | undefined): Promise<void> {
  if (!codes?.length) return;
  const index = await getAreaIndex();
  const unknown = [...new Set(codes)].filter((c) => !index.get(c));
  if (unknown.length) throw badRequest(`Unknown iBAS++ area: ${unknown.join(', ')}`);
}

function moduleFields(a: { name_en: string; name_bn: string; description_en: string; color: string }) {
  return {
    name_en: `iBAS++: ${a.name_en}`,
    name_bn: a.name_bn || undefined,
    description_en: a.description_en || `iBAS++ Workspace area: ${a.name_en}`,
    color: a.color,
  };
}

/**
 * Seeds the starter areas once and makes sure every area has its Module row. Never overwrites
 * anything an admin has edited.
 */
export async function ensureDefaultAreas(): Promise<void> {
  const seeded = await IbasArea.bulkWrite(
    DEFAULT_IBAS_AREAS.map((a, i) => ({
      updateOne: {
        filter: { code: a.code },
        update: {
          $setOnInsert: {
            code: a.code,
            name_en: a.name_en,
            name_bn: a.name_bn,
            description_en: a.description_en,
            color: a.color,
            legacy_codes: [...a.legacy_codes],
            policy_collections: [...a.policy_collections],
            sort_order: (i + 1) * 10,
            is_active: true,
          },
        },
        upsert: true,
      },
    })),
  );
  const areas = await IbasArea.find().select('code name_en name_bn description_en color sort_order').lean();
  const modules = await Module.bulkWrite(
    areas.map((a) => ({
      updateOne: {
        filter: { code: a.code },
        update: {
          $setOnInsert: { code: a.code, ...moduleFields(a), sort_order: 40 + a.sort_order, is_active: true },
        },
        upsert: true,
      },
    })),
  );
  if (seeded.upsertedCount > 0) logger.info(`Added ${seeded.upsertedCount} iBAS++ area(s)`);
  if (modules.upsertedCount > 0) logger.info(`Added ${modules.upsertedCount} iBAS++ area module(s)`);
  invalidate();
}

/** Code/name/colour list for labels and pickers. Hidden areas are included for admins only. */
export async function listAreaOptions(includeHidden: boolean) {
  const index = await getAreaIndex();
  return (includeHidden ? index.all : index.active).map((a) => ({
    code: a.code,
    name_en: a.name_en,
    name_bn: a.name_bn,
    color: a.color,
    is_active: a.is_active,
  }));
}

/* ----------------------------- admin ----------------------------- */

async function validateLegacyCodes(areaCode: string, legacy: string[]): Promise<string[]> {
  const codes = [...new Set(legacy.map((c) => c.trim().toUpperCase()).filter(Boolean))].filter((c) => c !== areaCode);
  if (codes.length === 0) return [];
  const [found, areaCodes] = await Promise.all([
    Module.find({ code: { $in: codes } }).select('code').lean(),
    IbasArea.find({ code: { $in: codes } }).select('code').lean(),
  ]);
  const missing = codes.filter((c) => !found.some((m) => m.code === c));
  if (missing.length) throw badRequest(`No module with code: ${missing.join(', ')}`);
  if (areaCodes.length) {
    throw badRequest(`${areaCodes.map((a) => a.code).join(', ')} is another iBAS++ area, not an office module`);
  }
  return codes;
}

export async function listAreaRecords(): Promise<IbasAreaRecord[]> {
  const index = await getAreaIndex();
  const codes = index.all.map((a) => a.code);
  const legacyCodes = [...new Set(index.all.flatMap((a) => a.legacy_codes))];
  const [modules, tagged, legacyTasks, links, circulars, kits] = await Promise.all([
    Module.find({ code: { $in: codes } }).select('code is_active').lean(),
    Task.aggregate<{ _id: string; count: number }>([
      { $match: { ibas_areas: { $in: codes }, is_active: true } },
      { $unwind: '$ibas_areas' },
      { $group: { _id: '$ibas_areas', count: { $sum: 1 } } },
    ]),
    Task.aggregate<{ _id: string; count: number }>([
      { $match: { module_code: { $in: [...codes, ...legacyCodes] }, is_active: true } },
      { $group: { _id: '$module_code', count: { $sum: 1 } } },
    ]),
    ContentLink.aggregate<{ _id: string; count: number }>([
      { $match: { source_type: 'ibas_area' } },
      { $group: { _id: '$source_id', count: { $sum: 1 } } },
    ]),
    Circular.aggregate<{ _id: string; count: number }>([
      { $match: { is_active: true } },
      { $unwind: '$areas' },
      { $group: { _id: '$areas', count: { $sum: 1 } } },
    ]),
    ToolkitItem.aggregate<{ _id: string; count: number }>([
      { $match: { is_active: true } },
      { $unwind: '$areas' },
      { $group: { _id: '$areas', count: { $sum: 1 } } },
    ]),
  ]);
  const countOf = (rows: { _id: string; count: number }[], key: string) => rows.find((r) => r._id === key)?.count ?? 0;
  const moduleByCode = new Map(modules.map((m) => [m.code, m]));

  return index.all.map((a) => ({
    ...a,
    module_stopped: moduleByCode.get(a.code)?.is_active === false,
    usage: {
      tagged_tasks: countOf(tagged, a.code),
      legacy_tasks: index.accessCodes(a.code).reduce((s, c) => s + countOf(legacyTasks, c), 0),
      links: countOf(links, a.code),
      circulars: countOf(circulars, a.code),
      toolkit: countOf(kits, a.code),
    },
  }));
}

function issues(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  return error.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; ');
}

export async function createArea(body: unknown, userId: string): Promise<IbasAreaRecord[]> {
  const parsed = createIbasAreaSchema.safeParse(body);
  if (!parsed.success) throw badRequest(issues(parsed.error));
  const dto = parsed.data;

  if (await IbasArea.exists({ code: dto.code })) throw badRequest(`An area with code ${dto.code} already exists`);
  if (await Module.exists({ code: dto.code })) {
    throw badRequest(`${dto.code} is already used by another module — choose a different code`);
  }
  const legacy_codes = await validateLegacyCodes(dto.code, dto.legacy_codes);

  await IbasArea.create({ ...dto, legacy_codes, created_by: userId, updated_by: userId });
  await Module.updateOne(
    { code: dto.code },
    {
      $set: moduleFields(dto),
      $setOnInsert: { code: dto.code, sort_order: 40 + dto.sort_order, is_active: true },
    },
    { upsert: true },
  );
  invalidate();
  return listAreaRecords();
}

export async function updateArea(code: string, body: unknown, userId: string): Promise<IbasAreaRecord[]> {
  const area = await IbasArea.findOne({ code });
  if (!area) throw notFound('Unknown iBAS++ area');
  const parsed = updateIbasAreaSchema.safeParse(body);
  if (!parsed.success) throw badRequest(issues(parsed.error));
  const dto = parsed.data;
  const legacy_codes = await validateLegacyCodes(code, dto.legacy_codes);

  area.set({ ...dto, legacy_codes, updated_by: userId });
  await area.save();
  await Module.updateOne(
    { code },
    { $set: moduleFields(dto), $setOnInsert: { code, sort_order: 40 + dto.sort_order, is_active: true } },
    { upsert: true },
  );
  invalidate();
  return listAreaRecords();
}
