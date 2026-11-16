import crypto from 'node:crypto';
import type { ExamPrepPartOption, ExamPrepPartsResponse } from '@ibas/shared-types';
import { selectExamPrepPartSchema } from '@ibas/shared-types';
import { badRequest, notFound } from '../../shared/errors/AppError.js';
import { ExamName } from '../exams/models/ExamName.model.js';
import { ExamPart } from '../exams/models/ExamPart.model.js';
import { ExamSubject } from '../exams/models/ExamSubject.model.js';
import { UserEntitlement } from '../billing/models/UserEntitlement.model.js';
import { User } from '../users/models/User.model.js';
import { type ExamSubjectScope } from '../users/subject-access.service.js';

/*
 * A learner sees only the subjects on their active Exam Preparation enrollment.
 * One subject package opens that subject. A whole-part package opens every subject of that part.
 * Older grants with no part and no subject still open the primary part. Content with no subject
 * tag stays hidden from learners, so a single-subject enrollment does not pull in the rest of the catalog.
 */

export interface PartRow {
  id: string;
  exam_name_id: string;
  exam_name: string;
  exam_short: string;
  part_number: number;
  name: string;
  name_bn?: string;
  is_primary: boolean;
  subjects: Array<{ id: string; name: string; name_bn?: string }>;
}

const PART_CACHE_MS = 30_000;
let partCache: { at: number; rows: PartRow[] } | null = null;

export function invalidateExamPrepParts(): void {
  partCache = null;
}

/** Active parts (with their active subjects) of active exams, Part 1 first. */
export async function loadExamPrepParts(): Promise<PartRow[]> {
  if (partCache && Date.now() - partCache.at < PART_CACHE_MS) return partCache.rows;
  const [exams, parts, subjects] = await Promise.all([
    ExamName.find({ is_active: true }).select('name short_name created_at').lean(),
    ExamPart.find({ is_active: true }).select('exam_name_id name name_bn part_number').lean(),
    ExamSubject.find({ is_active: true }).select('exam_part_id name name_bn').sort({ name: 1 }).lean(),
  ]);
  const examById = new Map(exams.map((e) => [String(e._id), e]));
  const examOrder = new Map(
    [...exams]
      .sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())
      .map((e, i) => [String(e._id), i]),
  );
  const subjectsByPart = new Map<string, PartRow['subjects']>();
  for (const s of subjects) {
    const key = String(s.exam_part_id);
    const list = subjectsByPart.get(key) ?? [];
    list.push({ id: String(s._id), name: s.name, name_bn: s.name_bn || undefined });
    subjectsByPart.set(key, list);
  }
  const rows = parts
    .filter((p) => examById.has(String(p.exam_name_id)))
    .sort(
      (a, b) =>
        a.part_number - b.part_number ||
        (examOrder.get(String(a.exam_name_id)) ?? 0) - (examOrder.get(String(b.exam_name_id)) ?? 0),
    )
    .map((p) => {
      const exam = examById.get(String(p.exam_name_id))!;
      return {
        id: String(p._id),
        exam_name_id: String(p.exam_name_id),
        exam_name: exam.name,
        exam_short: exam.short_name?.trim() || exam.name,
        part_number: p.part_number,
        name: p.name,
        name_bn: p.name_bn || undefined,
        is_primary: false,
        subjects: subjectsByPart.get(String(p._id)) ?? [],
      };
    });
  const primary = rows.filter((r) => r.part_number === 1);
  for (const r of primary.length ? primary : rows.slice(0, 1)) r.is_primary = true;
  partCache = { at: Date.now(), rows };
  return rows;
}

export function partLabel(row: Pick<PartRow, 'part_number' | 'exam_short'>, rows: PartRow[]): string {
  const severalExams = new Set(rows.map((r) => r.exam_name_id)).size > 1;
  return severalExams ? `${row.exam_short} · Part ${row.part_number}` : `Part ${row.part_number}`;
}

/**
 * Subject → its part, with a "Part N" label only when that exam has more than one part (so subject
 * labels stay unchanged until a Part 2 exists).
 */
export async function partOfSubject(): Promise<Map<string, { part: PartRow; label?: string }>> {
  const rows = await loadExamPrepParts();
  const partsPerExam = new Map<string, number>();
  for (const r of rows) partsPerExam.set(r.exam_name_id, (partsPerExam.get(r.exam_name_id) ?? 0) + 1);
  const map = new Map<string, { part: PartRow; label?: string }>();
  for (const r of rows) {
    const label = (partsPerExam.get(r.exam_name_id) ?? 0) > 1 ? `Part ${r.part_number}` : undefined;
    for (const s of r.subjects) map.set(s.id, { part: r, label });
  }
  return map;
}

