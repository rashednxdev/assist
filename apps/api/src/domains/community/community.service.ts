import mongoose, { type FilterQuery, type Types } from 'mongoose';
import {
  communityAnswerInputSchema,
  communityAnswerModerationSchema,
  communityCategoryInputSchema,
  communityReportInputSchema,
  communityResolveReportSchema,
  communityThreadInputSchema,
  communityThreadModerationSchema,
  communityThreadQuerySchema,
  type CommunityAnswerRecord,
  type CommunityAuthor,
  type CommunityCategoryRecord,
  type CommunityLinkKind,
  type CommunityLinkRecord,
  type CommunityLinkType,
  type CommunityOverview,
  type CommunityReportRecord,
  type CommunityThreadDetail,
  type CommunityThreadSummary,
} from '@ibas/shared-types';
import type { AuthUser } from '../../middleware/auth.js';
import { AppError, badRequest, forbidden, notFound } from '../../shared/errors/AppError.js';
import { logger } from '../../shared/logger.js';
import { User } from '../users/models/User.model.js';
import { Task } from '../workflow/models/Task.model.js';
import { ToolkitItem } from '../toolkit/models/ToolkitItem.model.js';
import { Circular } from '../policy/models/Circular.model.js';
import { deliverSystemNotification } from '../notifications/notifications.service.js';
import { CommunityCategory, type ICommunityCategory } from './models/CommunityCategory.model.js';
import { CommunityThread, type ICommunityLinkRef, type ICommunityThread } from './models/CommunityThread.model.js';
import { CommunityAnswer, type ICommunityAnswer } from './models/CommunityAnswer.model.js';
import { CommunityVote } from './models/CommunityVote.model.js';
import { CommunityFollow } from './models/CommunityFollow.model.js';
import { CommunityReport } from './models/CommunityReport.model.js';

const DAY_MS = 86_400_000;
const MAX_THREADS_PER_DAY = 10;
const MAX_ANSWERS_PER_DAY = 60;
const MAX_NOTIFY_FOLLOWERS = 500;

const DEFAULT_CATEGORIES = [
  { code: 'general', name: 'General discussion', color: '#0f766e', description: 'Anything new worth sharing with colleagues.' },
  { code: 'budget_accounts', name: 'Budget & accounts', color: '#1e40af', description: 'Budget preparation, execution, accounting and GL.' },
  { code: 'bills_payments', name: 'Bills & payments', color: '#b45309', description: 'Bill processing, EFT, pay fixation and allowances.' },
  { code: 'pension_service', name: 'Pension & service', color: '#7c3aed', description: 'Pension, PRL, leave and service matters.' },
  { code: 'ibas_help', name: 'iBAS++ help', color: '#0369a1', description: 'How-to questions and issues in iBAS++.' },
  { code: 'audit', name: 'Audit & compliance', color: '#be123c', description: 'Audit objections, broadsheet replies, rules and circulars.' },
  { code: 'exams_learning', name: 'Exams & learning', color: '#047857', description: 'Departmental exams, preparation and study tips.' },
];

export function isAdminUser(user: Pick<AuthUser, 'is_super_admin' | 'user_type'>): boolean {
  return user.is_super_admin || user.user_type === 'system_admin' || user.user_type === 'admin';
}

function zodMessage(err: { issues: Array<{ path: PropertyKey[]; message: string }> }): string {
  return err.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; ');
}

function oid(id: string, what: string): Types.ObjectId {
  if (!mongoose.isValidObjectId(id)) throw notFound(`${what} not found`);
  return new mongoose.Types.ObjectId(id);
}

