import mongoose from 'mongoose';
import type {
  CreateLiveStreamDto,
  LiveClassAccessType,
  LivePermissionStatus,
  LiveStreamGuestItem,
  LiveStreamGuestMessageItem,
  LiveStreamJoinPayload,
  LiveStreamListItem,
  LiveStreamSlide,
  LiveVideoPlatform,
  UpdateLiveStreamDto,
} from '@ibas/shared-types';
import { cleanLiveStreamSlides, PAID_LIVE_CLASS_UNPAID_MESSAGE, cleanLiveStreamRecordedContents, normalizeLiveStreamPresentations, flattenLiveStreamSlides } from '@ibas/shared-types';
import { LiveStream } from './models/LiveStream.model.js';
import { LiveStreamInvite } from './models/LiveStreamInvite.model.js';
import { LiveStreamGuest } from './models/LiveStreamGuest.model.js';
import { LiveStreamGuestMessage } from './models/LiveStreamGuestMessage.model.js';
import { User } from '../users/models/User.model.js';
import { agoraUidFromUserId, buildAgoraRtcToken } from './agora-token.js';
import {
  buildZoomSdkSignature,
  buildZoomWebClientUrl,
  createZoomMeeting,
  ensureZoomCloudRecording,
  ensureZoomFocusMode,
  fetchZoomZakToken,
  updateZoomGuestUnmuteAllowed,
  zoomConfigured,
} from './zoom-meeting.js';
import { badRequest, forbidden, notFound } from '../../shared/errors/AppError.js';

function isPlatformAdmin(user: { is_super_admin?: boolean; user_type?: string }) {
  return Boolean(
    user.is_super_admin || user.user_type === 'system_admin' || user.user_type === 'admin',
  );
}

function isPaidClass(doc: { access_type?: string }) {
  return doc.access_type === 'paid';
}

async function userHasPaid(user: { id: string; is_super_admin?: boolean; user_type?: string }) {
  if (isPlatformAdmin(user)) return true;
  const u = await User.findById(user.id).select('amount_received');
  return Number(u?.amount_received ?? 0) > 0;
}

function paymentAccessFor(
  doc: { access_type?: string; host_user_id: unknown },
  user: { id: string; is_super_admin?: boolean; user_type?: string },
  hasPaid: boolean,
) {
  if (!isPaidClass(doc)) return { payment_blocked: false as const };
  if (isPlatformAdmin(user)) return { payment_blocked: false as const };
  if (user.id === String(doc.host_user_id)) return { payment_blocked: false as const };
  if (hasPaid) return { payment_blocked: false as const };
  return {
    payment_blocked: true as const,
    payment_required_message: PAID_LIVE_CLASS_UNPAID_MESSAGE,
  };
}

function channelForId(id: string) {
  return `live_${id}`;
}

function videoPlatformOf(doc: { video_platform?: string }): LiveVideoPlatform {
  return doc.video_platform === 'zoom' ? 'zoom' : 'agora';
}

export function liveStreamPlatformFilter(platform?: string) {
  if (platform === 'zoom') return { video_platform: 'zoom' as const };
  if (platform === 'agora') {
    return { $or: [{ video_platform: 'agora' }, { video_platform: { $exists: false } }] };
  }
  return {};
}

async function ensureZoomMeeting(doc: InstanceType<typeof LiveStream>) {
  if (!zoomConfigured()) {
    throw badRequest('Zoom is not configured on the server. Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET.');
  }
  if (doc.zoom_meeting_number) return;
  const meeting = await createZoomMeeting({
    topic: doc.topic,
    startTime: doc.scheduled_at,
    autoRecordCloud: Boolean(doc.auto_record_cloud),
  });
  doc.zoom_meeting_id = meeting.meeting_id;
  doc.zoom_meeting_number = meeting.meeting_number;
  doc.zoom_password = meeting.password;
  doc.zoom_join_url = meeting.join_url;
  await doc.save();
}

function serializeRecordedContents(
  items:
    | Array<{
        title?: string;
        source?: 'youtube' | 'zoom';
        url?: string;
        youtube_url?: string;
        passcode?: string;
      }>
    | undefined
    | null,
): Array<{
  title: string;
  source?: 'youtube' | 'zoom';
  url: string;
  youtube_url: string;
  passcode?: string;
}> {
  return cleanLiveStreamRecordedContents(
    (items ?? []).map((i) => ({
      title: i.title ?? '',
      source: i.source,
      url: i.url ?? i.youtube_url ?? '',
      youtube_url: i.youtube_url ?? i.url ?? '',
      passcode: i.passcode,
    })),
  ).map((item) => {
    const url = (item.url ?? item.youtube_url ?? '').trim();
    return {
      title: item.title,
      source: item.source,
      url,
      youtube_url: url,
      ...(item.passcode ? { passcode: item.passcode } : {}),
    };
  });
}