function isAdminUser(user?: { is_super_admin?: boolean; user_type?: string } | null): boolean {
  return !!user && (user.is_super_admin || user.user_type === 'system_admin' || user.user_type === 'admin');
}

/** Admins and Hosts see every Learning subject. Hosts are not platform admins. */
function seesAllLearningSubjects(user?: { is_super_admin?: boolean; user_type?: string } | null): boolean {
  return isAdminUser(user) || user?.user_type === 'host';
}

/** What a learner owns in Exam Preparation right now. `null` until = no end date. */
export interface OwnedExamPrep {
  wholeParts: Map<string, Date | null>;
  subjects: Map<string, Date | null>;
}

function later(a: Date | null | undefined, b: Date | null): Date | null {
  if (a === undefined) return b;
  if (a === null || b === null) return null;
  return a > b ? a : b;
}

export async function ownedExamPrep(
  userId: string,
  rows: PartRow[],
  _legacyPaid: boolean,
  now = new Date(),
): Promise<OwnedExamPrep> {
  const owned: OwnedExamPrep = { wholeParts: new Map(), subjects: new Map() };
  const primaryIds = rows.filter((r) => r.is_primary).map((r) => r.id);
  const ents = await UserEntitlement.find({
    user_id: userId,
    kind: 'exam_prep',
    is_revoked: false,
    starts_at: { $lte: now },
    ends_at: { $gt: now },
  })
    .select('exam_part_id exam_subject_id exam_subject_ids ends_at')
    .lean();
  for (const e of ents) {
    if (!e.exam_part_id) {
      for (const pid of primaryIds) owned.wholeParts.set(pid, later(owned.wholeParts.get(pid), e.ends_at));
    } else if (e.exam_subject_id || (e.exam_subject_ids ?? []).length > 0) {
      const ids = [...(e.exam_subject_ids ?? []).map(String), e.exam_subject_id ? String(e.exam_subject_id) : ''].filter(Boolean);
      for (const sid of ids) owned.subjects.set(sid, later(owned.subjects.get(sid), e.ends_at));
    } else {
      const pid = String(e.exam_part_id);
      owned.wholeParts.set(pid, later(owned.wholeParts.get(pid), e.ends_at));
    }
  }
  return owned;
}

const USER_FIELDS = 'user_type is_super_admin all_exam_subjects exam_subject_ids exam_prep_part_id amount_received';

type ScopeUser = {
  user_type?: string;
  is_super_admin?: boolean;
  all_exam_subjects?: boolean;
  exam_subject_ids?: unknown[];
  exam_prep_part_id?: unknown;
  amount_received?: number;
};

function selectedPart(rows: PartRow[], partId: unknown): PartRow | undefined {
  const id = partId ? String(partId) : '';
  return rows.find((r) => r.id === id) ?? rows.find((r) => r.is_primary) ?? rows[0];
}

const SCOPE_CACHE_MS = 20_000;
const scopeCache = new Map<string, { at: number; scope: ExamSubjectScope }>();

export function invalidateEnrolledScope(userId: string): void {
  scopeCache.delete(String(userId));
}

/**
 * Subjects on the learner's active Exam Preparation enrollments.
 * One indexed entitlement read; a whole part expands from the cached part list.
 * Content with no subject tag is not included.
 */