function escapeRx(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Plain-text preview: drops the lightweight formatting marks used in posts. */
export function excerptOf(body: string, max = 180): string {
  const plain = body
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*(?:[-*]|\d+\.)\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
}

/* --------------------------------- authors --------------------------------- */

type AuthorDoc = {
  _id: unknown;
  full_name_en?: string;
  full_name_bn?: string;
  email?: string;
  user_type?: string;
  is_super_admin?: boolean;
};

function toAuthor(u: AuthorDoc | undefined, id: string): CommunityAuthor {
  const name = u?.full_name_en?.trim() || u?.full_name_bn?.trim() || u?.email?.split('@')[0] || 'Former member';
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('') || '?';
  return {
    id,
    name,
    initials,
    is_admin: !!u && (!!u.is_super_admin || u.user_type === 'system_admin' || u.user_type === 'admin'),
  };
}

async function loadAuthors(ids: Array<Types.ObjectId | string | undefined | null>): Promise<Map<string, CommunityAuthor>> {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (unique.length === 0) return new Map();
  const users = await User.find({ _id: { $in: unique } })
    .select('full_name_en full_name_bn email user_type is_super_admin')
    .lean<AuthorDoc[]>();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return new Map(unique.map((id) => [id, toAuthor(byId.get(id), id)]));
}

/* ---------------------------------- links ---------------------------------- */

const linkKey = (type: string, id: unknown) => `${type}:${String(id)}`;

/** Resolves tagged items. Unpublished or removed items are dropped for everyone. */
async function resolveLinks(refs: ICommunityLinkRef[]): Promise<Map<string, CommunityLinkRecord>> {
  const ids = (t: CommunityLinkType) => [...new Set(refs.filter((r) => r.type === t).map((r) => String(r.id)))];
  const [taskIds, kitIds, circIds] = [ids('task'), ids('toolkit'), ids('circular')];
  const [tasks, kits, circs] = await Promise.all([
    taskIds.length
      ? Task.find({ _id: { $in: taskIds }, is_active: true, is_published: true }).select('name_en module_name_en').lean()
      : [],
    kitIds.length
      ? ToolkitItem.find({ _id: { $in: kitIds }, is_active: true, is_published: true }).select('title kind').lean()
      : [],
    circIds.length
      ? Circular.find({ _id: { $in: circIds }, is_active: true, is_published: true }).select('title circular_no issue_date').lean()
      : [],
  ]);
  const out = new Map<string, CommunityLinkRecord>();
  for (const t of tasks) out.set(linkKey('task', t._id), taskLink(t));
  for (const k of kits) out.set(linkKey('toolkit', k._id), kitLink(k));
  for (const c of circs) out.set(linkKey('circular', c._id), circularLink(c));
  return out;
}

function taskLink(t: { _id: unknown; name_en: string; module_name_en?: string }): CommunityLinkRecord {
  return { type: 'task', id: String(t._id), kind: 'workflow', title: t.name_en, subtitle: t.module_name_en, href: `/guided-tasks/${String(t._id)}` };
}

function kitLink(k: { _id: unknown; title: string; kind: string }): CommunityLinkRecord {
  const kind = (['checklist', 'template', 'guide'].includes(k.kind) ? k.kind : 'guide') as CommunityLinkKind;
  return { type: 'toolkit', id: String(k._id), kind, title: k.title, href: `/toolkit/${String(k._id)}` };
}

function circularLink(c: { _id: unknown; title: string; circular_no?: string; issue_date?: string }): CommunityLinkRecord {
  return {
    type: 'circular',
    id: String(c._id),
    kind: 'circular',
    title: c.title,
    subtitle: [c.circular_no, c.issue_date].filter(Boolean).join(' · ') || undefined,
    href: `/circulars/${String(c._id)}`,
  };
}

function pickLinks(refs: ICommunityLinkRef[], resolved: Map<string, CommunityLinkRecord>): CommunityLinkRecord[] {
  return refs.map((r) => resolved.get(linkKey(r.type, r.id))).filter((l): l is CommunityLinkRecord => !!l);
}

async function assertLinks(links: Array<{ type: CommunityLinkType; id: string }>): Promise<void> {
  if (links.length === 0) return;
  const resolved = await resolveLinks(links.map((l) => ({ type: l.type, id: new mongoose.Types.ObjectId(l.id) })));
  if (links.some((l) => !resolved.has(linkKey(l.type, l.id)))) {
    throw badRequest('Some tagged items are no longer available. Remove them and try again.');
  }
}

const KIND_TO_TOOLKIT: Partial<Record<CommunityLinkKind, string>> = { checklist: 'checklist', template: 'template', guide: 'guide' };

/** Published workflows, toolkit items and circulars matching q, for the tag picker. */
export async function linkOptions(q: string, kind?: string): Promise<CommunityLinkRecord[]> {
  const term = q.trim().slice(0, 100);
  const rx = term ? new RegExp(escapeRx(term), 'i') : null;
  const want = (k: CommunityLinkKind) => !kind || kind === k;
  const kitKinds = (['checklist', 'template', 'guide'] as const).filter((k) => want(k)).map((k) => KIND_TO_TOOLKIT[k]!);
  const [tasks, kits, circs] = await Promise.all([
    want('workflow')
      ? Task.find({ is_active: true, is_published: true, ...(rx ? { $or: [{ name_en: rx }, { name_bn: rx }, { code: rx }] } : {}) })
          .select('name_en module_name_en')
          .sort({ name_en: 1 })
          .limit(12)
          .lean()
      : [],
    kitKinds.length
      ? ToolkitItem.find({ is_active: true, is_published: true, kind: { $in: kitKinds }, ...(rx ? { $or: [{ title: rx }, { title_bn: rx }, { tags: rx }] } : {}) })
          .select('title kind')
          .sort({ title: 1 })
          .limit(15)
          .lean()
      : [],
    want('circular')
      ? Circular.find({ is_active: true, is_published: true, ...(rx ? { $or: [{ title: rx }, { title_bn: rx }, { circular_no: rx }, { tags: rx }] } : {}) })
          .select('title circular_no issue_date')
          .sort({ issue_date: -1 })
          .limit(15)
          .lean()
      : [],
  ]);
  return [...tasks.map(taskLink), ...kits.map(kitLink), ...circs.map(circularLink)];
}

/* -------------------------------- categories -------------------------------- */

/** Inserts the starter categories once; never overwrites admin edits. */
export async function ensureDefaultCommunityCategories(): Promise<void> {
  if ((await CommunityCategory.estimatedDocumentCount()) > 0) return;
  await CommunityCategory.bulkWrite(
    DEFAULT_CATEGORIES.map((c, idx) => ({
      updateOne: {
        filter: { code: c.code },
        update: { $setOnInsert: { ...c, sort_order: (idx + 1) * 10, is_active: true } },
        upsert: true,
      },
    })),
  );
}

function visibleThreadFilter(user: AuthUser): FilterQuery<ICommunityThread> {
  if (isAdminUser(user)) return { is_deleted: false };
  return { is_deleted: false, $or: [{ is_hidden: false }, { author_id: new mongoose.Types.ObjectId(user.id) }] };
}

function toCategory(doc: ICommunityCategory, count: number): CommunityCategoryRecord {
  return {
    id: String(doc._id),
    name: doc.name,
    name_bn: doc.name_bn || undefined,
    description: doc.description || undefined,
    color: doc.color,
    sort_order: doc.sort_order,
    is_active: doc.is_active,
    thread_count: count,
  };
}

async function threadCountsByCategory(): Promise<Map<string, number>> {
  const rows = await CommunityThread.aggregate<{ _id: unknown; n: number }>([
    { $match: { is_deleted: false, is_hidden: false } },
    { $group: { _id: '$category_id', n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

export async function listCategories(includeInactive: boolean): Promise<CommunityCategoryRecord[]> {
  const [docs, counts] = await Promise.all([
    CommunityCategory.find(includeInactive ? {} : { is_active: true }).sort({ sort_order: 1, name: 1 }),
    threadCountsByCategory(),
  ]);
  return docs.map((d) => toCategory(d, counts.get(String(d._id)) ?? 0));
}

export async function createCategory(body: unknown, userId: string): Promise<CommunityCategoryRecord> {
  const parsed = communityCategoryInputSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const base = parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'category';
  let code = base;
  for (let i = 2; await CommunityCategory.exists({ code }); i++) code = `${base}_${i}`;
  const doc = await CommunityCategory.create({
    ...parsed.data,
    code,
    name_bn: parsed.data.name_bn || undefined,
    description: parsed.data.description || undefined,
    updated_by: userId,
  });
  return toCategory(doc, 0);
}

export async function updateCategory(id: string, body: unknown, userId: string): Promise<CommunityCategoryRecord> {
  const doc = await CommunityCategory.findById(oid(id, 'Category'));
  if (!doc) throw notFound('Category not found');
  const parsed = communityCategoryInputSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  doc.set({
    ...parsed.data,
    name_bn: parsed.data.name_bn || undefined,
    description: parsed.data.description || undefined,
    updated_by: userId,
  });
  await doc.save();
  return toCategory(doc, (await threadCountsByCategory()).get(String(doc._id)) ?? 0);
}

export async function deleteCategory(id: string): Promise<void> {
  const doc = await CommunityCategory.findById(oid(id, 'Category'));
  if (!doc) throw notFound('Category not found');
  const used = await CommunityThread.countDocuments({ category_id: doc._id, is_deleted: false });
  if (used > 0) throw badRequest(`${used} discussion(s) use this category. Move them or turn the category off instead.`);
  await doc.deleteOne();
}

/* --------------------------------- threads --------------------------------- */

async function categoryBriefs(ids: unknown[]): Promise<Map<string, { id: string; name: string; color: string }>> {
  const unique = [...new Set(ids.map(String))];
  const docs = unique.length ? await CommunityCategory.find({ _id: { $in: unique } }).select('name color').lean() : [];
  return new Map(docs.map((d) => [String(d._id), { id: String(d._id), name: d.name, color: d.color }]));
}

async function userStates(userId: string, threadIds: unknown[], answerIds: unknown[] = []) {
  const uid = new mongoose.Types.ObjectId(userId);
  const [votes, follows] = await Promise.all([
    CommunityVote.find({ user_id: uid, target_id: { $in: [...threadIds, ...answerIds] } }).select('target_id').lean(),
    threadIds.length ? CommunityFollow.find({ user_id: uid, thread_id: { $in: threadIds } }).select('thread_id').lean() : [],
  ]);
  return {
    voted: new Set(votes.map((v) => String(v.target_id))),
    following: new Set(follows.map((f) => String(f.thread_id))),
  };
}

export async function listThreads(query: unknown, user: AuthUser) {
  const parsed = communityThreadQuerySchema.safeParse(query);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const q = parsed.data;
  const and: FilterQuery<ICommunityThread>[] = [
    q.include_hidden && isAdminUser(user) ? { is_deleted: false } : visibleThreadFilter(user),
  ];
  if (q.q) {
    const rx = new RegExp(escapeRx(q.q), 'i');
    and.push({ $or: [{ title: rx }, { body: rx }, { tags: rx }] });
  }
  if (q.category) and.push({ category_id: new mongoose.Types.ObjectId(q.category) });
  if (q.tag) and.push({ tags: q.tag.replace(/^#/, '') });
  if (q.link_type && q.link_id) {
    and.push({ links: { $elemMatch: { type: q.link_type, id: new mongoose.Types.ObjectId(q.link_id) } } });
  } else if (q.link_type) {
    and.push({ 'links.type': q.link_type });
  }
  if (q.filter === 'mine') and.push({ author_id: new mongoose.Types.ObjectId(user.id) });
  if (q.filter === 'solved') and.push({ accepted_answer_id: { $ne: null } });
  if (q.filter === 'unsolved') and.push({ accepted_answer_id: null });
  if (q.filter === 'following') {
    const follows = await CommunityFollow.find({ user_id: user.id }).select('thread_id').limit(1000).lean();
    and.push({ _id: { $in: follows.map((f) => f.thread_id) } });
  }
  if (q.sort === 'unanswered') and.push({ answer_count: 0 });

  const sort: Record<string, 1 | -1> =
    q.sort === 'top'
      ? { vote_score: -1, answer_count: -1, created_at: -1 }
      : q.sort === 'new' || q.sort === 'unanswered'
        ? { is_pinned: -1, created_at: -1 }
        : { is_pinned: -1, last_activity_at: -1 };
  const filter = { $and: and };
  const [total, docs] = await Promise.all([
    CommunityThread.countDocuments(filter),
    CommunityThread.find(filter)
      .sort(sort)
      .skip((q.page - 1) * q.limit)
      .limit(q.limit),
  ]);
  return { items: await toSummaries(docs, user), total, page: q.page, limit: q.limit };
}

async function toSummaries(docs: ICommunityThread[], user: AuthUser): Promise<CommunityThreadSummary[]> {
  const [authors, cats, states, resolved] = await Promise.all([
    loadAuthors(docs.flatMap((d) => [d.author_id, d.last_answer_by])),
    categoryBriefs(docs.map((d) => d.category_id)),
    userStates(user.id, docs.map((d) => d._id)),
    resolveLinks(docs.flatMap((d) => d.links ?? [])),
  ]);
  return docs.map((d) => ({
    id: String(d._id),
    title: d.title,
    excerpt: excerptOf(d.body),
    category: cats.get(String(d.category_id)),
    tags: d.tags ?? [],
    link_kinds: [...new Set(pickLinks(d.links ?? [], resolved).map((l) => l.kind))],
    author: authors.get(String(d.author_id)) ?? toAuthor(undefined, String(d.author_id)),
    answer_count: d.answer_count,
    vote_score: d.vote_score,
    view_count: d.view_count,
    is_solved: !!d.accepted_answer_id,
    is_pinned: d.is_pinned,
    is_locked: d.is_locked,
    is_hidden: d.is_hidden,
    created_at: d.created_at.toISOString(),
    last_activity_at: (d.last_activity_at ?? d.created_at).toISOString(),
    last_answer_by: d.last_answer_by ? authors.get(String(d.last_answer_by))?.name : undefined,
    voted: states.voted.has(String(d._id)),
    following: states.following.has(String(d._id)),
  }));
}

async function loadThread(id: string, user: AuthUser): Promise<ICommunityThread> {
  const doc = await CommunityThread.findById(oid(id, 'Discussion'));
  if (!doc || doc.is_deleted) throw notFound('Discussion not found');
  if (doc.is_hidden && !isAdminUser(user) && String(doc.author_id) !== user.id) throw notFound('Discussion not found');
  return doc;
}

export async function getThread(id: string, user: AuthUser, countView = true): Promise<CommunityThreadDetail> {
  const doc = await loadThread(id, user);
  const admin = isAdminUser(user);
  if (countView && String(doc.author_id) !== user.id) {
    await CommunityThread.updateOne({ _id: doc._id }, { $inc: { view_count: 1 } });
    doc.view_count += 1;
  }
  const answers = await CommunityAnswer.find({
    thread_id: doc._id,
    is_deleted: false,
    ...(admin ? {} : { $or: [{ is_hidden: false }, { author_id: new mongoose.Types.ObjectId(user.id) }] }),
  }).sort({ is_accepted: -1, vote_score: -1, created_at: 1 });
  const [authors, cats, states, resolved] = await Promise.all([
    loadAuthors([doc.author_id, doc.last_answer_by, ...answers.map((a) => a.author_id)]),
    categoryBriefs([doc.category_id]),
    userStates(user.id, [doc._id], answers.map((a) => a._id)),
    resolveLinks([...(doc.links ?? []), ...answers.flatMap((a) => a.links ?? [])]),
  ]);
  const isAuthor = String(doc.author_id) === user.id;
  const answerRecords: CommunityAnswerRecord[] = answers.map((a) => ({
    id: String(a._id),
    body: a.body,
    links: pickLinks(a.links ?? [], resolved),
    author: authors.get(String(a.author_id)) ?? toAuthor(undefined, String(a.author_id)),
    vote_score: a.vote_score,
    voted: states.voted.has(String(a._id)),
    is_accepted: a.is_accepted,
    is_hidden: a.is_hidden,
    created_at: a.created_at.toISOString(),
    edited_at: a.edited_at?.toISOString(),
    can_edit: admin || String(a.author_id) === user.id,
  }));
  return {
    id: String(doc._id),
    title: doc.title,
    body: doc.body,
    links: pickLinks(doc.links ?? [], resolved),
    category: cats.get(String(doc.category_id)),
    tags: doc.tags ?? [],
    author: authors.get(String(doc.author_id)) ?? toAuthor(undefined, String(doc.author_id)),
    answer_count: doc.answer_count,
    vote_score: doc.vote_score,
    view_count: doc.view_count,
    follower_count: doc.follower_count,
    is_solved: !!doc.accepted_answer_id,
    accepted_answer_id: doc.accepted_answer_id ? String(doc.accepted_answer_id) : undefined,
    is_pinned: doc.is_pinned,
    is_locked: doc.is_locked,
    is_hidden: doc.is_hidden,
    created_at: doc.created_at.toISOString(),
    last_activity_at: (doc.last_activity_at ?? doc.created_at).toISOString(),
    last_answer_by: doc.last_answer_by ? authors.get(String(doc.last_answer_by))?.name : undefined,
    edited_at: doc.edited_at?.toISOString(),
    voted: states.voted.has(String(doc._id)),
    following: states.following.has(String(doc._id)),
    answers: answerRecords,
    can_edit: admin || isAuthor,
    can_accept: admin || isAuthor,
    can_moderate: admin,
  };
}

async function assertCategory(id: string): Promise<void> {
  const cat = await CommunityCategory.findById(id).select('is_active').lean();
  if (!cat || !cat.is_active) throw badRequest('Choose an available category');
}

async function assertDailyLimit(kind: 'thread' | 'answer', user: AuthUser): Promise<void> {
  if (isAdminUser(user)) return;
  const since = new Date(Date.now() - DAY_MS);
  const Model = kind === 'thread' ? CommunityThread : CommunityAnswer;
  const max = kind === 'thread' ? MAX_THREADS_PER_DAY : MAX_ANSWERS_PER_DAY;
  const n = await (Model as typeof CommunityThread).countDocuments({ author_id: user.id, created_at: { $gte: since } });
  if (n >= max) {
    throw new AppError(429, 'COMMUNITY_LIMIT', `You can post up to ${max} ${kind === 'thread' ? 'discussions' : 'answers'} a day. Please try again later.`);
  }
}

function assertActive(user: AuthUser): void {
  if (user.status !== 'active') throw forbidden('Verify your account to take part in the community');
}

export async function createThread(user: AuthUser, body: unknown): Promise<CommunityThreadDetail> {
  assertActive(user);
  const parsed = communityThreadInputSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const d = parsed.data;
  await assertCategory(d.category_id);
  await assertLinks(d.links);
  await assertDailyLimit('thread', user);
  const doc = await CommunityThread.create({
    title: d.title,
    body: d.body,
    category_id: d.category_id,
    author_id: user.id,
    tags: d.tags,
    links: d.links,
    follower_count: 1,
    last_activity_at: new Date(),
  });
  await CommunityFollow.create({ user_id: user.id, thread_id: doc._id });
  return getThread(String(doc._id), user, false);
}

export async function updateThread(id: string, body: unknown, user: AuthUser): Promise<CommunityThreadDetail> {
  const doc = await loadThread(id, user);
  if (!isAdminUser(user) && String(doc.author_id) !== user.id) throw forbidden('Only the author can edit this discussion');
  const parsed = communityThreadInputSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const d = parsed.data;
  if (String(doc.category_id) !== d.category_id) await assertCategory(d.category_id);
  await assertLinks(d.links);
  doc.set({ title: d.title, body: d.body, category_id: d.category_id, tags: d.tags, links: d.links, edited_at: new Date() });
  await doc.save();
  return getThread(id, user, false);
}

export async function deleteThread(id: string, user: AuthUser): Promise<void> {
  const doc = await loadThread(id, user);
  if (!isAdminUser(user) && String(doc.author_id) !== user.id) throw forbidden('Only the author can delete this discussion');
  doc.is_deleted = true;
  await doc.save();
  await CommunityReport.updateMany({ thread_id: doc._id, status: 'open' }, { status: 'resolved', resolution: 'hidden', resolved_at: new Date() });
}

/* --------------------------------- answers --------------------------------- */

async function loadAnswer(id: string, user: AuthUser): Promise<{ answer: ICommunityAnswer; thread: ICommunityThread }> {
  const answer = await CommunityAnswer.findById(oid(id, 'Answer'));
  if (!answer || answer.is_deleted) throw notFound('Answer not found');
  if (answer.is_hidden && !isAdminUser(user) && String(answer.author_id) !== user.id) throw notFound('Answer not found');
  const thread = await loadThread(String(answer.thread_id), user);
  return { answer, thread };
}

async function syncThreadStats(threadId: Types.ObjectId): Promise<void> {
  const [count, last] = await Promise.all([
    CommunityAnswer.countDocuments({ thread_id: threadId, is_deleted: false, is_hidden: false }),
    CommunityAnswer.findOne({ thread_id: threadId, is_deleted: false, is_hidden: false }).sort({ created_at: -1 }).select('author_id created_at').lean(),
  ]);
  const thread = await CommunityThread.findById(threadId).select('created_at');
  await CommunityThread.updateOne(
    { _id: threadId },
    {
      $set: {
        answer_count: count,
        last_activity_at: last?.created_at ?? thread?.created_at ?? new Date(),
        ...(last ? { last_answer_by: last.author_id } : {}),
      },
      ...(last ? {} : { $unset: { last_answer_by: 1 } }),
    },
  );
}

function notifyInBackground(input: Parameters<typeof deliverSystemNotification>[0]): void {
  if (input.userIds.length === 0) return;
  void deliverSystemNotification({ ...input, source: 'community' }).catch((err) =>
    logger.warn({ err }, 'Community notification failed'),
  );
}

export async function createAnswer(threadId: string, body: unknown, user: AuthUser): Promise<CommunityAnswerRecord> {
  assertActive(user);
  const thread = await loadThread(threadId, user);
  if (thread.is_locked && !isAdminUser(user)) throw forbidden('This discussion is locked');
  if (thread.is_hidden && !isAdminUser(user)) throw forbidden('This discussion is hidden by a moderator');
  const parsed = communityAnswerInputSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  await assertLinks(parsed.data.links);
  await assertDailyLimit('answer', user);
  const answer = await CommunityAnswer.create({
    thread_id: thread._id,
    author_id: user.id,
    body: parsed.data.body,
    links: parsed.data.links,
  });
  await CommunityThread.updateOne(
    { _id: thread._id },
    { $inc: { answer_count: 1 }, $set: { last_activity_at: answer.created_at, last_answer_by: answer.author_id } },
  );

  const followers = await CommunityFollow.find({ thread_id: thread._id }).select('user_id').limit(MAX_NOTIFY_FOLLOWERS).lean();
  const recipients = [...new Set([String(thread.author_id), ...followers.map((f) => String(f.user_id))])].filter((id) => id !== user.id);
  const author = (await loadAuthors([user.id])).get(user.id)!;
  notifyInBackground({
    userIds: recipients,
    title: `New answer: ${thread.title}`.slice(0, 200),
    message: `${author.name}: ${excerptOf(parsed.data.body, 220)}`,
    createdBy: user.id,
    link: `/community/${String(thread._id)}#answer-${String(answer._id)}`,
    data: { type: 'community_answer', thread_id: String(thread._id), answer_id: String(answer._id) },
  });

  const detail = await getThread(String(thread._id), user, false);
  return detail.answers.find((a) => a.id === String(answer._id))!;
}

export async function updateAnswer(id: string, body: unknown, user: AuthUser): Promise<CommunityAnswerRecord> {
  const { answer, thread } = await loadAnswer(id, user);
  if (!isAdminUser(user) && String(answer.author_id) !== user.id) throw forbidden('Only the author can edit this answer');
  if (thread.is_locked && !isAdminUser(user)) throw forbidden('This discussion is locked');
  const parsed = communityAnswerInputSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  await assertLinks(parsed.data.links);
  answer.set({ body: parsed.data.body, links: parsed.data.links, edited_at: new Date() });
  await answer.save();
  const detail = await getThread(String(thread._id), user, false);
  return detail.answers.find((a) => a.id === id)!;
}

export async function deleteAnswer(id: string, user: AuthUser): Promise<void> {
  const { answer, thread } = await loadAnswer(id, user);
  if (!isAdminUser(user) && String(answer.author_id) !== user.id) throw forbidden('Only the author can delete this answer');
  answer.is_deleted = true;
  answer.is_accepted = false;
  await answer.save();
  if (String(thread.accepted_answer_id) === id) await CommunityThread.updateOne({ _id: thread._id }, { accepted_answer_id: null });
  await syncThreadStats(thread._id as Types.ObjectId);
  await CommunityReport.updateMany({ target_id: answer._id, status: 'open' }, { status: 'resolved', resolution: 'hidden', resolved_at: new Date() });
}

/* ------------------------------ votes & follows ------------------------------ */

export async function toggleVote(targetType: 'thread' | 'answer', id: string, user: AuthUser): Promise<{ voted: boolean; vote_score: number }> {
  assertActive(user);
  let threadId: Types.ObjectId;
  let authorId: string;
  if (targetType === 'thread') {
    const t = await loadThread(id, user);
    threadId = t._id as Types.ObjectId;
    authorId = String(t.author_id);
  } else {
    const { answer, thread } = await loadAnswer(id, user);
    threadId = thread._id as Types.ObjectId;
    authorId = String(answer.author_id);
  }
  if (authorId === user.id) throw badRequest("You can't vote on your own post");
  const Model = targetType === 'thread' ? CommunityThread : CommunityAnswer;
  const targetId = new mongoose.Types.ObjectId(id);
  const removed = await CommunityVote.findOneAndDelete({ user_id: user.id, target_type: targetType, target_id: targetId });
  let voted: boolean;
  if (removed) {
    voted = false;
    await (Model as typeof CommunityThread).updateOne({ _id: targetId }, { $inc: { vote_score: -1 } });
  } else {
    try {
      await CommunityVote.create({ user_id: user.id, target_type: targetType, target_id: targetId, thread_id: threadId });
      await (Model as typeof CommunityThread).updateOne({ _id: targetId }, { $inc: { vote_score: 1 } });
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err;
    }
    voted = true;
  }
  const fresh = await (Model as typeof CommunityThread).findById(targetId).select('vote_score').lean();
  return { voted, vote_score: fresh?.vote_score ?? 0 };
}

export async function toggleFollow(threadId: string, user: AuthUser): Promise<{ following: boolean; follower_count: number }> {
  const thread = await loadThread(threadId, user);
  const removed = await CommunityFollow.findOneAndDelete({ user_id: user.id, thread_id: thread._id });
  if (removed) {
    await CommunityThread.updateOne({ _id: thread._id }, { $inc: { follower_count: -1 } });
  } else {
    try {
      await CommunityFollow.create({ user_id: user.id, thread_id: thread._id });
      await CommunityThread.updateOne({ _id: thread._id }, { $inc: { follower_count: 1 } });
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err;
    }
  }
  const fresh = await CommunityThread.findById(thread._id).select('follower_count').lean();
  return { following: !removed, follower_count: Math.max(0, fresh?.follower_count ?? 0) };
}

/** The asker (or an admin) marks one answer as the solution; null clears it. */
export async function acceptAnswer(threadId: string, answerId: string | null, user: AuthUser): Promise<{ accepted_answer_id: string | null }> {
  const thread = await loadThread(threadId, user);
  if (!isAdminUser(user) && String(thread.author_id) !== user.id) throw forbidden('Only the person who asked can accept an answer');
  let answer: ICommunityAnswer | null = null;
  if (answerId) {
    answer = await CommunityAnswer.findOne({ _id: oid(answerId, 'Answer'), thread_id: thread._id, is_deleted: false, is_hidden: false });
    if (!answer) throw notFound('Answer not found');
  }
  const previous = thread.accepted_answer_id ? String(thread.accepted_answer_id) : null;
  await CommunityAnswer.updateMany({ thread_id: thread._id, is_accepted: true }, { is_accepted: false });
  if (answer) {
    answer.is_accepted = true;
    await answer.save();
  }
  thread.accepted_answer_id = answer ? (answer._id as Types.ObjectId) : null;
  await thread.save();

  if (answer && previous !== String(answer._id) && String(answer.author_id) !== user.id) {
    notifyInBackground({
      userIds: [String(answer.author_id)],
      title: 'Your answer was accepted',
      message: `Your answer on "${thread.title}" was marked as the solution. Thank you for helping!`,
      createdBy: user.id,
      link: `/community/${String(thread._id)}#answer-${String(answer._id)}`,
      data: { type: 'community_accepted', thread_id: String(thread._id), answer_id: String(answer._id) },
    });
  }
  return { accepted_answer_id: answer ? String(answer._id) : null };
}

/* --------------------------------- overview --------------------------------- */

export async function getOverview(): Promise<CommunityOverview> {
  const since = new Date(Date.now() - 30 * DAY_MS);
  const [categories, tags, contributors, threads, answers, solved] = await Promise.all([
    listCategories(false),
    CommunityThread.aggregate<{ _id: string; count: number }>([
      { $match: { is_deleted: false, is_hidden: false, created_at: { $gte: since } } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 12 },
    ]),
    CommunityAnswer.aggregate<{ _id: unknown; answers: number; accepted: number }>([
      { $match: { is_deleted: false, is_hidden: false, created_at: { $gte: since } } },
      { $group: { _id: '$author_id', answers: { $sum: 1 }, accepted: { $sum: { $cond: ['$is_accepted', 1, 0] } } } },
      { $addFields: { score: { $add: ['$answers', { $multiply: ['$accepted', 3] }] } } },
      { $sort: { score: -1 } },
      { $limit: 5 },
    ]),
    CommunityThread.countDocuments({ is_deleted: false, is_hidden: false }),
    CommunityAnswer.countDocuments({ is_deleted: false, is_hidden: false }),
    CommunityThread.countDocuments({ is_deleted: false, is_hidden: false, accepted_answer_id: { $ne: null } }),
  ]);
  const authors = await loadAuthors(contributors.map((c) => String(c._id)));
  return {
    categories,
    trending_tags: tags.map((t) => ({ tag: t._id, count: t.count })),
    top_contributors: contributors.map((c) => ({
      ...(authors.get(String(c._id)) ?? toAuthor(undefined, String(c._id))),
      answers: c.answers,
      accepted: c.accepted,
    })),
    stats: { threads, answers, solved },
  };
}

/* ------------------------------ reports & moderation ------------------------------ */

export async function reportContent(body: unknown, user: AuthUser): Promise<{ ok: true }> {
  const parsed = communityReportInputSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const r = parsed.data;
  let threadId: Types.ObjectId;
  let authorId: string;
  if (r.target_type === 'thread') {
    const t = await loadThread(r.target_id, user);
    threadId = t._id as Types.ObjectId;
    authorId = String(t.author_id);
  } else {
    const { answer, thread } = await loadAnswer(r.target_id, user);
    threadId = thread._id as Types.ObjectId;
    authorId = String(answer.author_id);
  }
  if (authorId === user.id) throw badRequest("You can't report your own post");
  await CommunityReport.updateOne(
    { target_type: r.target_type, target_id: r.target_id, reporter_id: user.id },
    {
      $set: { reason: r.reason, note: r.note || undefined, status: 'open', thread_id: threadId },
      $unset: { resolution: 1, resolved_by: 1, resolved_at: 1 },
    },
    { upsert: true },
  );
  return { ok: true };
}

export async function moderateThread(id: string, body: unknown, admin: AuthUser): Promise<CommunityThreadDetail> {
  const doc = await CommunityThread.findById(oid(id, 'Discussion'));
  if (!doc || doc.is_deleted) throw notFound('Discussion not found');
  const parsed = communityThreadModerationSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const m = parsed.data;
  if (m.category_id) await assertCategory(m.category_id);
  if (m.is_hidden !== undefined) doc.is_hidden = m.is_hidden;
  if (m.is_locked !== undefined) doc.is_locked = m.is_locked;
  if (m.is_pinned !== undefined) doc.is_pinned = m.is_pinned;
  if (m.category_id) doc.category_id = new mongoose.Types.ObjectId(m.category_id);
  if (m.note !== undefined) doc.moderation_note = m.note || undefined;
  await doc.save();
  if (m.is_hidden) {
    await CommunityReport.updateMany(
      { target_type: 'thread', target_id: doc._id, status: 'open' },
      { status: 'resolved', resolution: 'hidden', resolved_by: admin.id, resolved_at: new Date() },
    );
  }
  return getThread(id, admin, false);
}

export async function moderateAnswer(id: string, body: unknown, admin: AuthUser): Promise<{ ok: true }> {
  const answer = await CommunityAnswer.findById(oid(id, 'Answer'));
  if (!answer || answer.is_deleted) throw notFound('Answer not found');
  const parsed = communityAnswerModerationSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  answer.is_hidden = parsed.data.is_hidden;
  answer.moderation_note = parsed.data.note || undefined;
  if (answer.is_hidden && answer.is_accepted) {
    answer.is_accepted = false;
    await CommunityThread.updateOne({ _id: answer.thread_id }, { accepted_answer_id: null });
  }
  await answer.save();
  await syncThreadStats(answer.thread_id);
  if (answer.is_hidden) {
    await CommunityReport.updateMany(
      { target_type: 'answer', target_id: answer._id, status: 'open' },
      { status: 'resolved', resolution: 'hidden', resolved_by: admin.id, resolved_at: new Date() },
    );
  }
  return { ok: true };
}

export async function listReports(status: string | undefined) {
  const filter = status === 'resolved' ? { status: 'resolved' } : status === 'all' ? {} : { status: 'open' };
  const rows = await CommunityReport.find(filter).sort({ created_at: -1 }).limit(200);
  const threadIds = [...new Set(rows.map((r) => String(r.thread_id)))];
  const answerIds = rows.filter((r) => r.target_type === 'answer').map((r) => r.target_id);
  const [threads, answers, reporters, counts] = await Promise.all([
    CommunityThread.find({ _id: { $in: threadIds } }).select('title body is_hidden is_deleted').lean(),
    CommunityAnswer.find({ _id: { $in: answerIds } }).select('body is_hidden is_deleted').lean(),
    loadAuthors(rows.map((r) => r.reporter_id)),
    CommunityReport.aggregate<{ _id: unknown; n: number }>([
      { $match: { target_id: { $in: rows.map((r) => r.target_id) }, status: 'open' } },
      { $group: { _id: '$target_id', n: { $sum: 1 } } },
    ]),
  ]);
  const threadById = new Map(threads.map((t) => [String(t._id), t]));
  const answerById = new Map(answers.map((a) => [String(a._id), a]));
  const countById = new Map(counts.map((c) => [String(c._id), c.n]));
  const items: CommunityReportRecord[] = rows.map((r) => {
    const thread = threadById.get(String(r.thread_id));
    const target = r.target_type === 'thread' ? thread : answerById.get(String(r.target_id));
    return {
      id: String(r._id),
      target_type: r.target_type,
      target_id: String(r.target_id),
      thread_id: String(r.thread_id),
      thread_title: thread?.title ?? '(deleted discussion)',
      excerpt: target ? excerptOf(target.body, 240) : '(deleted)',
      target_hidden: !target || target.is_hidden || target.is_deleted,
      reason: r.reason,
      note: r.note || undefined,
      reporter: { id: String(r.reporter_id), name: reporters.get(String(r.reporter_id))?.name ?? 'Unknown' },
      status: r.status,
      resolution: r.resolution,
      report_count: countById.get(String(r.target_id)) ?? 0,
      created_at: r.created_at.toISOString(),
    };
  });
  const open = await CommunityReport.countDocuments({ status: 'open' });
  return { items, open_count: open };
}

export async function resolveReport(id: string, body: unknown, admin: AuthUser): Promise<{ ok: true }> {
  const report = await CommunityReport.findById(oid(id, 'Report'));
  if (!report) throw notFound('Report not found');
  const parsed = communityResolveReportSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  if (parsed.data.action === 'hide') {
    const Model = report.target_type === 'thread' ? CommunityThread : CommunityAnswer;
    const exists = await (Model as typeof CommunityThread).exists({ _id: report.target_id, is_deleted: false });
    if (exists && report.target_type === 'thread') await moderateThread(String(report.target_id), { is_hidden: true }, admin);
    else if (exists) await moderateAnswer(String(report.target_id), { is_hidden: true }, admin);
  }
  await CommunityReport.updateMany(
    { target_type: report.target_type, target_id: report.target_id, status: 'open' },
    {
      status: 'resolved',
      resolution: parsed.data.action === 'hide' ? 'hidden' : 'dismissed',
      resolved_by: admin.id,
      resolved_at: new Date(),
    },
  );
  return { ok: true };
}