function startOfTodayMs() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}

/** Ended/cancelled or scheduled before today → previous class. */
export function isPreviousClass(doc: {
  status: string;
  scheduled_at: Date | string;
}): boolean {
  if (doc.status === 'ended' || doc.status === 'cancelled') return true;
  return new Date(doc.scheduled_at).getTime() < startOfTodayMs();
}

/**
 * Previous-class recordings/presentations:
 * - Admins/hosts anytime
 * - Paid users without invite
 * - Invitees (unpaid) on free previous classes
 */
function canViewPresentation(
  doc: { status: string; scheduled_at: Date | string; host_user_id: unknown },
  user: { id: string; is_super_admin?: boolean; user_type?: string },
  permissionStatus: LivePermissionStatus,
  hasPaid: boolean,
): boolean {
  if (isPlatformAdmin(user)) return true;
  if (user.id === String(doc.host_user_id)) return true;
  if (isPreviousClass(doc) && hasPaid) return true;
  if (permissionStatus === 'not_permitted') return false;
  if (isPreviousClass(doc)) return true;
  return false;
}

function serializeSlides(
  slides: Array<{
    title?: string;
    context?: string;
    table?: LiveStreamSlide['table'];
    process?: LiveStreamSlide['process'];
  }> | undefined,
): LiveStreamSlide[] {
  return cleanLiveStreamSlides(
    (slides ?? []).map((s) => ({
      title: String(s.title ?? ''),
      context: String(s.context ?? ''),
      table: s.table,
      process: s.process,
    })),
  );
}

function serializePresentations(doc: {
  presentations?: Array<{ title?: string; slides?: unknown[] }>;
  slides?: unknown[];
}) {
  return normalizeLiveStreamPresentations({
    presentations: (doc.presentations ?? []).map((p) => ({
      title: String(p.title ?? ''),
      slides: serializeSlides(p.slides as Parameters<typeof serializeSlides>[0]),
    })),
    slides: serializeSlides(doc.slides as Parameters<typeof serializeSlides>[0]),
  });
}

function applyPresentationsToDoc(
  doc: InstanceType<typeof LiveStream>,
  presentationsInput?: Array<{ title?: string; slides?: unknown[] }> | null,
  slidesInput?: unknown[] | null,
) {
  const presentations = normalizeLiveStreamPresentations({
    presentations: presentationsInput
      ? presentationsInput.map((p) => ({
          title: String(p.title ?? ''),
          slides: serializeSlides(p.slides as Parameters<typeof serializeSlides>[0]),
        }))
      : undefined,
    slides: slidesInput
      ? serializeSlides(slidesInput as Parameters<typeof serializeSlides>[0])
      : undefined,
  });
  doc.presentations = presentations;
  doc.slides = flattenLiveStreamSlides({ presentations });
}

/** Today first (by time), then upcoming, then past. */
function sortByCurrentDateFirst<T extends { scheduled_at: Date | string }>(items: T[]): T[] {
  const startMs = startOfTodayMs();
  const end = new Date(startMs);
  end.setDate(end.getDate() + 1);
  const endMs = end.getTime();

  const today: T[] = [];
  const future: T[] = [];
  const past: T[] = [];
  for (const item of items) {
    const t = new Date(item.scheduled_at).getTime();
    if (t >= startMs && t < endMs) today.push(item);
    else if (t >= endMs) future.push(item);
    else past.push(item);
  }
  const byAsc = (a: T, b: T) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
  const byDesc = (a: T, b: T) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime();
  today.sort(byAsc);
  future.sort(byAsc);
  past.sort(byDesc);
  return [...today, ...future, ...past];
}

async function permissionFor(
  doc: {
    _id: unknown;
    access_type?: string;
    host_user_id: unknown;
    status?: string;
    scheduled_at?: Date | string;
  },
  userId: string,
  user: { is_super_admin?: boolean; user_type?: string },
  hasPaid: boolean,
): Promise<{ permission_status: LivePermissionStatus; can_join: boolean; can_host: boolean }> {
  const sessionId = String(doc._id);
  const hostUserId = String(doc.host_user_id);
  const canHost = userId === hostUserId || isPlatformAdmin(user);
  if (userId === hostUserId) {
    return { permission_status: 'host', can_join: true, can_host: true };
  }
  if (isPlatformAdmin(user)) {
    return { permission_status: 'permitted', can_join: true, can_host: true };
  }
  // Paid users may join any paid live class without a per-class invite.
  if (isPaidClass(doc) && hasPaid) {
    return { permission_status: 'permitted', can_join: true, can_host: false };
  }
  // Paid users may open any previous class (recordings) without invite.
  if (
    hasPaid &&
    doc.status != null &&
    doc.scheduled_at != null &&
    isPreviousClass({ status: doc.status, scheduled_at: doc.scheduled_at })
  ) {
    return { permission_status: 'permitted', can_join: false, can_host: false };
  }
  const invite = await LiveStreamInvite.findOne({
    live_stream_id: sessionId,
    user_id: userId,
  }).lean();
  if (invite) return { permission_status: 'permitted', can_join: true, can_host: canHost };
  return { permission_status: 'not_permitted', can_join: false, can_host: false };
}