export async function enrolledSubjectScope(userId: string): Promise<ExamSubjectScope> {
  const hit = scopeCache.get(userId);
  if (hit && Date.now() - hit.at < SCOPE_CACHE_MS) return hit.scope;
  const now = new Date();
  const [user, ents] = await Promise.all([
    User.findById(userId).select('all_exam_subjects exam_subject_ids').lean<{
      all_exam_subjects?: boolean;
      exam_subject_ids?: unknown[];
    }>(),
    UserEntitlement.find({
      user_id: userId,
      kind: 'exam_prep',
      is_revoked: false,
      starts_at: { $lte: now },
      ends_at: { $gt: now },
    })
      .select('exam_part_id exam_subject_id exam_subject_ids')
      .lean(),
  ]);
  const ids = new Set<string>();
  const wholeParts = new Set<string>();
  let legacyPrimary = false;
  for (const e of ents) {
    const subjectIds = [...(e.exam_subject_ids ?? []).map(String), e.exam_subject_id ? String(e.exam_subject_id) : ''].filter(Boolean);
    if (subjectIds.length > 0) {
      for (const id of subjectIds) ids.add(id);
    } else if (e.exam_part_id) {
      wholeParts.add(String(e.exam_part_id));
    } else {
      legacyPrimary = true;
    }
  }
  if (wholeParts.size > 0 || legacyPrimary) {
    const rows = await loadExamPrepParts();
    for (const row of rows) {
      if (wholeParts.has(row.id) || (legacyPrimary && row.is_primary)) {
        for (const subject of row.subjects) ids.add(subject.id);
      }
    }
  }
  let list = [...ids];
  if (user?.all_exam_subjects === false) {
    const allow = new Set((user.exam_subject_ids ?? []).map(String));
    list = list.filter((id) => allow.has(id));
  }
  const scope: ExamSubjectScope = list.length === 0 ? { mode: 'none' } : { mode: 'subset', ids: list };
  scopeCache.set(userId, { at: Date.now(), scope });
  return scope;
}

/**
 * Subjects a learner may see in learning content: only the subjects they enrolled.
 * Admins and hosts see everything. The same scope is used by books, questions, papers and the rest.
 */
export async function getExamPrepScope(
  authUser: { id: string; is_super_admin?: boolean; user_type?: string } | null | undefined,
  _opts?: { paid?: boolean },
): Promise<ExamSubjectScope> {
  if (!authUser || seesAllLearningSubjects(authUser)) return { mode: 'all' };
  return enrolledSubjectScope(authUser.id);
}

function scopeKey(partId: string, scope: ExamSubjectScope): string {
  const raw =
    scope.mode === 'subset'
      ? `${partId}|subset|${[...scope.ids].sort().join(',')}|${scope.includeUntagged ? 1 : 0}`
      : `${partId}|${scope.mode}`;
  return crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16);
}

export async function listPartsForUser(authUser: {
  id: string;
  is_super_admin?: boolean;
  user_type?: string;
}): Promise<ExamPrepPartsResponse> {
  const rows = await loadExamPrepParts();
  const user = await User.findById(authUser.id).select(USER_FIELDS).lean<ScopeUser>();
  if (!user) throw notFound('User not found');
  const admin = isAdminUser(authUser) || isAdminUser(user);
  const openLearning = admin || seesAllLearningSubjects(authUser) || seesAllLearningSubjects(user);
  const part = selectedPart(rows, user.exam_prep_part_id);
  const owned = openLearning ? null : await ownedExamPrep(authUser.id, rows, Number(user.amount_received ?? 0) > 0);
  const iso = (d: Date | null | undefined) => (d ? d.toISOString() : undefined);
  const parts: ExamPrepPartOption[] = rows.map((r) => {
    const whole = openLearning || !!owned?.wholeParts.has(r.id);
    const wholeUntil = owned?.wholeParts.get(r.id);
    const subjects = r.subjects.map((s) => {
      const own = whole || !!owned?.subjects.has(s.id);
      const until = whole ? wholeUntil : owned?.subjects.get(s.id);
      return { ...s, owned: own, ...(own && until ? { owned_until: iso(until) } : {}) };
    });
    return {
      id: r.id,
      exam_name_id: r.exam_name_id,
      exam_name: r.exam_name,
      part_number: r.part_number,
      name: r.name,
      name_bn: r.name_bn,
      label: partLabel(r, rows),
      is_primary: r.is_primary,
      subjects,
      whole_part: whole,
      owned_count: subjects.filter((s) => s.owned).length,
    };
  });
  const scope = openLearning ? ({ mode: 'all' } as const) : await enrolledSubjectScope(authUser.id);
  return {
    parts,
    selected_part_id: part?.id ?? null,
    scope_key: scopeKey(part?.id ?? '-', scope),
    is_admin: admin,
  };
}

export async function selectPart(
  authUser: { id: string; is_super_admin?: boolean; user_type?: string },
  body: unknown,
): Promise<ExamPrepPartsResponse> {
  const parsed = selectExamPrepPartSchema.safeParse(body);
  if (!parsed.success) throw badRequest('Pick an exam part');
  const rows = await loadExamPrepParts();
  if (!rows.some((r) => r.id === parsed.data.exam_part_id)) throw notFound('Exam part not found');
  await User.updateOne({ _id: authUser.id }, { $set: { exam_prep_part_id: parsed.data.exam_part_id } });
  return listPartsForUser(authUser);
}
