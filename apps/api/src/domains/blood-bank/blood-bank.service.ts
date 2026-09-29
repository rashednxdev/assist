import mongoose, { type FilterQuery, type PipelineStage, type Types } from 'mongoose';
import {
  BLOOD_GROUPS,
  bloodDonationInputSchema,
  bloodDonorQuerySchema,
  bloodProfileInputSchema,
  bloodRequestInputSchema,
  bloodRequestQuerySchema,
  bloodRequestStatusSchema,
  bloodRespondSchema,
  defaultNextEligible,
  donorGroupsFor,
  recipientGroupsOf,
  type BloodDonationRecord,
  type BloodDonorProfile,
  type BloodDonorRecord,
  type BloodGroup,
  type BloodMe,
  type BloodRequestRecord,
  type BloodRequestStatus,
  type BloodResponder,
  type BloodStats,
  type GeoOption,
} from '@ibas/shared-types';
import type { AuthUser } from '../../middleware/auth.js';
import { AppError, badRequest, forbidden, notFound } from '../../shared/errors/AppError.js';
import { logger } from '../../shared/logger.js';
import { User, type IBloodDonor } from '../users/models/User.model.js';
import { District } from '../setup/models/District.model.js';
import { Thana } from '../setup/models/Thana.model.js';
import { isAdminUser } from '../community/community.service.js';
import { workLabels } from '../org/org.service.js';
import { deliverSystemNotification } from '../notifications/notifications.service.js';
import { BloodDonation } from './models/BloodDonation.model.js';
import { BloodRequest, type IBloodRequest } from './models/BloodRequest.model.js';

export const BLOOD_GROUP_REQUIRED = 'BLOOD_GROUP_REQUIRED';

const DAY_MS = 86_400_000;
/** An open request stays listed until a day after it was needed. */
const REQUEST_GRACE_MS = DAY_MS;
const MAX_REQUEST_AHEAD_DAYS = 60;
const MAX_OPEN_REQUESTS = 5;
const MAX_NOTIFY_DONORS = 300;
const URGENCY_RANK = { critical: 0, urgent: 1, normal: 2 } as const;

function zodMessage(err: { issues: Array<{ path: PropertyKey[]; message: string }> }): string {
  return err.issues.map((i) => i.message).join('; ');
}

function oid(id: string, what: string): Types.ObjectId {
  if (!mongoose.isValidObjectId(id)) throw notFound(`${what} not found`);
  return new mongoose.Types.ObjectId(id);
}

function escapeRx(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function displayName(u: { full_name_en?: string; full_name_bn?: string } | null | undefined): string {
  return u?.full_name_en?.trim() || u?.full_name_bn?.trim() || 'Member';
}

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1]![0] : '')).toUpperCase() || '?';
}

function eligibleAt(next: Date | null | undefined, now: Date): boolean {
  return !next || next.getTime() <= now.getTime();
}

function daysUntil(next: Date | null | undefined, now: Date): number {
  if (!next || next.getTime() <= now.getTime()) return 0;
  return Math.ceil((next.getTime() - now.getTime()) / DAY_MS);
}

