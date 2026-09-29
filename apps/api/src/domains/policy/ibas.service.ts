import mongoose from 'mongoose';
import { SMART_TOOLS } from '@ibas/shared-constants';
import {
  createIbasLinkSchema,
  type IbasAreaDetail,
  type IbasAreaSummary,
  type IbasLinkRecord,
  type IbasRuleItem,
} from '@ibas/shared-types';
import { badRequest, forbidden, notFound } from '../../shared/errors/AppError.js';
import type { ModuleAccessChecker } from '../../middleware/moduleAccessChecker.js';
import { Task } from '../workflow/models/Task.model.js';
import { BookInfo } from '../books/models/BookInfo.model.js';
import { BookChapter } from '../books/models/BookChapter.model.js';
import { BookTopic } from '../books/models/BookTopic.model.js';
import { Circular } from './models/Circular.model.js';
import { ContentLink } from './models/ContentLink.model.js';
import { ToolkitItem } from '../toolkit/models/ToolkitItem.model.js';
import { SUMMARY_SELECT, toSummary as toToolkitSummary } from '../toolkit/toolkit.service.js';
import { containsRegex, snippet, stripHtml } from './text.js';
import { assertAreaCodes, getAreaIndex, type AreaIndex } from './areas.service.js';

type ObjectId = mongoose.Types.ObjectId;

function toolsFor(code: string) {
  return SMART_TOOLS.filter((t) => (t.areas as readonly string[]).includes(code)).map((t) => ({
    key: t.key,
    title: t.title,
    description: t.description,
    href: t.href,
    module_code: 'module_code' in t ? t.module_code : undefined,
  }));
}

export function areaAccess(checker: ModuleAccessChecker, index: AreaIndex, code: string) {
  const state = checker.stateForPrimary(code, index.accessCodes(code));
  return { access: state, stopped_reason: state === 'stopped' ? checker.stoppedReason(code) : undefined };
}

/** Workflow tasks listed under an area: tasks of its modules, plus tasks tagged with the area. */
export function areaTaskFilter(index: AreaIndex, code: string) {
  return {
    $or: [{ module_code: { $in: index.accessCodes(code) } }, { ibas_areas: code }],
    is_active: true,
    is_published: true,
  };
}

export async function listAreas(checker: ModuleAccessChecker): Promise<IbasAreaSummary[]> {
  const index = await getAreaIndex();
  const areas = index.active;
  const allTaskCodes = areas.flatMap((a) => index.accessCodes(a.code));
  const [areaTasks, linkCounts, circularCounts, kitCounts] = await Promise.all([
    Task.find({
      $or: [{ module_code: { $in: allTaskCodes } }, { ibas_areas: { $in: areas.map((a) => a.code) } }],
      is_active: true,
      is_published: true,
    })
      .select('module_code ibas_areas')
      .lean(),
    ContentLink.aggregate<{ _id: { area: string; type: string }; count: number }>([
      { $match: { source_type: 'ibas_area' } },
      { $group: { _id: { area: '$source_id', type: '$target_type' }, count: { $sum: 1 } } },
    ]),
    Circular.aggregate<{ _id: string; count: number }>([
      { $match: { is_active: true, is_published: true } },
      { $unwind: '$areas' },
      { $group: { _id: '$areas', count: { $sum: 1 } } },
    ]),
    ToolkitItem.aggregate<{ _id: { area: string; kind: string }; count: number }>([
      { $match: { is_active: true, is_published: true } },
      { $unwind: '$areas' },
      { $group: { _id: { area: '$areas', kind: '$kind' }, count: { $sum: 1 } } },
    ]),
  ]);
  const kitsOf = (area: string, kind: string) =>
    kitCounts.find((k) => k._id.area === area && k._id.kind === kind)?.count ?? 0;
  const proceduresOf = (code: string) => {
    const codes = index.accessCodes(code);
    return areaTasks.filter((t) => codes.includes(t.module_code) || (t.ibas_areas ?? []).includes(code)).length;
  };
  const circularsBy = new Map(circularCounts.map((c) => [c._id, c.count]));
  const linksOf = (area: string, types: string[]) =>
    linkCounts.filter((l) => l._id.area === area && types.includes(l._id.type)).reduce((s, l) => s + l.count, 0);

  return areas.map((a) => ({
    code: a.code,
    name_en: a.name_en,
    name_bn: a.name_bn,
    description_en: a.description_en,
    color: a.color,
    ...areaAccess(checker, index, a.code),
    counts: {
      procedures: proceduresOf(a.code),
      rules: linksOf(a.code, ['book', 'book_topic']),
      circulars: (circularsBy.get(a.code) ?? 0) + linksOf(a.code, ['circular']),
      tools: toolsFor(a.code).length,
      checklists: kitsOf(a.code, 'checklist'),
      templates: kitsOf(a.code, 'template'),
      guides: kitsOf(a.code, 'guide'),
    },
  }));
}