function liveClassAccessType(doc: { access_type?: string }): LiveClassAccessType {
  return doc.access_type === 'paid' ? 'paid' : 'free';
}

function serializeBase(doc: InstanceType<typeof LiveStream>, includeSlides = true) {
  const presentations = serializePresentations(doc);
  const slides = flattenLiveStreamSlides({ presentations });
  const recorded = serializeRecordedContents(doc.recorded_contents);
  return {
    id: String(doc._id),
    topic: doc.topic,
    details: doc.details || undefined,
    scheduled_at: doc.scheduled_at.toISOString(),
    status: doc.status,
    channel_name: doc.channel_name,
    video_platform: videoPlatformOf(doc),
    host_user_id: String(doc.host_user_id),
    created_at: doc.created_at.toISOString(),
    updated_at: doc.updated_at.toISOString(),
    started_at: doc.started_at?.toISOString(),
    ended_at: doc.ended_at?.toISOString(),
    is_previous: isPreviousClass(doc),
    slide_count: slides.length,
    presentation_count: presentations.length,
    allow_guest_messages: Boolean(doc.allow_guest_messages),
    allow_guest_speech: Boolean(doc.allow_guest_speech),
    access_type: liveClassAccessType(doc),
    auto_record_cloud: Boolean(doc.auto_record_cloud),
    recorded_content_count: recorded.length,
    ...(includeSlides
      ? { slides, presentations, recorded_contents: recorded }
      : {}),
  };
}

export async function listLiveStreamsForUser(
  user: { id: string; is_super_admin?: boolean; user_type?: string },
  opts?: { video_platform?: string },
): Promise<LiveStreamListItem[]> {
  const items = await LiveStream.find({
    is_active: true,
    status: { $in: ['scheduled', 'live', 'paused', 'ended'] },
    ...liveStreamPlatformFilter(opts?.video_platform),
  })
    .sort({ scheduled_at: -1 })
    .limit(100);

  const hostIds = [...new Set(items.map((i) => String(i.host_user_id)))];
  const hosts =
    hostIds.length > 0
      ? await User.find({ _id: { $in: hostIds } }).select('full_name_en full_name_bn')
      : [];
  const hostName = new Map(
    hosts.map((h) => [String(h._id), h.full_name_bn?.trim() || h.full_name_en]),
  );

  const hasPaid = await userHasPaid(user);
  const result: LiveStreamListItem[] = [];
  for (const doc of items) {
    const perm = await permissionFor(doc, user.id, user, hasPaid);
    const previous = isPreviousClass(doc);
    const presentations = serializePresentations(doc);
    const slides = flattenLiveStreamSlides({ presentations });
    const recorded = serializeRecordedContents(doc.recorded_contents);
    const payment = paymentAccessFor(doc, user, hasPaid);
    const viewPresentation =
      !payment.payment_blocked &&
      canViewPresentation(doc, user, perm.permission_status, hasPaid);
    result.push({
      id: String(doc._id),
      topic: doc.topic,
      details: doc.details || undefined,
      scheduled_at: doc.scheduled_at.toISOString(),
      status: doc.status,
      video_platform: videoPlatformOf(doc),
      host_user_id: String(doc.host_user_id),
      host_name: hostName.get(String(doc.host_user_id)),
      permission_status: perm.permission_status,
      can_join: perm.can_join && doc.status === 'live' && !payment.payment_blocked,
      can_host: perm.can_host,
      is_previous: previous,
      slide_count: slides.length,
      presentation_count: presentations.length,
      recorded_content_count: recorded.length,
      allow_guest_messages: Boolean(doc.allow_guest_messages),
      allow_guest_speech: Boolean(doc.allow_guest_speech),
      access_type: liveClassAccessType(doc),
      auto_record_cloud: Boolean(doc.auto_record_cloud),
      payment_blocked: payment.payment_blocked,
      ...(payment.payment_blocked
        ? { payment_required_message: payment.payment_required_message }
        : {}),
      can_view_presentation: viewPresentation,
      created_at: doc.created_at.toISOString(),
      updated_at: doc.updated_at.toISOString(),
    });
  }
  return sortByCurrentDateFirst(result);
}