function ageFrom(dob: Date | null | undefined, now: Date): number | null {
  if (!dob) return null;
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** Mongo filter: eligible to donate now (never donated, or the gap has passed). */
function eligibleFilter(now: Date): FilterQuery<unknown> {
  return { $or: [{ 'blood_donor.next_eligible_date': null }, { 'blood_donor.next_eligible_date': { $lte: now } }] };
}

/* ----------------------------------- viewer ----------------------------------- */

interface Viewer {
  id: string;
  admin: boolean;
  group: BloodGroup | null;
  ready: boolean;
  donor: IBloodDonor | null;
  dob: Date | null;
}

async function loadViewer(user: AuthUser): Promise<Viewer> {
  const doc = await User.findById(user.id).select('blood_group blood_donor dob').lean();
  const admin = isAdminUser(user);
  const group = (doc?.blood_group as BloodGroup | null | undefined) ?? null;
  return { id: user.id, admin, group, ready: admin || !!group, donor: doc?.blood_donor ?? null, dob: doc?.dob ?? null };
}

async function readyViewer(user: AuthUser): Promise<Viewer> {
  const v = await loadViewer(user);
  if (!v.ready) throw new AppError(403, BLOOD_GROUP_REQUIRED, 'Add your blood group to open the blood bank.');
  return v;
}

async function geoNames(districtIds: unknown[], thanaIds: unknown[]) {
  const d = [...new Set(districtIds.filter(Boolean).map(String))];
  const t = [...new Set(thanaIds.filter(Boolean).map(String))];
  const [districts, thanas] = await Promise.all([
    d.length ? District.find({ _id: { $in: d } }).select('name_en').lean() : [],
    t.length ? Thana.find({ _id: { $in: t } }).select('name_en').lean() : [],
  ]);
  return {
    district: new Map(districts.map((x) => [String(x._id), x.name_en])),
    thana: new Map(thanas.map((x) => [String(x._id), x.name_en])),
  };
}

function emptyDonor(): IBloodDonor {
  return { is_donor: false, available: true, district_id: null, thana_id: null, area: '', show_phone: true, note: '', last_donation_date: null, next_eligible_date: null, donation_count: 0 };
}

async function donorProfileOut(d: IBloodDonor | null, now: Date): Promise<BloodDonorProfile> {
  const donor = d ?? emptyDonor();
  const names = await geoNames([donor.district_id], [donor.thana_id]);
  const did = donor.district_id ? String(donor.district_id) : '';
  const tid = donor.thana_id ? String(donor.thana_id) : '';
  return {
    is_donor: donor.is_donor,
    available: donor.available,
    district: did ? { id: did, name: names.district.get(did) ?? '' } : null,
    thana: tid ? { id: tid, name: names.thana.get(tid) ?? '' } : null,
    area: donor.area || undefined,
    show_phone: donor.show_phone,
    note: donor.note || undefined,
    last_donation_date: iso(donor.last_donation_date),
    next_eligible_date: iso(donor.next_eligible_date),
    eligible: eligibleAt(donor.next_eligible_date, now),
    days_until_eligible: daysUntil(donor.next_eligible_date, now),
    donation_count: donor.donation_count ?? 0,
  };
}

function openRequestFilter(now: Date): FilterQuery<IBloodRequest> {
  return { status: 'open', needed_on: { $gte: new Date(now.getTime() - REQUEST_GRACE_MS) } };
}

export async function getMe(user: AuthUser): Promise<BloodMe> {
  const v = await loadViewer(user);
  const now = new Date();
  const [donor, open] = await Promise.all([
    donorProfileOut(v.donor, now),
    BloodRequest.countDocuments({ requester_id: user.id, ...openRequestFilter(now) }),
  ]);
  return { ready: v.ready, is_admin: v.admin, blood_group: v.group, donor, age: ageFrom(v.dob, now), open_request_count: open };
}

async function assertPlace(districtId: string | null | undefined, thanaId: string | null | undefined) {
  if (!districtId) return;
  if (!(await District.exists({ _id: districtId, is_active: true }))) throw badRequest('Unknown district');
  if (thanaId && !(await Thana.exists({ _id: thanaId, district_id: districtId }))) throw badRequest('That thana is not in the chosen district');
}

export async function saveMe(user: AuthUser, body: unknown): Promise<BloodMe> {
  const parsed = bloodProfileInputSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const p = parsed.data;
  await assertPlace(p.district_id, p.thana_id);
  const v = await loadViewer(user);
  const cur = v.donor ?? emptyDonor();
  const donor: IBloodDonor = {
    ...cur,
    is_donor: p.is_donor,
    available: p.available,
    district_id: p.district_id ? new mongoose.Types.ObjectId(p.district_id) : null,
    thana_id: p.district_id && p.thana_id ? new mongoose.Types.ObjectId(p.thana_id) : null,
    area: p.area,
    show_phone: p.show_phone,
    note: p.note,
  };
  await User.updateOne({ _id: user.id }, { $set: { blood_group: p.blood_group, blood_donor: donor } });
  return getMe(user);
}

/* ---------------------------------- donations --------------------------------- */

function donationOut(d: { _id: unknown; donated_on: Date; next_eligible_on: Date; place?: string; note?: string; request_id?: unknown; created_at: Date }): BloodDonationRecord {
  return {
    id: String(d._id),
    donated_on: d.donated_on.toISOString(),
    next_eligible_on: d.next_eligible_on.toISOString(),
    place: d.place || undefined,
    note: d.note || undefined,
    request_id: d.request_id ? String(d.request_id) : undefined,
    created_at: d.created_at.toISOString(),
  };
}

/** Keeps the donor's last / next dates and count in step with the donation log. */
async function recomputeDonor(userId: string): Promise<void> {
  const [latest, furthest, count, doc] = await Promise.all([
    BloodDonation.findOne({ user_id: userId }).sort({ donated_on: -1 }).select('donated_on').lean(),
    BloodDonation.findOne({ user_id: userId }).sort({ next_eligible_on: -1 }).select('next_eligible_on').lean(),
    BloodDonation.countDocuments({ user_id: userId }),
    User.findById(userId).select('blood_donor').lean(),
  ]);
  const donor: IBloodDonor = {
    ...(doc?.blood_donor ?? emptyDonor()),
    last_donation_date: latest?.donated_on ?? null,
    next_eligible_date: furthest?.next_eligible_on ?? null,
    donation_count: count,
  };
  await User.updateOne({ _id: userId }, { $set: { blood_donor: donor } });
}

export async function listDonations(user: AuthUser): Promise<BloodDonationRecord[]> {
  await readyViewer(user);
  const rows = await BloodDonation.find({ user_id: user.id }).sort({ donated_on: -1 }).limit(200).lean();
  return rows.map(donationOut);
}

export async function addDonation(user: AuthUser, body: unknown): Promise<{ donation: BloodDonationRecord; me: BloodMe }> {
  const v = await readyViewer(user);
  if (!v.group) throw new AppError(403, BLOOD_GROUP_REQUIRED, 'Add your blood group first.');
  const parsed = bloodDonationInputSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const p = parsed.data;
  const day = new Date(Date.UTC(p.donated_on.getUTCFullYear(), p.donated_on.getUTCMonth(), p.donated_on.getUTCDate()));
  if (await BloodDonation.exists({ user_id: user.id, donated_on: day })) throw badRequest('You already recorded a donation on that date');
  let requestId: Types.ObjectId | null = null;
  if (p.request_id) {
    const req = await BloodRequest.findById(p.request_id).select('_id').lean();
    if (req) requestId = req._id as Types.ObjectId;
  }
  const doc = await BloodDonation.create({
    user_id: user.id,
    donated_on: day,
    next_eligible_on: p.next_eligible_on ?? defaultNextEligible(day),
    place: p.place,
    note: p.note,
    request_id: requestId,
  });
  await recomputeDonor(user.id);
  return { donation: donationOut(doc.toObject()), me: await getMe(user) };
}

export async function deleteDonation(user: AuthUser, id: string): Promise<BloodMe> {
  const res = await BloodDonation.deleteOne({ _id: oid(id, 'Donation'), user_id: user.id });
  if (res.deletedCount === 0) throw notFound('Donation not found');
  await recomputeDonor(user.id);
  return getMe(user);
}

/* ----------------------------------- donors ----------------------------------- */

interface DonorRow {
  _id: Types.ObjectId;
  full_name_en?: string;
  full_name_bn?: string;
  phone?: string;
  blood_group: BloodGroup;
  blood_donor: IBloodDonor;
}

async function toDonorRecords(rows: DonorRow[], v: Viewer, now: Date): Promise<BloodDonorRecord[]> {
  const [names, work] = await Promise.all([
    geoNames(
      rows.map((r) => r.blood_donor.district_id),
      rows.map((r) => r.blood_donor.thana_id),
    ),
    workLabels(rows.map((r) => String(r._id))),
  ]);
  return rows.map((r) => {
    const id = String(r._id);
    const d = r.blood_donor;
    const name = displayName(r);
    const w = work.get(id);
    const isMe = id === v.id;
    return {
      id,
      name,
      initials: initialsOf(name),
      blood_group: r.blood_group,
      designation: w?.designation_name,
      office: w ? w.office_short || w.office_name : undefined,
      district: d.district_id ? names.district.get(String(d.district_id)) : undefined,
      thana: d.thana_id ? names.thana.get(String(d.thana_id)) : undefined,
      area: d.area || undefined,
      phone: d.show_phone || isMe || v.admin ? r.phone : undefined,
      available: d.available,
      eligible: eligibleAt(d.next_eligible_date, now),
      days_until_eligible: daysUntil(d.next_eligible_date, now),
      last_donation_date: iso(d.last_donation_date),
      next_eligible_date: iso(d.next_eligible_date),
      donation_count: d.donation_count ?? 0,
      is_me: isMe,
    };
  });
}

export async function listDonors(user: AuthUser, query: unknown) {
  const v = await readyViewer(user);
  const parsed = bloodDonorQuerySchema.safeParse(query);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const q = parsed.data;
  const now = new Date();

  const groups: BloodGroup[] = q.group ? [q.group] : q.compatible_with ? donorGroupsFor(q.compatible_with) : [...BLOOD_GROUPS];
  const and: FilterQuery<unknown>[] = [{ status: 'active', 'blood_donor.is_donor': true, blood_group: { $in: groups } }];
  if (q.district_id) and.push({ 'blood_donor.district_id': new mongoose.Types.ObjectId(q.district_id) });
  if (q.thana_id) and.push({ 'blood_donor.thana_id': new mongoose.Types.ObjectId(q.thana_id) });
  if (q.eligible !== 'false') and.push({ 'blood_donor.available': true }, eligibleFilter(now));
  if (q.q) {
    const rx = new RegExp(escapeRx(q.q), 'i');
    and.push({ $or: [{ full_name_en: rx }, { full_name_bn: rx }, { 'blood_donor.area': rx }] });
  }

  const pipeline: PipelineStage[] = [
    { $match: { $and: and } },
    {
      $addFields: {
        _ready: {
          $cond: [
            {
              $and: [
                { $ne: ['$blood_donor.available', false] },
                { $or: [{ $eq: [{ $ifNull: ['$blood_donor.next_eligible_date', null] }, null] }, { $lte: ['$blood_donor.next_eligible_date', now] }] },
              ],
            },
            1,
            0,
          ],
        },
      },
    },
    { $sort: { _ready: -1, 'blood_donor.last_donation_date': 1, full_name_en: 1, _id: 1 } },
    {
      $facet: {
        items: [
          { $skip: (q.page - 1) * q.limit },
          { $limit: q.limit },
          { $project: { full_name_en: 1, full_name_bn: 1, phone: 1, blood_group: 1, blood_donor: 1 } },
        ],
        total: [{ $count: 'n' }],
      },
    },
  ];
  const [res] = await User.aggregate<{ items: DonorRow[]; total: Array<{ n: number }> }>(pipeline);
  return { items: await toDonorRecords(res?.items ?? [], v, now), total: res?.total[0]?.n ?? 0, page: q.page, limit: q.limit };
}

export async function getStats(user: AuthUser, query: { district_id?: unknown }): Promise<BloodStats> {
  await readyViewer(user);
  const now = new Date();
  const match: FilterQuery<unknown> = { status: 'active', 'blood_donor.is_donor': true, blood_group: { $in: [...BLOOD_GROUPS] } };
  const districtId = typeof query.district_id === 'string' && mongoose.isValidObjectId(query.district_id) ? query.district_id : '';
  if (districtId) match['blood_donor.district_id'] = new mongoose.Types.ObjectId(districtId);
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

  const [rows, open, donations] = await Promise.all([
    User.aggregate<{ _id: BloodGroup; donors: number; eligible: number }>([
      { $match: match },
      {
        $group: {
          _id: '$blood_group',
          donors: { $sum: 1 },
          eligible: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$blood_donor.available', false] },
                    { $or: [{ $eq: [{ $ifNull: ['$blood_donor.next_eligible_date', null] }, null] }, { $lte: ['$blood_donor.next_eligible_date', now] }] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    BloodRequest.countDocuments({ ...openRequestFilter(now), ...(districtId ? { district_id: districtId } : {}) }),
    BloodDonation.countDocuments({ donated_on: { $gte: startOfYear } }),
  ]);
  const by = new Map(rows.map((r) => [r._id, r]));
  const groups = BLOOD_GROUPS.map((g) => ({ group: g, donors: by.get(g)?.donors ?? 0, eligible: by.get(g)?.eligible ?? 0 }));
  return {
    groups,
    donors: groups.reduce((s, g) => s + g.donors, 0),
    eligible: groups.reduce((s, g) => s + g.eligible, 0),
    open_requests: open,
    donations_this_year: donations,
  };
}

/* ---------------------------------- requests ---------------------------------- */

function statusOf(r: Pick<IBloodRequest, 'status' | 'needed_on'>, now: Date): BloodRequestStatus {
  if (r.status === 'open' && r.needed_on.getTime() < now.getTime() - REQUEST_GRACE_MS) return 'expired';
  return r.status;
}

type RequestRow = Pick<
  IBloodRequest,
  | 'requester_id'
  | 'patient_name'
  | 'blood_group'
  | 'units'
  | 'hospital'
  | 'district_id'
  | 'thana_id'
  | 'address'
  | 'needed_on'
  | 'urgency'
  | 'contact_name'
  | 'contact_phone'
  | 'note'
  | 'status'
  | 'responses'
  | 'fulfilled_at'
  | 'created_at'
> & { _id: unknown };

async function toRequestRecords(rows: RequestRow[], v: Viewer, withResponders: boolean): Promise<BloodRequestRecord[]> {
  const now = new Date();
  const ownerView = (r: RequestRow) => withResponders && (v.admin || String(r.requester_id) === v.id);
  const responderIds = rows.filter(ownerView).flatMap((r) => r.responses.map((x) => String(x.user_id)));
  const userIds = [...new Set([...rows.map((r) => String(r.requester_id)), ...responderIds])];
  const [users, names, work] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select('full_name_en full_name_bn phone blood_group blood_donor.next_eligible_date').lean(),
    geoNames(
      rows.map((r) => r.district_id),
      rows.map((r) => r.thana_id),
    ),
    workLabels(responderIds),
  ]);
  const um = new Map(users.map((u) => [String(u._id), u]));

  return rows.map((r) => {
    const requesterId = String(r.requester_id);
    const did = String(r.district_id);
    const tid = r.thana_id ? String(r.thana_id) : '';
    let responders: BloodResponder[] | undefined;
    if (ownerView(r)) {
      responders = r.responses.map((x) => {
        const id = String(x.user_id);
        const u = um.get(id);
        const w = work.get(id);
        return {
          id,
          name: displayName(u),
          blood_group: (u?.blood_group as BloodGroup | null | undefined) ?? null,
          phone: u?.phone,
          designation: w?.designation_name,
          office: w ? w.office_short || w.office_name : undefined,
          eligible: eligibleAt(u?.blood_donor?.next_eligible_date, now),
          note: x.note || undefined,
          at: x.at.toISOString(),
        };
      });
    }
    return {
      id: String(r._id),
      requester: { id: requesterId, name: displayName(um.get(requesterId)) },
      patient_name: r.patient_name || undefined,
      blood_group: r.blood_group,
      units: r.units,
      hospital: r.hospital,
      district: { id: did, name: names.district.get(did) ?? '' },
      thana: tid ? { id: tid, name: names.thana.get(tid) ?? '' } : null,
      address: r.address || undefined,
      needed_on: r.needed_on.toISOString(),
      urgency: r.urgency,
      contact_name: r.contact_name,
      contact_phone: r.contact_phone,
      note: r.note || undefined,
      status: statusOf(r, now),
      response_count: r.responses.length,
      i_responded: r.responses.some((x) => String(x.user_id) === v.id),
      is_mine: requesterId === v.id,
      compatible: !!v.group && donorGroupsFor(r.blood_group).includes(v.group),
      responders,
      fulfilled_at: r.fulfilled_at ? r.fulfilled_at.toISOString() : undefined,
      created_at: r.created_at.toISOString(),
    };
  });
}

export async function listRequests(user: AuthUser, query: unknown) {
  const v = await readyViewer(user);
  const parsed = bloodRequestQuerySchema.safeParse(query);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const q = parsed.data;
  const now = new Date();
  const cutoff = new Date(now.getTime() - REQUEST_GRACE_MS);

  const and: FilterQuery<IBloodRequest>[] = [];
  if (q.scope === 'open') and.push(openRequestFilter(now));
  else if (q.scope === 'mine') and.push({ requester_id: new mongoose.Types.ObjectId(v.id) });
  else if (q.scope === 'responded') and.push({ 'responses.user_id': new mongoose.Types.ObjectId(v.id) });
  else and.push({ $or: [{ status: { $in: ['fulfilled', 'cancelled'] } }, { status: 'open', needed_on: { $lt: cutoff } }] });
  if (q.group) and.push({ blood_group: q.group });
  if (q.district_id) and.push({ district_id: new mongoose.Types.ObjectId(q.district_id) });
  if (q.can_help === 'true') {
    if (!v.group) return { items: [], total: 0, page: q.page, limit: q.limit };
    and.push({ blood_group: { $in: recipientGroupsOf(v.group) } });
  }

  const sort: Record<string, 1 | -1> = q.scope === 'open' ? { _rank: 1, needed_on: 1, _id: 1 } : { created_at: -1, _id: -1 };
  const [res] = await BloodRequest.aggregate<{ items: RequestRow[]; total: Array<{ n: number }> }>([
    { $match: and.length ? { $and: and } : {} },
    {
      $addFields: {
        _rank: { $switch: { branches: Object.entries(URGENCY_RANK).map(([k, n]) => ({ case: { $eq: ['$urgency', k] }, then: n })), default: 9 } },
      },
    },
    { $sort: sort },
    { $facet: { items: [{ $skip: (q.page - 1) * q.limit }, { $limit: q.limit }], total: [{ $count: 'n' }] } },
  ]);
  return {
    items: await toRequestRecords(res?.items ?? [], v, q.scope === 'mine'),
    total: res?.total[0]?.n ?? 0,
    page: q.page,
    limit: q.limit,
  };
}

async function loadRequest(id: string) {
  const doc = await BloodRequest.findById(oid(id, 'Request'));
  if (!doc) throw notFound('Request not found');
  return doc;
}

export async function getRequest(user: AuthUser, id: string): Promise<BloodRequestRecord> {
  const v = await readyViewer(user);
  const doc = await loadRequest(id);
  const [rec] = await toRequestRecords([doc.toObject()], v, true);
  return rec!;
}

function notifyInBackground(input: Omit<Parameters<typeof deliverSystemNotification>[0], 'source'>): void {
  if (input.userIds.length === 0) return;
  void deliverSystemNotification({ ...input, source: 'community' }).catch((err) => logger.warn({ err }, 'Blood bank notification failed'));
}

function shortDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dhaka' });
}

export async function createRequest(user: AuthUser, body: unknown): Promise<BloodRequestRecord> {
  const v = await readyViewer(user);
  const parsed = bloodRequestInputSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const p = parsed.data;
  const now = new Date();
  if (p.needed_on.getTime() < now.getTime() - REQUEST_GRACE_MS) throw badRequest('The needed date has already passed');
  if (p.needed_on.getTime() > now.getTime() + MAX_REQUEST_AHEAD_DAYS * DAY_MS) throw badRequest(`Requests can be posted up to ${MAX_REQUEST_AHEAD_DAYS} days ahead`);
  await assertPlace(p.district_id, p.thana_id);
  if (!v.admin && (await BloodRequest.countDocuments({ requester_id: user.id, ...openRequestFilter(now) })) >= MAX_OPEN_REQUESTS) {
    throw badRequest(`You already have ${MAX_OPEN_REQUESTS} open requests. Close one before posting another.`);
  }

  const doc = await BloodRequest.create({
    requester_id: user.id,
    patient_name: p.patient_name,
    blood_group: p.blood_group,
    units: p.units,
    hospital: p.hospital,
    district_id: p.district_id,
    thana_id: p.thana_id || null,
    address: p.address,
    needed_on: p.needed_on,
    urgency: p.urgency,
    contact_name: p.contact_name,
    contact_phone: p.contact_phone,
    note: p.note,
  });

  const donors = await User.find({
    _id: { $ne: new mongoose.Types.ObjectId(user.id) },
    status: 'active',
    'blood_donor.is_donor': true,
    'blood_donor.available': true,
    'blood_donor.district_id': new mongoose.Types.ObjectId(p.district_id),
    blood_group: { $in: donorGroupsFor(p.blood_group) },
    ...eligibleFilter(now),
  })
    .select('_id')
    .limit(MAX_NOTIFY_DONORS)
    .lean();
  const recipients = donors.map((d) => String(d._id));
  if (recipients.length) {
    await BloodRequest.updateOne({ _id: doc._id }, { $set: { notified_count: recipients.length } });
    const district = (await District.findById(p.district_id).select('name_en').lean())?.name_en ?? '';
    const prefix = p.urgency === 'critical' ? 'CRITICAL: ' : p.urgency === 'urgent' ? 'Urgent: ' : '';
    notifyInBackground({
      userIds: recipients,
      title: `${prefix}${p.blood_group} blood needed at ${p.hospital}`.slice(0, 200),
      message: `${p.units} bag${p.units > 1 ? 's' : ''} of ${p.blood_group} needed by ${shortDate(p.needed_on)} at ${p.hospital}${district ? `, ${district}` : ''}. Your blood group can help — tap to respond.`,
      createdBy: user.id,
      link: `/community/blood-bank/requests/${String(doc._id)}`,
      data: { type: 'blood_request', request_id: String(doc._id) },
    });
  }
  return getRequest(user, String(doc._id));
}

export async function respond(user: AuthUser, id: string, body: unknown): Promise<BloodRequestRecord> {
  const v = await readyViewer(user);
  const parsed = bloodRespondSchema.safeParse(body ?? {});
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const doc = await loadRequest(id);
  const now = new Date();
  const existing = doc.responses.find((r) => String(r.user_id) === v.id);

  if (existing) {
    await BloodRequest.updateOne({ _id: doc._id }, { $pull: { responses: { user_id: new mongoose.Types.ObjectId(v.id) } } });
    return getRequest(user, id);
  }

  if (statusOf(doc, now) !== 'open') throw badRequest('This request is no longer open');
  if (String(doc.requester_id) === v.id) throw badRequest('You posted this request');
  if (!v.group) throw new AppError(403, BLOOD_GROUP_REQUIRED, 'Add your blood group before offering to donate.');
  if (!donorGroupsFor(doc.blood_group).includes(v.group)) throw badRequest(`${v.group} blood can't be given to a ${doc.blood_group} patient`);
  if (!eligibleAt(v.donor?.next_eligible_date, now)) {
    throw badRequest(`You can donate again from ${shortDate(v.donor!.next_eligible_date!)}`);
  }

  await BloodRequest.updateOne(
    { _id: doc._id, 'responses.user_id': { $ne: new mongoose.Types.ObjectId(v.id) } },
    { $push: { responses: { user_id: v.id, note: parsed.data.note, at: now } } },
  );
  const me = await User.findById(v.id).select('full_name_en full_name_bn').lean();
  notifyInBackground({
    userIds: [String(doc.requester_id)],
    title: `${displayName(me)} (${v.group}) can donate`,
    message: `${displayName(me)} offered to donate for your ${doc.blood_group} request at ${doc.hospital}. Open the request to call them.`,
    createdBy: v.id,
    link: `/community/blood-bank/requests/${id}`,
    data: { type: 'blood_response', request_id: id },
  });
  return getRequest(user, id);
}

export async function setRequestStatus(user: AuthUser, id: string, body: unknown): Promise<BloodRequestRecord> {
  const v = await readyViewer(user);
  const parsed = bloodRequestStatusSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const doc = await loadRequest(id);
  if (!v.admin && String(doc.requester_id) !== v.id) throw forbidden('Only the person who posted this request can change it');
  const status = parsed.data.status;
  if (status === 'open' && doc.needed_on.getTime() < Date.now() - REQUEST_GRACE_MS) throw badRequest('The needed date has passed — post a new request instead');
  await BloodRequest.updateOne(
    { _id: doc._id },
    { $set: { status, fulfilled_at: status === 'fulfilled' ? new Date() : null, closed_by: status === 'open' ? null : v.id } },
  );
  return getRequest(user, id);
}

export async function deleteRequest(user: AuthUser, id: string): Promise<void> {
  const v = await readyViewer(user);
  const doc = await loadRequest(id);
  if (!v.admin && String(doc.requester_id) !== v.id) throw forbidden('Only the person who posted this request can delete it');
  await BloodRequest.deleteOne({ _id: doc._id });
}

/* ------------------------------------ places ----------------------------------- */

export async function listDistricts(): Promise<GeoOption[]> {
  const rows = await District.find({ is_active: true }).select('name_en name_bn').sort({ name_en: 1 }).lean();
  return rows.map((r) => ({ id: String(r._id), name: r.name_en, name_bn: r.name_bn || undefined }));
}

export async function listThanas(districtId: string): Promise<GeoOption[]> {
  const rows = await Thana.find({ district_id: oid(districtId, 'District'), is_active: true }).select('name_en name_bn').sort({ name_en: 1 }).lean();
  return rows.map((r) => ({ id: String(r._id), name: r.name_en, name_bn: r.name_bn || undefined }));
}
