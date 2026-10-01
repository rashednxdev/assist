import { CIRCULAR_ISSUERS, SMART_TOOLS, TOOLKIT_KINDS } from '@ibas/shared-constants';
import { categoryLabels } from '../toolkit/categories.service.js';
import { getAreaIndex } from './areas.service.js';
import { CIRCULAR_MODULE_CODES } from './circulars.service.js';
import { ToolkitItem } from '../toolkit/models/ToolkitItem.model.js';
import type { SearchGroup, SearchHit, SearchResponse } from '@ibas/shared-types';
import type { ModuleAccessChecker } from '../../middleware/moduleAccessChecker.js';
import { BookInfo } from '../books/models/BookInfo.model.js';
import { BookChapter } from '../books/models/BookChapter.model.js';
import { BookTopic } from '../books/models/BookTopic.model.js';
import { Regulation } from '../books/models/Regulation.model.js';
import { Question } from '../questions/models/Question.model.js';
import { Task } from '../workflow/models/Task.model.js';
import { Circular } from './models/Circular.model.js';
import { containsRegex, snippet, stripHtml } from './text.js';

const PER_GROUP = 6;

const GROUP_LABEL: Record<SearchGroup, string> = {
  areas: 'iBAS++ Workspace',
  tools: 'Smart tools',
  rules: 'Rules',
  books: 'Books',
  circulars: 'Circulars',
  regulations: 'Regulations',
  questions: 'Questions',
  procedures: 'Procedures',
  toolkit: 'Checklists, templates & guides',
};

function matches(q: string, ...texts: Array<string | undefined>): boolean {
  const needle = q.toLowerCase();
  return texts.some((t) => t?.toLowerCase().includes(needle));
}

async function searchRules(q: string, rx: RegExp, admin: boolean): Promise<SearchHit[]> {
  const topics = await BookTopic.find({ is_active: true, $or: [{ rule_number: rx }, { name: rx }, { description: rx }] })
    .select('book_chapter_id rule_number name description')
    .limit(60)
    .lean();
  if (topics.length === 0) return [];
  const chapters = await BookChapter.find({ _id: { $in: topics.map((t) => t.book_chapter_id) }, is_active: true })
    .select('book_info_id chapter_number')
    .lean();
  const books = await BookInfo.find({
    _id: { $in: chapters.map((c) => c.book_info_id) },
    is_active: true,
    ...(admin ? {} : { is_published: true }),
  })
    .select('name')
    .lean();
  const chapterById = new Map(chapters.map((c) => [String(c._id), c]));
  const bookById = new Map(books.map((b) => [String(b._id), b]));
  const hits: SearchHit[] = [];
  for (const t of topics) {
    const ch = chapterById.get(String(t.book_chapter_id));
    const book = ch ? bookById.get(String(ch.book_info_id)) : undefined;
    if (!ch || !book) continue;
    const text = stripHtml(t.description);
    const title = [t.rule_number?.trim(), t.name?.trim()].filter(Boolean).join(' — ') || snippet(text, undefined, 80);
    hits.push({
      id: String(t._id),
      title,
      subtitle: `${book.name}${ch.chapter_number ? ` · Ch. ${ch.chapter_number}` : ''}`,
      snippet: snippet(text, q),
      href: `/books/${String(book._id)}/read/rule/${String(t._id)}`,
    });
    if (hits.length >= PER_GROUP) break;
  }
  return hits;
}