interface ResolvedTopic {
  id: string;
  book_id: string;
  title: string;
  subtitle: string;
  snippet: string;
  published: boolean;
}

function topicTitle(t: { rule_number?: string; name?: string; description?: string }): string {
  const label = [t.rule_number?.trim(), t.name?.trim()].filter(Boolean).join(' — ');
  return label || snippet(stripHtml(t.description), undefined, 90) || 'Untitled rule';
}

export async function resolveTopics(ids: ObjectId[]): Promise<Map<string, ResolvedTopic>> {
  if (ids.length === 0) return new Map();
  const topics = await BookTopic.find({ _id: { $in: ids }, is_active: true })
    .select('book_chapter_id rule_number name description')
    .lean();
  const chapters = await BookChapter.find({ _id: { $in: topics.map((t) => t.book_chapter_id) } })
    .select('book_info_id chapter_number name')
    .lean();
  const books = await BookInfo.find({ _id: { $in: chapters.map((c) => c.book_info_id) }, is_active: true })
    .select('name is_published')
    .lean();
  const chapterById = new Map(chapters.map((c) => [String(c._id), c]));
  const bookById = new Map(books.map((b) => [String(b._id), b]));
  const out = new Map<string, ResolvedTopic>();
  for (const t of topics) {
    const ch = chapterById.get(String(t.book_chapter_id));
    const book = ch ? bookById.get(String(ch.book_info_id)) : undefined;
    if (!ch || !book) continue;
    out.set(String(t._id), {
      id: String(t._id),
      book_id: String(book._id),
      title: topicTitle(t),
      subtitle: [book.name, ch.chapter_number ? `Ch. ${ch.chapter_number}${ch.name ? ` ${ch.name}` : ''}` : ch.name]
        .filter(Boolean)
        .join(' · '),
      snippet: snippet(stripHtml(t.description), undefined, 220),
      published: book.is_published,
    });
  }
  return out;
}

