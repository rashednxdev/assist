import mongoose from 'mongoose';
import { TOOLKIT_CATEGORIES, type ToolkitKind } from '@ibas/shared-constants';
import { toolkitCategoryInputSchema, type ToolkitCategory as ToolkitCategoryView } from '@ibas/shared-types';
import { badRequest, notFound } from '../../shared/errors/AppError.js';
import { ToolkitCategory, type IToolkitCategory } from './models/ToolkitCategory.model.js';
import { ToolkitItem } from './models/ToolkitItem.model.js';

type Lean = Omit<IToolkitCategory, keyof mongoose.Document> & { _id: mongoose.Types.ObjectId };

let seeded: Promise<void> | null = null;

/** Inserts the starting list once, only when no category exists yet. */
function ensureDefaults(): Promise<void> {
  seeded ??= (async () => {
    if (await ToolkitCategory.exists({})) return;
    await ToolkitCategory.bulkWrite(
      TOOLKIT_CATEGORIES.map((c, i) => ({
        updateOne: {
          filter: { code: c.code },
          update: { $setOnInsert: { code: c.code, label: c.label, kinds: [...c.kinds], sort_order: (i + 1) * 10, is_active: true } },
          upsert: true,
        },
      })),
    );
  })().catch((err) => {
    seeded = null;
    throw err;
  });
  return seeded;
}

function toView(d: Lean, count?: number): ToolkitCategoryView {
  return {
    id: String(d._id),
    code: d.code,
    label: d.label,
    kinds: d.kinds ?? [],
    sort_order: d.sort_order ?? 0,
    is_active: d.is_active,
    ...(count === undefined ? {} : { item_count: count }),
  };
}

export async function listCategories(includeInactive: boolean, withCounts = false): Promise<ToolkitCategoryView[]> {
  await ensureDefaults();
  const docs = await ToolkitCategory.find(includeInactive ? {} : { is_active: true }).sort({ sort_order: 1, label: 1 }).lean<Lean[]>();
  if (!withCounts) return docs.map((d) => toView(d));
  const counts = await ToolkitItem.aggregate<{ _id: string; n: number }>([{ $match: { is_active: true } }, { $group: { _id: '$category', n: { $sum: 1 } } }]);
  const byCode = new Map(counts.map((c) => [c._id, c.n]));
  return docs.map((d) => toView(d, byCode.get(d.code) ?? 0));
}

/** code → label for every category, including inactive ones still used by items. */
export async function categoryLabels(): Promise<Map<string, string>> {
  await ensureDefaults();
  const docs = await ToolkitCategory.find({}).select('code label').lean<Lean[]>();
  return new Map(docs.map((d) => [d.code, d.label]));
}

/** A category is valid for a save when it exists, fits the kind, and is active (or already on the item). */
export async function assertCategory(code: string, kind: ToolkitKind, current?: string): Promise<void> {
  await ensureDefaults();
  const cat = await ToolkitCategory.findOne({ code }).lean<Lean>();
  if (!cat) throw badRequest('Choose a category');
  if (!cat.is_active && cat.code !== current) throw badRequest(`“${cat.label}” is no longer in use`);
  if (!cat.kinds.includes(kind)) throw badRequest(`“${cat.label}” is not a ${kind} category`);
}

function parse(body: unknown) {
  const parsed = toolkitCategoryInputSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; '));
  return parsed.data;
}

export async function createCategory(body: unknown): Promise<ToolkitCategoryView> {
  await ensureDefaults();
  const input = parse(body);
  if (await ToolkitCategory.exists({ code: input.code })) throw badRequest(`Code “${input.code}” is already used`);
  const doc = await ToolkitCategory.create({ ...input, kinds: [...new Set(input.kinds)] });
  return toView(doc.toObject() as Lean);
}

export async function updateCategory(id: string, body: unknown): Promise<ToolkitCategoryView> {
  if (!mongoose.isValidObjectId(id)) throw notFound('Category not found');
  const doc = await ToolkitCategory.findById(id);
  if (!doc) throw notFound('Category not found');
  const input = parse({ ...(body as object), code: doc.code });
  const kinds = [...new Set(input.kinds)];
  const dropped = doc.kinds.filter((k) => !kinds.includes(k));
  if (dropped.length) {
    const used = await ToolkitItem.countDocuments({ category: doc.code, kind: { $in: dropped }, is_active: true });
    if (used) throw badRequest(`${used} ${dropped.join('/')} item(s) use this category; move them first or keep that type`);
  }
  doc.set({ label: input.label, kinds, sort_order: input.sort_order, is_active: input.is_active });
  await doc.save();
  return toView(doc.toObject() as Lean);
}

export async function deactivateCategory(id: string): Promise<void> {
  if (!mongoose.isValidObjectId(id)) throw notFound('Category not found');
  const res = await ToolkitCategory.updateOne({ _id: id }, { $set: { is_active: false } });
  if (res.matchedCount === 0) throw notFound('Category not found');
}