/** One query across the Policy Library, iBAS++ Workspace, tools and question bank, respecting module access. */
export async function unifiedSearch(rawQ: string, checker: ModuleAccessChecker): Promise<SearchResponse> {
  const q = rawQ.trim().slice(0, 120);
  const response: SearchResponse = { q, groups: [], locked: [] };
  if (q.length < 2) return response;
  const rx = containsRegex(q);
  const admin = checker.isAdmin;
  const can = {
    books: checker.canRead(['BOOKS']),
    circulars: checker.canRead(CIRCULAR_MODULE_CODES),
    questions: checker.canRead(['QUESTIONS']),
  };

  const index = await getAreaIndex();
  const areaHits: SearchHit[] = index.active.filter((a) => matches(q, a.name_en, a.name_bn, a.description_en)).map((a) => ({
    id: a.code,
    title: a.name_en,
    subtitle: a.name_bn,
    snippet: a.description_en,
    href: `/ibas?area=${a.code}`,
  }));
  const toolHits: SearchHit[] = SMART_TOOLS.filter((t) => matches(q, t.title, t.description)).map((t) => ({
    id: t.key,
    title: t.title,
    snippet: t.description,
    href: t.href,
  }));

  const openAreas = index.active
    .filter((a) => checker.stateForPrimary(a.code, index.accessCodes(a.code)) === 'open')
    .map((a) => a.code);
  const openAreaCodes = openAreas.flatMap((code) => index.accessCodes(code));

  const [rules, books, circulars, regulations, questions, procedures, kits] = await Promise.all([
    can.books ? searchRules(q, rx, admin) : Promise.resolve(null),
    can.books
      ? BookInfo.find({
          is_active: true,
          ...(admin ? {} : { is_published: true }),
          $or: [{ name: rx }, { name_bn: rx }, { short_name: rx }, { tags: rx }],
        })
          .select('name name_bn')
          .limit(PER_GROUP)
          .lean()
      : Promise.resolve(null),
    can.circulars
      ? Circular.find({
          is_active: true,
          ...(admin ? {} : { is_published: true }),
          $or: [{ title: rx }, { title_bn: rx }, { circular_no: rx }, { summary: rx }, { tags: rx }, { full_text: rx }],
        })
          .select('circular_no title issuer issue_date summary')
          .sort({ issue_date: -1 })
          .limit(PER_GROUP)
          .lean()
      : Promise.resolve(null),
    can.books
      ? Regulation.find({ is_active: true, $or: [{ title: rx }, { regulation_no: rx }, { full_text: rx }] })
          .select('regulation_no title full_text')
          .limit(PER_GROUP)
          .lean()
      : Promise.resolve(null),
    can.questions
      ? Question.find({ is_active: true, is_published: true, $or: [{ body_en: rx }, { body_bn: rx }] })
          .select('body_en body_bn')
          .limit(PER_GROUP)
          .lean()
      : Promise.resolve(null),
    Task.find({
      is_active: true,
      is_published: true,
      $and: [
        { $or: [{ name_en: rx }, { name_bn: rx }, { description_en: rx }, { tags: rx }] },
        ...(admin
          ? []
          : [{ $or: [{ module_code: { $in: [...openAreaCodes, 'WORKFLOW'] } }, { ibas_areas: { $in: openAreas } }] }]),
      ],
    })
      .select('name_en name_bn description_en module_name_en')
      .limit(PER_GROUP)
      .lean(),
    admin || openAreas.length > 0
      ? ToolkitItem.find({
          is_active: true,
          is_published: true,
          ...(admin ? {} : { areas: { $in: openAreas } }),
          $or: [{ title: rx }, { title_bn: rx }, { summary: rx }, { tags: rx }, { 'items.text': rx }, { 'sections.heading': rx }],
        })
          .select('kind title title_bn summary category')
          .limit(PER_GROUP)
          .lean()
      : Promise.resolve(null),
  ]);

  const issuerLabel = new Map<string, string>(CIRCULAR_ISSUERS.map((i) => [i.code, i.label]));
  const kindLabel = new Map<string, string>(TOOLKIT_KINDS.map((k) => [k.code, k.label]));
  const categoryLabel = kits?.length ? await categoryLabels() : new Map<string, string>();
  const push = (group: SearchGroup, hits: SearchHit[] | null) => {
    if (hits === null) response.locked.push(group);
    else if (hits.length > 0) response.groups.push({ group, label: GROUP_LABEL[group], hits });
  };

  push('areas', areaHits);
  push('circulars', circulars?.map((c) => ({
    id: String(c._id),
    title: c.title,
    subtitle: `${c.circular_no} · ${issuerLabel.get(c.issuer) ?? c.issuer} · ${c.issue_date}`,
    snippet: c.summary ? snippet(stripHtml(c.summary), q) : undefined,
    href: `/circulars/${String(c._id)}`,
  })) ?? null);
  push('toolkit', kits?.map((k) => ({
    id: String(k._id),
    title: k.title,
    subtitle: [kindLabel.get(k.kind), categoryLabel.get(k.category), k.title_bn].filter(Boolean).join(' · '),
    snippet: k.summary ? snippet(stripHtml(k.summary), q) : undefined,
    href: `/toolkit/${String(k._id)}`,
  })) ?? null);
  push('rules', rules);
  push('procedures', procedures.map((t) => ({
    id: String(t._id),
    title: t.name_en,
    subtitle: t.module_name_en,
    snippet: snippet(stripHtml(t.description_en), q),
    href: `/guided-tasks/${String(t._id)}`,
  })));
  push('tools', toolHits);
  push('books', books?.map((b) => ({ id: String(b._id), title: b.name, subtitle: b.name_bn, href: `/books/${String(b._id)}` })) ?? null);
  push('regulations', regulations?.map((r) => ({
    id: String(r._id),
    title: r.title,
    subtitle: r.regulation_no,
    snippet: snippet(stripHtml(r.full_text), q),
    href: `/books/regulations/${String(r._id)}`,
  })) ?? null);
  push('questions', questions?.map((x) => ({
    id: String(x._id),
    title: snippet(stripHtml(x.body_bn || x.body_en), q, 140),
    href: `/questions/${String(x._id)}`,
  })) ?? null);

  return response;
}