export async function getAreaDetail(code: string, checker: ModuleAccessChecker): Promise<IbasAreaDetail> {
  const index = await getAreaIndex();
  const area = index.get(code);
  if (!area || (!area.is_active && !checker.isAdmin)) throw notFound('Unknown iBAS++ area');
  const access = areaAccess(checker, index, code);
  if (access.access !== 'open') {
    throw forbidden(
      access.access === 'stopped'
        ? access.stopped_reason || 'This area is temporarily unavailable.'
        : access.access === 'unpaid'
          ? 'Buy a Basic Module plan to open this area.'
          : 'You do not have access to this iBAS++ area. Ask an admin to grant access.',
    );
  }
  const admin = checker.isAdmin;

  const [tasks, links, areaCirculars, collectionBooks, kits] = await Promise.all([
    Task.find(areaTaskFilter(index, code))
      .select('name_en name_bn description_en total_steps estimated_time')
      .sort({ name_en: 1 })
      .lean(),
    ContentLink.find({ source_type: 'ibas_area', source_id: code }).sort({ sort_order: 1, created_at: 1 }).lean(),
    Circular.find({ areas: code, is_active: true, is_published: true })
      .select('circular_no title issuer issue_date')
      .sort({ issue_date: -1 })
      .limit(200)
      .lean(),
    BookInfo.find({
      is_active: true,
      ...(admin ? {} : { is_published: true }),
      policy_collections: { $in: [...area.policy_collections] },
    })
      .select('name name_bn')
      .sort({ name: 1 })
      .limit(24)
      .lean(),
    ToolkitItem.find({ areas: code, is_active: true, is_published: true })
      .select(SUMMARY_SELECT)
      .sort({ kind: 1, title: 1 })
      .lean<Parameters<typeof toToolkitSummary>[0][]>(),
  ]);
  const toolkit = kits.map((k) => toToolkitSummary(k, checker, index));
  const kitCount = (kind: string) => toolkit.filter((k) => k.kind === kind).length;

  const topicIds = links.filter((l) => l.target_type === 'book_topic').map((l) => l.target_id);
  const bookIds = links.filter((l) => l.target_type === 'book').map((l) => l.target_id);
  const circularIds = links.filter((l) => l.target_type === 'circular').map((l) => l.target_id);
  const [topics, linkedBooks, linkedCirculars] = await Promise.all([
    resolveTopics(topicIds),
    BookInfo.find({ _id: { $in: bookIds }, is_active: true, ...(admin ? {} : { is_published: true }) })
      .select('name name_bn short_name')
      .lean(),
    Circular.find({ _id: { $in: circularIds }, is_active: true, is_published: true })
      .select('circular_no title issuer issue_date')
      .lean(),
  ]);
  const bookById = new Map(linkedBooks.map((b) => [String(b._id), b]));
  const linkedCircularById = new Map(linkedCirculars.map((c) => [String(c._id), c]));

  const rules: IbasRuleItem[] = [];
  for (const l of links) {
    const id = String(l.target_id);
    if (l.target_type === 'book_topic') {
      const t = topics.get(id);
      if (!t || (!admin && !t.published)) continue;
      rules.push({
        link_id: String(l._id),
        kind: 'book_topic',
        id,
        book_id: t.book_id,
        title: t.title,
        subtitle: t.subtitle,
        snippet: t.snippet,
        note: l.note || undefined,
        href: `/books/${t.book_id}/read/rule/${id}`,
      });
    } else if (l.target_type === 'book') {
      const b = bookById.get(id);
      if (!b) continue;
      rules.push({
        link_id: String(l._id),
        kind: 'book',
        id,
        book_id: id,
        title: b.name,
        subtitle: b.name_bn,
        note: l.note || undefined,
        href: `/books/${id}`,
      });
    }
  }

  const circularLinkNotes = new Map(
    links.filter((l) => l.target_type === 'circular').map((l) => [String(l.target_id), l]),
  );
  const circularMap = new Map<string, IbasAreaDetail['circulars'][number]>();
  for (const l of links.filter((x) => x.target_type === 'circular')) {
    const c = linkedCircularById.get(String(l.target_id));
    if (!c) continue;
    circularMap.set(String(c._id), {
      link_id: String(l._id),
      id: String(c._id),
      circular_no: c.circular_no,
      title: c.title,
      issuer: c.issuer,
      issue_date: c.issue_date,
      note: l.note || undefined,
      href: `/circulars/${String(c._id)}`,
    });
  }
  for (const c of areaCirculars) {
    const id = String(c._id);
    if (circularMap.has(id)) continue;
    circularMap.set(id, {
      link_id: circularLinkNotes.get(id) ? String(circularLinkNotes.get(id)!._id) : undefined,
      id,
      circular_no: c.circular_no,
      title: c.title,
      issuer: c.issuer,
      issue_date: c.issue_date,
      href: `/circulars/${id}`,
    });
  }

  const linkedTopicCount = rules.length;
  return {
    code: area.code,
    name_en: area.name_en,
    name_bn: area.name_bn,
    description_en: area.description_en,
    color: area.color,
    ...access,
    counts: {
      procedures: tasks.length,
      rules: linkedTopicCount,
      circulars: circularMap.size,
      tools: toolsFor(code).length,
      checklists: kitCount('checklist'),
      templates: kitCount('template'),
      guides: kitCount('guide'),
    },
    procedures: tasks.map((t) => ({
      id: String(t._id),
      name_en: t.name_en,
      name_bn: t.name_bn || undefined,
      description_en: t.description_en,
      total_steps: t.total_steps,
      estimated_time: t.estimated_time,
      href: `/guided-tasks/${String(t._id)}`,
    })),
    rules,
    collection_books: collectionBooks.map((b) => ({
      id: String(b._id),
      name: b.name,
      name_bn: b.name_bn,
      href: `/books/${String(b._id)}`,
    })),
    circulars: [...circularMap.values()].sort((a, b) => b.issue_date.localeCompare(a.issue_date)),
    tools: toolsFor(code),
    toolkit,
  };
}

/* ----------------------------- admin ----------------------------- */

