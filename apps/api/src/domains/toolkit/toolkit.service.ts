import mongoose, { type FilterQuery } from 'mongoose';
import {
  toolkitItemSchema,
  type IbasAreaAccessState,
  type ToolkitItemDetail,
  type ToolkitItemInput,
  type ToolkitItemSummary,
  type ToolkitListQuery,
  type ToolkitResolvedRef,
} from '@ibas/shared-types';
import { badRequest, forbidden, notFound } from '../../shared/errors/AppError.js';
import type { ModuleAccessChecker } from '../../middleware/moduleAccessChecker.js';
import { BookInfo } from '../books/models/BookInfo.model.js';
import { Circular } from '../policy/models/Circular.model.js';
import { resolveTopics } from '../policy/ibas.service.js';
import { containsRegex } from '../policy/text.js';
import { assertAreaCodes, getAreaIndex, type AreaIndex } from '../policy/areas.service.js';
import { ToolkitItem, type IToolkitItem, type IToolkitRef } from './models/ToolkitItem.model.js';

type Lean = Omit<IToolkitItem, keyof mongoose.Document> & { _id: mongoose.Types.ObjectId };

export function toolkitAccess(
  checker: ModuleAccessChecker,
  index: AreaIndex,
  areas: string[],
): { access: IbasAreaAccessState; stopped_reason?: string } {
  if (checker.isAdmin) return { access: 'open' };
  let first: { access: IbasAreaAccessState; stopped_reason?: string } | undefined;
  for (const a of areas) {
    if (!index.get(a)?.is_active) continue;
    const state = checker.stateForPrimary(a, index.accessCodes(a));
    if (state === 'open') return { access: 'open' };
    first ??= { access: state, stopped_reason: state === 'stopped' ? checker.stoppedReason(a) : undefined };
  }
  return first ?? { access: 'denied' };
}

function sizeOf(doc: Pick<Lean, 'kind' | 'items' | 'fields' | 'row_fields' | 'sections'>): number {
  if (doc.kind === 'checklist') return doc.items?.length ?? 0;
  if (doc.kind === 'guide') return doc.sections?.length ?? 0;
  return (doc.fields?.length ?? 0) + (doc.row_fields?.length ?? 0);
}

export function toSummary(doc: Lean, checker: ModuleAccessChecker, index: AreaIndex): ToolkitItemSummary {
  return {
    id: String(doc._id),
    kind: doc.kind,
    title: doc.title,
    title_bn: doc.title_bn || undefined,
    summary: doc.summary || undefined,
    category: doc.category as ToolkitItemSummary['category'],
    areas: doc.areas as ToolkitItemSummary['areas'],
    tags: doc.tags ?? [],
    is_published: doc.is_published,
    size: sizeOf(doc),
    ...toolkitAccess(checker, index, doc.areas ?? []),
    updated_at: doc.updated_at?.toISOString?.() ?? '',
  };
}

/** Fields needed for list cards (skips bodies and help text). */
export const SUMMARY_SELECT =
  '-body -row_template -sections.body -items.help -items.text -items.attachments -refs -attachments';

export async function listToolkit(query: ToolkitListQuery, checker: ModuleAccessChecker): Promise<ToolkitItemSummary[]> {
  const filter: FilterQuery<IToolkitItem> = { is_active: true };
  if (!(checker.isAdmin && query.include_unpublished)) filter.is_published = true;
  if (query.kind) filter.kind = query.kind;
  if (query.category) filter.category = query.category;
  if (query.area) filter.areas = query.area;
  if (query.q) {
    const rx = containsRegex(query.q);
    filter.$or = [{ title: rx }, { title_bn: rx }, { summary: rx }, { tags: rx }, { 'items.text': rx }, { 'sections.heading': rx }];
  }
  const [docs, index] = await Promise.all([
    ToolkitItem.find(filter).select(SUMMARY_SELECT).sort({ kind: 1, title: 1 }).limit(300).lean<Lean[]>(),
    getAreaIndex(),
  ]);
  return docs.map((d) => toSummary(d, checker, index));
}

async function resolveRefs(refs: IToolkitRef[], admin: boolean): Promise<Map<string, ToolkitResolvedRef>> {
  const ids = (type: IToolkitRef['target_type']) => refs.filter((r) => r.target_type === type).map((r) => r.target_id);
  const [topics, books, circulars] = await Promise.all([
    resolveTopics(ids('book_topic')),
    BookInfo.find({ _id: { $in: ids('book') }, is_active: true }).select('name name_bn is_published').lean(),
    Circular.find({ _id: { $in: ids('circular') }, is_active: true }).select('circular_no title is_published').lean(),
  ]);
  const out = new Map<string, ToolkitResolvedRef>();
  for (const r of refs) {
    const id = String(r.target_id);
    const key = `${r.target_type}:${id}`;
    if (out.has(key)) continue;
    let resolved: ToolkitResolvedRef | undefined;
    if (r.target_type === 'book_topic') {
      const t = topics.get(id);
      if (t && (admin || t.published)) {
        resolved = { target_type: 'book_topic', target_id: id, title: t.title, subtitle: t.subtitle, href: `/books/${t.book_id}/read/rule/${id}` };
      }
    } else if (r.target_type === 'book') {
      const b = books.find((x) => String(x._id) === id);
      if (b && (admin || b.is_published)) {
        resolved = { target_type: 'book', target_id: id, title: b.name, subtitle: b.name_bn, href: `/books/${id}` };
      }
    } else {
      const c = circulars.find((x) => String(x._id) === id);
      if (c && (admin || c.is_published)) {
        resolved = { target_type: 'circular', target_id: id, title: c.title, subtitle: c.circular_no, href: `/circulars/${id}` };
      }
    }
    if (resolved) out.set(key, resolved);
    else if (admin) out.set(key, { target_type: r.target_type, target_id: id, title: 'Missing or unpublished item', href: '#', missing: true });
  }
  return out;
}

