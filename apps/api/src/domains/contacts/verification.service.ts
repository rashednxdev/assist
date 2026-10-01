import { randomInt } from 'node:crypto';
import mongoose from 'mongoose';
import {
  CONTACT_VERIFIER_GRADE_MAX,
  contactCodeSchema,
  contactVerificationAdminQuerySchema,
  type ContactPersonRef,
  type ContactVerificationAdminRow,
  type ContactVerificationCandidate,
  type ContactVerificationInfo,
  type ContactVerifiedRecord,
  type UserContactVerification,
} from '@ibas/shared-types';
import type { AuthUser } from '../../middleware/auth.js';
import { badRequest, forbidden, notFound } from '../../shared/errors/AppError.js';
import { logger } from '../../shared/logger.js';
import { User } from '../users/models/User.model.js';
import { AppSettings } from '../app-settings/models/AppSettings.model.js';
import { Designation } from '../org/models/Designation.model.js';
import { Office } from '../org/models/Office.model.js';
import { officeIndex, parentPath } from '../org/org.service.js';
import { isAdminUser } from '../community/community.service.js';
import { deliverSystemNotification } from '../notifications/notifications.service.js';
import { ContactVerification, type IContactVerification, type IVerificationSnapshot } from './models/ContactVerification.model.js';

const CODE_ATTEMPTS = 6;

function zodMessage(err: { issues: Array<{ message: string }> }): string {
  return err.issues.map((i) => i.message).join('; ');
}