export async function listAreaLinks(code: string): Promise<IbasLinkRecord[]> {
  if (!(await getAreaIndex()).get(code)) throw notFound('Unknown iBAS++ area');
  const links = await ContentLink.find({ source_type: 'ibas_area', source_id: code })
    .sort({ sort_order: 1, created_at: 1 })
    .lean();
  const topics = await resolveTopics(links.filter((l) => l.target_type === 'book_topic').map((l) => l.target_id));
  const books = await BookInfo.find({ _id: { $in: links.filter((l) => l.target_type === 'book').map((l) => l.target_id) } })
    .select('name name_bn is_active')
    .lean();
  const circulars = await Circular.find({
    _id: { $in: links.filter((l) => l.target_type === 'circular').map((l) => l.target_id) },
  })
    .select('circular_no title is_active')
    .lean();
  const bookById = new Map(books.map((b) => [String(b._id), b]));
  const circularById = new Map(circulars.map((c) => [String(c._id), c]));

  return links.map((l) => {
    const id = String(l.target_id);
    let title = 'Missing item';
    let subtitle: string | undefined = 'The linked item was deleted — remove this link';
    if (l.target_type === 'book_topic' && topics.get(id)) {
      title = topics.get(id)!.title;
      subtitle = topics.get(id)!.subtitle;
    } else if (l.target_type === 'book' && bookById.get(id)?.is_active) {
      title = bookById.get(id)!.name;
      subtitle = 'Whole book';
    } else if (l.target_type === 'circular' && circularById.get(id)?.is_active) {
      title = circularById.get(id)!.title;
      subtitle = circularById.get(id)!.circular_no;
    }
    return {
      id: String(l._id),
      area_code: code,
      target_type: l.target_type,
      target_id: id,
      title,
      subtitle,
      note: l.note || undefined,
      sort_order: l.sort_order,
    };
  });
}

export async function createAreaLink(body: unknown, userId: string): Promise<IbasLinkRecord[]> {
  const parsed = createIbasLinkSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join('; '));
  const { area_code, target_type, target_id, note } = parsed.data;
  await assertAreaCodes([area_code]);

  const exists =
    target_type === 'book_topic'
      ? await BookTopic.exists({ _id: target_id, is_active: true })
      : target_type === 'book'
        ? await BookInfo.exists({ _id: target_id, is_active: true })
        : await Circular.exists({ _id: target_id, is_active: true });
  if (!exists) throw badRequest('The selected item no longer exists');

  const last = await ContentLink.findOne({ source_type: 'ibas_area', source_id: area_code })
    .sort({ sort_order: -1 })
    .select('sort_order')
    .lean();
  try {
    await ContentLink.create({
      source_type: 'ibas_area',
      source_id: area_code,
      target_type,
      target_id,
      note: note || undefined,
      sort_order: (last?.sort_order ?? 0) + 1,
      created_by: userId,
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw badRequest('This item is already linked to the area');
    throw err;
  }
  return listAreaLinks(area_code);
}

export async function updateAreaLink(id: string, body: { note?: string; move?: 'up' | 'down' }): Promise<IbasLinkRecord[]> {
  if (!mongoose.isValidObjectId(id)) throw notFound('Link not found');
  const link = await ContentLink.findById(id);
  if (!link) throw notFound('Link not found');
  if (typeof body.note === 'string') link.note = body.note.trim().slice(0, 500) || undefined;
  if (body.move === 'up' || body.move === 'down') {
    const siblings = await ContentLink.find({ source_type: link.source_type, source_id: link.source_id }).sort({
      sort_order: 1,
      created_at: 1,
    });
    const idx = siblings.findIndex((s) => String(s._id) === id);
    const swapIdx = body.move === 'up' ? idx - 1 : idx + 1;
    if (idx >= 0 && swapIdx >= 0 && swapIdx < siblings.length) {
      siblings.forEach((s, i) => (s.sort_order = i + 1));
      const other = siblings[swapIdx]!;
      const self = siblings[idx]!;
      [self.sort_order, other.sort_order] = [other.sort_order, self.sort_order];
      await Promise.all(siblings.filter((s) => s !== self).map((s) => s.save()));
      link.sort_order = self.sort_order;
    }
  }
  await link.save();
  return listAreaLinks(link.source_id);
}

export async function deleteAreaLink(id: string): Promise<IbasLinkRecord[]> {
  if (!mongoose.isValidObjectId(id)) throw notFound('Link not found');
  const link = await ContentLink.findByIdAndDelete(id);
  if (!link) throw notFound('Link not found');
  return listAreaLinks(link.source_id);
}

/** Rule picker for the admin link screen: matches rule number, title or text. */
export async function searchTopicsForLinking(q: string) {
  if (q.trim().length < 2) return [];
  const rx = containsRegex(q.trim());
  const topics = await BookTopic.find({ is_active: true, $or: [{ rule_number: rx }, { name: rx }, { description: rx }] })
    .select('_id')
    .limit(30)
    .lean();
  const resolved = await resolveTopics(topics.map((t) => t._id));
  return [...resolved.values()].map((t) => ({ id: t.id, title: t.title, subtitle: t.subtitle, snippet: t.snippet }));
}