async function loadItem(id: string, admin: boolean): Promise<Lean> {
  if (!mongoose.isValidObjectId(id)) throw notFound('Item not found');
  const doc = await ToolkitItem.findOne({ _id: id, is_active: true, ...(admin ? {} : { is_published: true }) }).lean<Lean>();
  if (!doc) throw notFound('Item not found');
  return doc;
}

export async function getToolkitItem(id: string, checker: ModuleAccessChecker): Promise<ToolkitItemDetail> {
  const doc = await loadItem(id, checker.isAdmin);
  const summary = toSummary(doc, checker, await getAreaIndex());
  if (summary.access !== 'open') {
    throw forbidden(
      summary.access === 'stopped'
        ? summary.stopped_reason || 'This area is temporarily unavailable.'
        : summary.access === 'unpaid'
          ? 'Buy a Basic Module plan to open this area.'
          : 'You do not have access to this iBAS++ area. Ask an admin to grant access.',
    );
  }
  const allRefs = [
    ...(doc.refs ?? []),
    ...(doc.items ?? []).flatMap((i) => i.refs ?? []),
    ...(doc.sections ?? []).flatMap((s) => s.refs ?? []),
  ];
  const resolved = await resolveRefs(allRefs, checker.isAdmin);
  const pick = (refs: IToolkitRef[] | undefined) =>
    (refs ?? []).map((r) => resolved.get(`${r.target_type}:${String(r.target_id)}`)).filter((r): r is ToolkitResolvedRef => !!r);

  const files = (list: Lean['attachments'] | undefined) => (list ?? []).map((a) => ({ title: a.title, url: a.url }));
  const detail: ToolkitItemDetail = { ...summary, refs: pick(doc.refs), attachments: files(doc.attachments) };
  if (doc.kind === 'checklist') {
    detail.items = doc.items.map((i) => ({
      id: i.id,
      section: i.section || undefined,
      text: i.text,
      help: i.help || undefined,
      required: i.required,
      refs: pick(i.refs),
      attachments: files(i.attachments),
    }));
  } else if (doc.kind === 'template') {
    const field = (f: Lean['fields'][number]) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      placeholder: f.placeholder || undefined,
      help: f.help || undefined,
    });
    detail.fields = doc.fields.map(field);
    detail.row_label = doc.row_label || undefined;
    detail.row_fields = doc.row_fields.map(field);
    detail.row_template = doc.row_template || undefined;
    detail.body = doc.body ?? '';
  } else {
    detail.sections = doc.sections.map((s) => ({ id: s.id, heading: s.heading, body: s.body ?? '', refs: pick(s.refs) }));
  }
  return detail;
}

function parseInput(body: unknown): ToolkitItemInput {
  const parsed = toolkitItemSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; '));
  }
  return parsed.data;
}

/** Full document for a kind; fields belonging to other kinds are cleared. */
function toDocFields(input: ToolkitItemInput) {
  const tags = [...new Set(input.tags.map((t) => t.trim()).filter(Boolean))];
  return {
    kind: input.kind,
    title: input.title,
    title_bn: input.title_bn || undefined,
    summary: input.summary || undefined,
    areas: [...new Set(input.areas)],
    category: input.category,
    tags,
    refs: input.refs,
    attachments: input.attachments,
    is_published: input.is_published,
    items: input.kind === 'checklist' ? input.items : [],
    fields: input.kind === 'template' ? input.fields : [],
    row_label: input.kind === 'template' ? input.row_label || undefined : undefined,
    row_fields: input.kind === 'template' ? input.row_fields : [],
    row_template: input.kind === 'template' ? input.row_template || undefined : undefined,
    body: input.kind === 'template' ? input.body : undefined,
    sections: input.kind === 'guide' ? input.sections : [],
  };
}

export async function createToolkitItem(body: unknown, userId: string, checker: ModuleAccessChecker) {
  const input = parseInput(body);
  await assertAreaCodes(input.areas);
  const doc = await ToolkitItem.create({ ...toDocFields(input), created_by: userId });
  return getToolkitItem(String(doc._id), checker);
}

export async function updateToolkitItem(id: string, body: unknown, userId: string, checker: ModuleAccessChecker) {
  if (!mongoose.isValidObjectId(id)) throw notFound('Item not found');
  const doc = await ToolkitItem.findOne({ _id: id, is_active: true });
  if (!doc) throw notFound('Item not found');
  const input = parseInput(body);
  await assertAreaCodes(input.areas);
  doc.set({ ...toDocFields(input), updated_by: userId });
  await doc.save();
  return getToolkitItem(id, checker);
}

export async function duplicateToolkitItem(id: string, userId: string, checker: ModuleAccessChecker) {
  const src = await loadItem(id, true);
  const copy = await ToolkitItem.create({
    kind: src.kind,
    title: `${src.title} (copy)`,
    title_bn: src.title_bn,
    summary: src.summary,
    areas: src.areas,
    category: src.category,
    tags: src.tags,
    refs: src.refs,
    attachments: src.attachments,
    items: src.items,
    fields: src.fields,
    row_label: src.row_label,
    row_fields: src.row_fields,
    row_template: src.row_template,
    body: src.body,
    sections: src.sections,
    is_published: false,
    created_by: userId,
  });
  return getToolkitItem(String(copy._id), checker);
}

export async function deleteToolkitItem(id: string) {
  await loadItem(id, true);
  await ToolkitItem.updateOne({ _id: id }, { $set: { is_active: false, is_published: false } });
}