function escapeRx(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function newCode(): string {
  return String(randomInt(0, 100_000_000)).padStart(8, '0');
}

function isDuplicateKey(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

/* ---------------------------------- seeding --------------------------------- */

/**
 * One-time: everyone who already had an office + designation when verification launched counts as
 * verified ("legacy"), so there are verifiers from day one.
 */
export async function seedLegacyContactVerifications(): Promise<void> {
  const settings = await AppSettings.findOne({ key: 'global' }).select('contact_verification_seeded_at').lean();
  if (settings?.contact_verification_seeded_at) return;
  const users = await User.find({ office_id: { $ne: null }, designation_id: { $ne: null } }).select('_id').lean();
  const now = new Date();
  for (let i = 0; i < users.length; i += 1000) {
    const chunk = users.slice(i, i + 1000);
    await ContactVerification.bulkWrite(
      chunk.map((u) => ({
        updateOne: {
          filter: { user_id: u._id },
          update: { $setOnInsert: { user_id: u._id, status: 'legacy', code: null, verified_at: now } },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }
  await AppSettings.updateOne(
    { key: 'global' },
    { $set: { contact_verification_seeded_at: now }, $setOnInsert: { unpaid_message: '', updated_at: now } },
    { upsert: true },
  );
  logger.info({ users: users.length }, 'Contact verification: existing office holders marked verified');
}

/* ---------------------------------- people ---------------------------------- */

interface PersonInfo extends ContactPersonRef {
  office_id?: string;
  phone?: string;
  section?: string;
}

async function peopleById(ids: Array<string | mongoose.Types.ObjectId>): Promise<Map<string, PersonInfo>> {
  const unique = [...new Set(ids.map(String))].filter((id) => mongoose.isValidObjectId(id));
  const out = new Map<string, PersonInfo>();
  if (unique.length === 0) return out;
  const users = await User.find({ _id: { $in: unique } })
    .select('full_name_en full_name_bn phone office_id designation_id work_section')
    .lean();
  const [offices, designations] = await Promise.all([
    Office.find({ _id: { $in: users.map((u) => u.office_id).filter(Boolean) } }).select('name short_name').lean(),
    Designation.find({ _id: { $in: users.map((u) => u.designation_id).filter(Boolean) } }).select('name grade').lean(),
  ]);
  const om = new Map(offices.map((o) => [String(o._id), o]));
  const dm = new Map(designations.map((d) => [String(d._id), d]));
  for (const u of users) {
    const o = u.office_id ? om.get(String(u.office_id)) : undefined;
    const d = u.designation_id ? dm.get(String(u.designation_id)) : undefined;
    out.set(String(u._id), {
      id: String(u._id),
      name: u.full_name_en?.trim() || u.full_name_bn?.trim() || 'Member',
      designation: d?.name,
      office: o ? o.short_name || o.name : undefined,
      grade: d?.grade ?? null,
      office_id: u.office_id ? String(u.office_id) : undefined,
      phone: u.phone,
      section: u.work_section || undefined,
    });
  }
  return out;
}

function ref(p: PersonInfo | undefined, snap?: IVerificationSnapshot | null): ContactPersonRef | null {
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    designation: snap?.designation_name ?? p.designation,
    office: snap?.office_name ?? p.office,
    grade: snap?.grade ?? p.grade ?? null,
  };
}

function snapshotOf(p: PersonInfo | undefined): IVerificationSnapshot {
  return { office_name: p?.office, designation_name: p?.designation, grade: p?.grade ?? null };
}

function maskPhone(raw?: string): string | undefined {
  const digits = raw?.replace(/\D/g, '') ?? '';
  if (digits.length < 6) return undefined;
  return `${digits.slice(0, 3)}${'•'.repeat(digits.length - 5)}${digits.slice(-2)}`;
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('') || '?'
  );
}

/* ------------------------------- own verification ---------------------------- */

async function issueCode(userId: string): Promise<IContactVerification> {
  for (let i = 0; i < CODE_ATTEMPTS; i++) {
    try {
      const doc = await ContactVerification.findOneAndUpdate(
        { user_id: userId, status: 'pending' },
        { $set: { code: newCode(), code_issued_at: new Date() }, $setOnInsert: { user_id: userId, status: 'pending' } },
        { upsert: true, new: true },
      );
      return doc!;
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
      const existing = await ContactVerification.findOne({ user_id: userId });
      if (existing && existing.status !== 'pending') return existing;
    }
  }
  throw new Error('Could not issue a contact verification code');
}

/** The user's verification, creating a pending one with a code once office + designation are set. */
export async function ensureVerification(userId: string, hasWork: boolean): Promise<IContactVerification | null> {
  const doc = await ContactVerification.findOne({ user_id: userId });
  if (doc && (doc.status !== 'pending' || doc.code)) return doc;
  if (!hasWork) return doc;
  return issueCode(userId);
}

export function isVerified(doc: IContactVerification | null): boolean {
  return doc?.status === 'verified' || doc?.status === 'legacy';
}

export async function verificationInfo(doc: IContactVerification | null): Promise<ContactVerificationInfo | null> {
  if (!doc) return null;
  if (doc.status === 'pending') return { status: 'pending', code: doc.code ?? undefined };
  const people = doc.verified_by ? await peopleById([doc.verified_by]) : new Map<string, PersonInfo>();
  return {
    status: doc.status,
    verified_at: doc.verified_at?.toISOString(),
    verified_by: doc.verified_by ? ref(people.get(String(doc.verified_by)), doc.verifier_snapshot) : null,
  };
}

export async function regenerateCode(user: AuthUser): Promise<ContactVerificationInfo> {
  const doc = await ContactVerification.findOne({ user_id: user.id }).select('status').lean();
  if (doc && doc.status !== 'pending') throw badRequest('You are already verified');
  const snap = await User.findById(user.id).select('office_id designation_id').lean();
  if (!snap?.office_id || !snap.designation_id) throw badRequest('Add your office and designation first');
  return (await verificationInfo(await issueCode(user.id)))!;
}

/* ---------------------------------- verifier -------------------------------- */

/** Verified (or legacy) users on a grade 1–11 designation may verify colleagues; admins always may. */
export async function canVerify(user: AuthUser, own?: IContactVerification | null): Promise<boolean> {
  if (isAdminUser(user)) return true;
  const doc = own === undefined ? await ContactVerification.findOne({ user_id: user.id }).select('status').lean() : own;
  if (!(doc?.status === 'verified' || doc?.status === 'legacy')) return false;
  const u = await User.findById(user.id).select('designation_id').lean();
  if (!u?.designation_id) return false;
  const d = await Designation.findById(u.designation_id).select('grade').lean();
  return !!d?.grade && d.grade >= 1 && d.grade <= CONTACT_VERIFIER_GRADE_MAX;
}

async function assertVerifier(user: AuthUser): Promise<void> {
  if (!(await canVerify(user))) {
    throw forbidden(`Only verified officers of grade 1–${CONTACT_VERIFIER_GRADE_MAX} can verify colleagues.`);
  }
}

function parseCode(raw: unknown): string {
  const parsed = contactCodeSchema.safeParse(typeof raw === 'string' ? { code: raw } : raw);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  return parsed.data.code;
}

export async function lookupCode(user: AuthUser, rawCode: unknown): Promise<ContactVerificationCandidate> {
  await assertVerifier(user);
  const code = parseCode(rawCode);
  const doc = await ContactVerification.findOne({ code, status: 'pending' }).lean();
  if (!doc) throw notFound('No pending request uses this code. Ask your colleague to check it.');
  if (String(doc.user_id) === user.id) throw badRequest('You cannot verify yourself');
  const [people, map] = await Promise.all([peopleById([doc.user_id]), officeIndex()]);
  const p = people.get(String(doc.user_id));
  if (!p) throw notFound('This user no longer exists');
  const o = p.office_id ? map.get(p.office_id) : undefined;
  return {
    code,
    requested_at: (doc.code_issued_at ?? doc.created_at).toISOString(),
    person: {
      id: p.id,
      name: p.name,
      initials: initialsOf(p.name),
      phone_masked: maskPhone(p.phone),
      designation: p.designation ? { name: p.designation, grade: p.grade ?? null } : undefined,
      office: o ? { name: o.name, parent_path: parentPath(map, o.parent_id) } : undefined,
      section: p.section,
    },
  };
}

export async function verifyCode(user: AuthUser, body: unknown): Promise<ContactVerifiedRecord> {
  await assertVerifier(user);
  const code = parseCode(body);
  const pending = await ContactVerification.findOne({ code, status: 'pending' }).select('user_id').lean();
  if (!pending) throw notFound('No pending request uses this code. Ask your colleague to check it.');
  if (String(pending.user_id) === user.id) throw badRequest('You cannot verify yourself');
  const people = await peopleById([user.id, pending.user_id]);
  const me = people.get(user.id);
  const subject = people.get(String(pending.user_id));
  const now = new Date();
  const doc = await ContactVerification.findOneAndUpdate(
    { _id: pending._id, status: 'pending', code },
    {
      $set: {
        status: 'verified',
        code: null,
        verified_by: new mongoose.Types.ObjectId(user.id),
        verified_at: now,
        verifier_snapshot: snapshotOf(me),
        subject_snapshot: snapshotOf(subject),
      },
    },
    { new: true },
  );
  if (!doc) throw notFound('This code was just used or changed. Ask your colleague for the new code.');

  void deliverSystemNotification({
    userIds: [String(doc.user_id)],
    title: 'Contacts unlocked',
    message: `${me?.name ?? 'A colleague'}${me?.designation ? `, ${me.designation}` : ''} verified you. The contact directory is now open.`,
    createdBy: user.id,
    link: '/contacts',
    source: 'community',
    data: { type: 'contact_verified' },
  }).catch((err) => logger.warn({ err }, 'Contact verification notification failed'));

  return { id: String(doc._id), person: ref(subject, doc.subject_snapshot)!, verifier: ref(me, doc.verifier_snapshot), verified_at: now.toISOString() };
}

export async function listGiven(user: AuthUser): Promise<ContactVerifiedRecord[]> {
  const docs = await ContactVerification.find({ verified_by: user.id, status: 'verified' }).sort({ verified_at: -1 }).limit(200).lean();
  const people = await peopleById(docs.map((d) => d.user_id));
  return docs.map((d) => ({
    id: String(d._id),
    person: ref(people.get(String(d.user_id)), d.subject_snapshot) ?? { id: String(d.user_id), name: 'Removed user' },
    verifier: null,
    verified_at: (d.verified_at ?? d.updated_at).toISOString(),
  }));
}

/* ----------------------------------- admin ---------------------------------- */

async function adminRows(docs: Array<Pick<IContactVerification, '_id' | 'user_id' | 'status' | 'code' | 'verified_at' | 'verified_by' | 'verifier_snapshot' | 'created_at'>>): Promise<ContactVerificationAdminRow[]> {
  const people = await peopleById([...docs.map((d) => d.user_id), ...docs.map((d) => d.verified_by).filter(Boolean) as mongoose.Types.ObjectId[]]);
  return docs.map((d) => {
    const u = people.get(String(d.user_id));
    return {
      id: String(d._id),
      user: { ...(ref(u) ?? { id: String(d.user_id), name: 'Removed user' }), phone: u?.phone },
      status: d.status,
      code: d.status === 'pending' ? d.code ?? undefined : undefined,
      verified_at: d.verified_at?.toISOString(),
      verifier: d.verified_by ? ref(people.get(String(d.verified_by)), d.verifier_snapshot) : null,
      created_at: d.created_at.toISOString(),
    };
  });
}

export async function adminListVerifications(query: unknown) {
  const parsed = contactVerificationAdminQuerySchema.safeParse(query);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const q = parsed.data;
  const filter: Record<string, unknown> = {};
  if (q.status) filter.status = q.status;
  if (q.verifier_id) filter.verified_by = new mongoose.Types.ObjectId(q.verifier_id);
  if (q.q) {
    const rx = new RegExp(escapeRx(q.q), 'i');
    const or: Record<string, unknown>[] = [{ full_name_en: rx }, { full_name_bn: rx }, { email: rx }];
    if (/\d{3,}/.test(q.q)) or.push({ phone: new RegExp(escapeRx(q.q.replace(/\D/g, ''))) });
    const users = await User.find({ $or: or }).select('_id').limit(500).lean();
    const ids = users.map((u) => u._id);
    filter.$or = [{ user_id: { $in: ids } }, { verified_by: { $in: ids } }, ...(/^\d{8}$/.test(q.q) ? [{ code: q.q }] : [])];
  }
  const [total, docs] = await Promise.all([
    ContactVerification.countDocuments(filter),
    ContactVerification.find(filter)
      .sort({ verified_at: -1, updated_at: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean(),
  ]);
  return { items: await adminRows(docs), total, page: q.page, limit: q.limit };
}

export async function adminUserVerification(userId: string): Promise<UserContactVerification> {
  if (!mongoose.isValidObjectId(userId)) throw notFound('User not found');
  const [own, given] = await Promise.all([
    ContactVerification.findOne({ user_id: userId }).lean(),
    ContactVerification.find({ verified_by: userId, status: 'verified' }).sort({ verified_at: -1 }).limit(500).lean(),
  ]);
  const [ownRow] = own ? await adminRows([own]) : [];
  const people = await peopleById(given.map((d) => d.user_id));
  return {
    verification: ownRow ?? null,
    verified_users: given.map((d) => ({
      id: String(d._id),
      person: ref(people.get(String(d.user_id)), d.subject_snapshot) ?? { id: String(d.user_id), name: 'Removed user' },
      verifier: null,
      verified_at: (d.verified_at ?? d.updated_at).toISOString(),
    })),
  };
}

/** Sends the user back to step 2 with a fresh code (e.g. verified by mistake). */
export async function adminRevokeVerification(userId: string): Promise<UserContactVerification> {
  if (!mongoose.isValidObjectId(userId)) throw notFound('User not found');
  const exists = await User.exists({ _id: userId });
  if (!exists) throw notFound('User not found');
  await ContactVerification.updateOne(
    { user_id: userId },
    { $set: { status: 'pending', code: null, verified_by: null, verified_at: null, verifier_snapshot: null, subject_snapshot: null } },
    { upsert: true },
  );
  await issueCode(userId);
  return adminUserVerification(userId);
}