export async function getLiveStreamForUser(
  id: string,
  user: { id: string; is_super_admin?: boolean; user_type?: string },
) {
  const doc = await LiveStream.findOne({ _id: id, is_active: true });
  if (!doc) throw notFound('Live session not found');
  const host = await User.findById(doc.host_user_id).select('full_name_en full_name_bn');
  const hasPaid = await userHasPaid(user);
  const perm = await permissionFor(doc, user.id, user, hasPaid);
  const inviteCount = await LiveStreamInvite.countDocuments({ live_stream_id: doc._id });
  const presentations = serializePresentations(doc);
  const slides = flattenLiveStreamSlides({ presentations });
  const recorded = serializeRecordedContents(doc.recorded_contents);
  const payment = paymentAccessFor(doc, user, hasPaid);
  const viewPresentation =
    !payment.payment_blocked &&
    canViewPresentation(doc, user, perm.permission_status, hasPaid);
  return {
    ...serializeBase(doc, false),
    slides: viewPresentation ? slides : [],
    presentations: viewPresentation ? presentations : [],
    slide_count: slides.length,
    presentation_count: presentations.length,
    recorded_contents: viewPresentation ? recorded : [],
    recorded_content_count: recorded.length,
    can_view_presentation: viewPresentation,
    host_name: host ? host.full_name_bn?.trim() || host.full_name_en : undefined,
    invite_count: inviteCount,
    permission_status: perm.permission_status,
    can_join: perm.can_join && doc.status === 'live' && !payment.payment_blocked,
    can_host: perm.can_host,
    payment_blocked: payment.payment_blocked,
    ...(payment.payment_blocked
      ? { payment_required_message: payment.payment_required_message }
      : {}),
  };
}

export async function listAdminLiveStreams(limit: number, skip: number, opts?: { video_platform?: string }) {
  const filter = { is_active: true, ...liveStreamPlatformFilter(opts?.video_platform) };
  const [total, items] = await Promise.all([
    LiveStream.countDocuments(filter),
    LiveStream.find(filter).sort({ scheduled_at: -1 }).skip(skip).limit(limit),
  ]);
  const ids = items.map((i) => i._id);
  const counts = await LiveStreamInvite.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: { live_stream_id: { $in: ids } } },
    { $group: { _id: '$live_stream_id', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
  const hostIds = [...new Set(items.map((i) => String(i.host_user_id)))];
  const hosts =
    hostIds.length > 0
      ? await User.find({ _id: { $in: hostIds } }).select('full_name_en full_name_bn')
      : [];
  const hostName = new Map(
    hosts.map((h) => [String(h._id), h.full_name_bn?.trim() || h.full_name_en]),
  );
  return {
    total,
    items: sortByCurrentDateFirst(
      items.map((doc) => ({
        ...serializeBase(doc, false),
        host_name: hostName.get(String(doc.host_user_id)),
        invite_count: countMap.get(String(doc._id)) ?? 0,
        permission_status: 'host' as const,
        can_join: true,
        can_host: true,
        can_view_presentation: true,
      })),
    ),
  };
}

export async function listHostingLiveStreams(
  user: { id: string },
  opts?: { video_platform?: string },
): Promise<LiveStreamListItem[]> {
  const items = await LiveStream.find({
    is_active: true,
    host_user_id: user.id,
    status: { $in: ['scheduled', 'live', 'paused', 'ended'] },
    ...liveStreamPlatformFilter(opts?.video_platform),
  })
    .sort({ scheduled_at: -1 })
    .limit(100);

  const host = await User.findById(user.id).select('full_name_en full_name_bn');
  const hostName = host ? host.full_name_bn?.trim() || host.full_name_en : undefined;

  const result: LiveStreamListItem[] = items.map((doc) => {
    const presentations = serializePresentations(doc);
    const slides = flattenLiveStreamSlides({ presentations });
    const previous = isPreviousClass(doc);
    return {
      id: String(doc._id),
      topic: doc.topic,
      details: doc.details || undefined,
      scheduled_at: doc.scheduled_at.toISOString(),
      status: doc.status,
      video_platform: videoPlatformOf(doc),
      host_user_id: String(doc.host_user_id),
      host_name: hostName,
      permission_status: 'host' as const,
      can_join: doc.status === 'live',
      can_host: true,
      is_previous: previous,
      slide_count: slides.length,
      presentation_count: presentations.length,
      allow_guest_messages: Boolean(doc.allow_guest_messages),
      allow_guest_speech: Boolean(doc.allow_guest_speech),
      access_type: liveClassAccessType(doc),
      auto_record_cloud: Boolean(doc.auto_record_cloud),
      can_view_presentation: true,
      created_at: doc.created_at.toISOString(),
      updated_at: doc.updated_at.toISOString(),
    };
  });

  return sortByCurrentDateFirst(result);
}

export async function createLiveStream(dto: CreateLiveStreamDto, actorId: string) {
  if (dto.scheduled_at.getTime() < Date.now() - 60_000) {
    throw badRequest('Scheduled time must be in the future (or within the last minute).');
  }

  let hostUserId = actorId;
  if (dto.host_user_id) {
    const hostUser = await User.findOne({ _id: dto.host_user_id, status: 'active' }).select('_id');
    if (!hostUser) throw badRequest('Host user not found or inactive.');
    hostUserId = String(hostUser._id);
  }

  const tempId = new mongoose.Types.ObjectId();
  const platform = dto.video_platform === 'zoom' ? 'zoom' : 'agora';
  if (platform === 'zoom' && !zoomConfigured()) {
    throw badRequest('Zoom is not configured on the server. Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET.');
  }
  const presentations = normalizeLiveStreamPresentations({
    presentations: dto.presentations,
    slides: dto.slides,
  });
  const doc = await LiveStream.create({
    _id: tempId,
    topic: dto.topic,
    details: dto.details,
    scheduled_at: dto.scheduled_at,
    status: 'scheduled',
    channel_name: channelForId(String(tempId)),
    video_platform: platform,
    host_user_id: hostUserId,
    created_by: actorId,
    is_active: true,
    presentations,
    slides: flattenLiveStreamSlides({ presentations }),
    access_type: dto.access_type === 'paid' ? 'paid' : 'free',
    auto_record_cloud: platform === 'zoom' ? Boolean(dto.auto_record_cloud) : false,
    recorded_contents: dto.recorded_contents
      ? serializeRecordedContents(dto.recorded_contents)
      : [],
  });

  if (platform === 'zoom') {
    await ensureZoomMeeting(doc);
  }

  if (dto.invite_user_ids?.length) {
    await addInvites(String(doc._id), dto.invite_user_ids, actorId);
  }

  return getLiveStreamForUser(String(doc._id), {
    id: actorId,
    user_type: 'admin',
    is_super_admin: true,
  });
}

export async function updateLiveStream(id: string, dto: UpdateLiveStreamDto) {
  const doc = await LiveStream.findOne({ _id: id, is_active: true });
  if (!doc) throw notFound('Live session not found');
  if (dto.topic !== undefined) doc.topic = dto.topic;
  if (dto.details !== undefined) doc.details = dto.details ?? undefined;
  if (dto.scheduled_at !== undefined) doc.scheduled_at = dto.scheduled_at;
  if (dto.presentations !== undefined) {
    applyPresentationsToDoc(doc, dto.presentations, undefined);
  } else if (dto.slides !== undefined) {
    applyPresentationsToDoc(doc, undefined, dto.slides);
  }
  if (dto.recorded_contents !== undefined) {
    doc.recorded_contents = serializeRecordedContents(dto.recorded_contents);
  }
  if (dto.auto_record_cloud !== undefined && videoPlatformOf(doc) === 'zoom') {
    doc.auto_record_cloud = Boolean(dto.auto_record_cloud);
    if (doc.zoom_meeting_number) {
      await ensureZoomCloudRecording(doc.zoom_meeting_number, doc.auto_record_cloud);
    }
  }
  if (dto.host_user_id !== undefined) {
    const hostUser = await User.findOne({ _id: dto.host_user_id, status: 'active' }).select('_id');
    if (!hostUser) throw badRequest('Host user not found or inactive.');
    doc.host_user_id = hostUser._id as typeof doc.host_user_id;
  }
  if (dto.access_type !== undefined) {
    doc.access_type = dto.access_type === 'paid' ? 'paid' : 'free';
  }
  if (dto.status !== undefined) {
    doc.status = dto.status;
    if (dto.status === 'live') {
      if (!doc.started_at) doc.started_at = new Date();
      doc.set('ended_at', undefined);
    }
    if (dto.status === 'paused') {
      // keep started_at; do not set ended_at — session can resume
    }
    if ((dto.status === 'ended' || dto.status === 'cancelled') && !doc.ended_at) {
      doc.ended_at = new Date();
    }
  }
  await doc.save();
  return {
    ...serializeBase(doc, true),
    can_view_presentation: true,
  };
}

export async function softDeleteLiveStream(id: string) {
  const doc = await LiveStream.findOne({ _id: id, is_active: true });
  if (!doc) throw notFound('Live session not found');
  doc.is_active = false;
  if (doc.status === 'live' || doc.status === 'paused') {
    doc.status = 'ended';
    doc.ended_at = new Date();
  }
  await doc.save();
  return { id: String(doc._id), deleted: true };
}

export async function startLiveStream(id: string) {
  const doc = await LiveStream.findOne({ _id: id, is_active: true });
  if (!doc) throw notFound('Live session not found');
  if (videoPlatformOf(doc) === 'zoom') {
    await ensureZoomMeeting(doc);
    if (doc.zoom_meeting_number) {
      await ensureZoomFocusMode(doc.zoom_meeting_number);
      if (doc.auto_record_cloud) {
        await ensureZoomCloudRecording(doc.zoom_meeting_number, true);
      }
    }
  }
  return updateLiveStream(id, { status: 'live' });
}

export async function pauseLiveStream(id: string) {
  const doc = await LiveStream.findOne({ _id: id, is_active: true });
  if (!doc) throw notFound('Live session not found');
  if (doc.status !== 'live') throw badRequest('Only a live session can be paused.');
  return updateLiveStream(id, { status: 'paused' });
}

export async function resumeLiveStream(id: string) {
  const doc = await LiveStream.findOne({ _id: id, is_active: true });
  if (!doc) throw notFound('Live session not found');
  if (doc.status !== 'paused') throw badRequest('Only a paused session can be resumed.');
  return updateLiveStream(id, { status: 'live' });
}

/** Restart an ended class on the same session (no delete / recreate). */
export async function restartLiveStream(id: string) {
  const doc = await LiveStream.findOne({ _id: id, is_active: true });
  if (!doc) throw notFound('Live session not found');
  if (doc.status !== 'ended' && doc.status !== 'cancelled') {
    throw badRequest('Only an ended or cancelled session can be restarted.');
  }
  if (videoPlatformOf(doc) === 'zoom') {
    await ensureZoomMeeting(doc);
    if (doc.zoom_meeting_number) {
      await ensureZoomFocusMode(doc.zoom_meeting_number);
      if (doc.auto_record_cloud) {
        await ensureZoomCloudRecording(doc.zoom_meeting_number, true);
      }
    }
  }
  return updateLiveStream(id, { status: 'live' });
}

export async function endLiveStream(id: string) {
  return updateLiveStream(id, { status: 'ended' });
}

export async function listInvites(id: string) {
  const doc = await LiveStream.findOne({ _id: id, is_active: true });
  if (!doc) throw notFound('Live session not found');
  const invites = await LiveStreamInvite.find({ live_stream_id: doc._id }).sort({ created_at: -1 });
  const userIds = invites.map((i) => i.user_id);
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select('full_name_en full_name_bn email phone')
    : [];
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return invites.map((inv) => {
    const u = byId.get(String(inv.user_id));
    return {
      id: String(inv._id),
      user_id: String(inv.user_id),
      name: u ? u.full_name_bn?.trim() || u.full_name_en : 'Unknown',
      email: u?.email,
      phone: u?.phone,
      invited_at: inv.created_at.toISOString(),
    };
  });
}

export async function addInvites(sessionId: string, userIds: string[], actorId: string) {
  const doc = await LiveStream.findOne({ _id: sessionId, is_active: true });
  if (!doc) throw notFound('Live session not found');
  const unique = [...new Set(userIds)];
  const users = await User.find({ _id: { $in: unique }, status: 'active' }).select('_id');
  const valid = new Set(users.map((u) => String(u._id)));
  const ops = [...valid].map((userId) => ({
    updateOne: {
      filter: {
        live_stream_id: doc._id,
        user_id: new mongoose.Types.ObjectId(userId),
      },
      update: {
        $setOnInsert: {
          live_stream_id: doc._id,
          user_id: new mongoose.Types.ObjectId(userId),
          invited_by: new mongoose.Types.ObjectId(actorId),
        },
      },
      upsert: true,
    },
  }));
  if (ops.length) await LiveStreamInvite.bulkWrite(ops);
  return listInvites(sessionId);
}

export async function removeInvite(sessionId: string, userId: string) {
  const res = await LiveStreamInvite.deleteOne({ live_stream_id: sessionId, user_id: userId });
  if (res.deletedCount === 0) throw notFound('Invite not found');
  return { removed: true };
}

export async function revokeInvites(sessionId: string, userIds: string[]) {
  const doc = await LiveStream.findOne({ _id: sessionId, is_active: true });
  if (!doc) throw notFound('Live session not found');
  const unique = [...new Set(userIds)];
  const res = await LiveStreamInvite.deleteMany({
    live_stream_id: doc._id,
    user_id: { $in: unique },
  });
  return { removed: res.deletedCount ?? 0, invites: await listInvites(sessionId) };
}

export async function joinLiveStream(
  id: string,
  user: { id: string; is_super_admin?: boolean; user_type?: string },
  opts?: { as_host?: boolean },
): Promise<LiveStreamJoinPayload> {
  const doc = await LiveStream.findOne({ _id: id, is_active: true });
  if (!doc) throw notFound('Live session not found');
  if (doc.status === 'cancelled') throw badRequest('This session was cancelled.');
  if (doc.status === 'ended') throw badRequest('This session has ended. Ask an admin to restart it.');

  const hasPaid = await userHasPaid(user);
  const perm = await permissionFor(doc, user.id, user, hasPaid);
  if (!perm.can_join) {
    throw forbidden('You are not permitted to join this live session. Ask an admin for access.');
  }

  const payment = paymentAccessFor(doc, user, hasPaid);
  if (payment.payment_blocked) {
    throw forbidden(payment.payment_required_message ?? PAID_LIVE_CLASS_UNPAID_MESSAGE);
  }

  const wantsHost = Boolean(opts?.as_host);
  const mayHost = user.id === String(doc.host_user_id) || isPlatformAdmin(user);
  const role: 'host' | 'audience' = wantsHost && mayHost ? 'host' : 'audience';

  if (doc.status === 'paused' && role !== 'host') {
    throw badRequest('This live class is paused. Please wait for the host to resume.');
  }
  if (doc.status === 'scheduled' && role !== 'host') {
    throw badRequest('This live class has not started yet.');
  }

  await LiveStreamGuest.updateOne(
    {
      live_stream_id: doc._id,
      user_id: new mongoose.Types.ObjectId(user.id),
    },
    {
      $set: {
        role,
        last_seen_at: new Date(),
      },
      $setOnInsert: {
        live_stream_id: doc._id,
        user_id: new mongoose.Types.ObjectId(user.id),
        joined_at: new Date(),
      },
    },
    { upsert: true },
  );

  const platform = videoPlatformOf(doc);

  if (platform === 'zoom') {
    if (!doc.zoom_meeting_number) {
      throw badRequest('Zoom meeting is not ready yet. The host must start the class first.');
    }
    const userDoc = await User.findById(user.id).select('full_name_en full_name_bn email');
    const userName = userDoc?.full_name_bn?.trim() || userDoc?.full_name_en || 'Guest';
    let zak: string | undefined;
    if (role === 'host') {
      zak = await fetchZoomZakToken();
    }
    const password = doc.zoom_password ?? '';
    const webClientUrl = buildZoomWebClientUrl({
      meetingNumber: doc.zoom_meeting_number,
      password,
      role,
      zak,
      userName,
      userEmail: userDoc?.email,
    });
    const sdk = buildZoomSdkSignature(doc.zoom_meeting_number, role);
    return {
      video_platform: 'zoom',
      meeting_number: doc.zoom_meeting_number,
      password,
      web_client_url: webClientUrl,
      user_name: userName,
      user_email: userDoc?.email,
      zak,
      ...(sdk
        ? {
            signature: sdk.signature,
            sdk_key: sdk.sdk_key,
            signature_expires_at: sdk.expire_at,
          }
        : {}),
      role,
      topic: doc.topic,
      status: doc.status,
      allow_guest_messages: Boolean(doc.allow_guest_messages),
      allow_guest_speech: Boolean(doc.allow_guest_speech),
    };
  }

  const uid = agoraUidFromUserId(user.id);
  const { appId, token, expireAt } = buildAgoraRtcToken({
    channel: doc.channel_name,
    uid,
    role,
  });

  return {
    video_platform: 'agora',
    app_id: appId,
    channel: doc.channel_name,
    token,
    token_expires_at: expireAt,
    uid,
    role,
    topic: doc.topic,
    status: doc.status,
    allow_guest_messages: Boolean(doc.allow_guest_messages),
    allow_guest_speech: Boolean(doc.allow_guest_speech),
  };
}

export async function setGuestMessagesAllowed(
  id: string,
  allow: boolean,
): Promise<LiveStreamListItem> {
  const doc = await LiveStream.findOne({ _id: id, is_active: true });
  if (!doc) throw notFound('Live session not found');
  doc.allow_guest_messages = allow;
  await doc.save();
  return {
    ...serializeBase(doc, false),
    invite_count: await LiveStreamInvite.countDocuments({ live_stream_id: doc._id }),
    permission_status: 'host',
    can_join: true,
    can_host: true,
    can_view_presentation: true,
  };
}

export async function setGuestSpeechAllowed(
  id: string,
  allow: boolean,
): Promise<LiveStreamListItem> {
  const doc = await LiveStream.findOne({ _id: id, is_active: true });
  if (!doc) throw notFound('Live session not found');
  if (videoPlatformOf(doc) === 'zoom' && doc.zoom_meeting_number) {
    await updateZoomGuestUnmuteAllowed(doc.zoom_meeting_number, allow);
  }
  doc.allow_guest_speech = allow;
  await doc.save();
  return {
    ...serializeBase(doc, false),
    invite_count: await LiveStreamInvite.countDocuments({ live_stream_id: doc._id }),
    permission_status: 'host',
    can_join: true,
    can_host: true,
    can_view_presentation: true,
  };
}

export async function sendGuestMessage(
  id: string,
  user: { id: string; is_super_admin?: boolean; user_type?: string },
  body: string,
): Promise<LiveStreamGuestMessageItem> {
  const doc = await LiveStream.findOne({ _id: id, is_active: true });
  if (!doc) throw notFound('Live session not found');
  if (!doc.allow_guest_messages) {
    throw badRequest('The host is not accepting guest messages right now.');
  }
  if (doc.status !== 'live') {
    throw badRequest('You can only message the host while the class is live.');
  }

  const hasPaid = await userHasPaid(user);
  const perm = await permissionFor(doc, user.id, user, hasPaid);
  if (!perm.can_join) {
    throw forbidden('You are not permitted to message in this live session.');
  }
  const payment = paymentAccessFor(doc, user, hasPaid);
  if (payment.payment_blocked) {
    throw forbidden(payment.payment_required_message ?? PAID_LIVE_CLASS_UNPAID_MESSAGE);
  }
  if (user.id === String(doc.host_user_id)) {
    throw badRequest('Host cannot send guest messages to themselves.');
  }

  const text = body.trim();
  if (!text) throw badRequest('Message cannot be empty.');

  const recent = await LiveStreamGuestMessage.findOne({
    live_stream_id: doc._id,
    from_user_id: user.id,
  })
    .sort({ created_at: -1 })
    .lean();
  if (recent && Date.now() - new Date(recent.created_at).getTime() < 2000) {
    throw badRequest('Please wait a moment before sending another message.');
  }

  const msg = await LiveStreamGuestMessage.create({
    live_stream_id: doc._id,
    from_user_id: user.id,
    body: text.slice(0, 500),
    created_at: new Date(),
  });

  const from = await User.findById(user.id).select('full_name_en full_name_bn');
  return {
    id: String(msg._id),
    from_user_id: user.id,
    from_name: from ? from.full_name_bn?.trim() || from.full_name_en : 'Guest',
    body: msg.body,
    created_at: msg.created_at.toISOString(),
  };
}

export async function listGuestMessages(
  id: string,
  opts?: { after?: string; limit?: number },
): Promise<LiveStreamGuestMessageItem[]> {
  const doc = await LiveStream.findOne({ _id: id, is_active: true });
  if (!doc) throw notFound('Live session not found');

  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
  const filter: Record<string, unknown> = { live_stream_id: doc._id };
  if (opts?.after) {
    if (mongoose.isValidObjectId(opts.after)) {
      const afterDoc = await LiveStreamGuestMessage.findById(opts.after).lean();
      if (afterDoc) {
        filter.created_at = { $gt: afterDoc.created_at };
      }
    } else {
      const afterDate = new Date(opts.after);
      if (!Number.isNaN(afterDate.getTime())) {
        filter.created_at = { $gt: afterDate };
      }
    }
  }

  // Initial load: newest page (then chronological). Incremental poll: after cursor ascending.
  const messages = opts?.after
    ? await LiveStreamGuestMessage.find(filter).sort({ created_at: 1 }).limit(limit)
    : (
        await LiveStreamGuestMessage.find(filter).sort({ created_at: -1 }).limit(limit)
      ).reverse();

  const userIds = [...new Set(messages.map((m) => String(m.from_user_id)))];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select('full_name_en full_name_bn')
    : [];
  const byId = new Map(users.map((u) => [String(u._id), u]));

  return messages.map((m) => {
    const u = byId.get(String(m.from_user_id));
    return {
      id: String(m._id),
      from_user_id: String(m.from_user_id),
      from_name: u ? u.full_name_bn?.trim() || u.full_name_en : 'Guest',
      body: m.body,
      created_at: m.created_at.toISOString(),
    };
  });
}

export async function listGuests(id: string): Promise<LiveStreamGuestItem[]> {
  const doc = await LiveStream.findOne({ _id: id, is_active: true });
  if (!doc) throw notFound('Live session not found');
  const guests = await LiveStreamGuest.find({ live_stream_id: doc._id }).sort({ last_seen_at: -1 });
  const userIds = guests.map((g) => g.user_id);
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select('full_name_en full_name_bn email phone')
    : [];
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return guests.map((g) => {
    const u = byId.get(String(g.user_id));
    return {
      id: String(g._id),
      user_id: String(g.user_id),
      name: u ? u.full_name_bn?.trim() || u.full_name_en : 'Unknown',
      email: u?.email,
      phone: u?.phone,
      role: g.role,
      joined_at: g.joined_at.toISOString(),
      last_seen_at: g.last_seen_at.toISOString(),
    };
  });
}
