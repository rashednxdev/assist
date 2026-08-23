import mongoose from 'mongoose';
import type {
  CreateLiveStreamDto,
  LivePermissionStatus,
  LiveStreamGuestItem,
  LiveStreamGuestMessageItem,
  LiveStreamJoinPayload,
  LiveStreamListItem,
  LiveStreamSlide,
  UpdateLiveStreamDto,
} from '@ibas/shared-types';
import { cleanLiveStreamSlides } from '@ibas/shared-types';
import { LiveStream } from './models/LiveStream.model.js';
import { LiveStreamInvite } from './models/LiveStreamInvite.model.js';
import { LiveStreamGuest } from './models/LiveStreamGuest.model.js';
import { LiveStreamGuestMessage } from './models/LiveStreamGuestMessage.model.js';
import { User } from '../users/models/User.model.js';
import { agoraUidFromUserId, buildAgoraRtcToken } from './agora-token.js';
import { badRequest, forbidden, notFound } from '../../shared/errors/AppError.js';

function isPlatformAdmin(user: { is_super_admin?: boolean; user_type?: string }) {
  return Boolean(
    user.is_super_admin || user.user_type === 'system_admin' || user.user_type === 'admin',
  );
}

function channelForId(id: string) {
  return `live_${id}`;
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

/** Invitees after class ends; admins/hosts anytime (including upcoming) for review. */
function canViewPresentation(
  doc: { status: string; scheduled_at: Date | string; host_user_id: unknown },
  user: { id: string; is_super_admin?: boolean; user_type?: string },
  permissionStatus: LivePermissionStatus,
): boolean {
  if (permissionStatus === 'not_permitted') return false;
  if (isPreviousClass(doc)) return true;
  if (isPlatformAdmin(user)) return true;
  if (user.id === String(doc.host_user_id)) return true;
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
  sessionId: string,
  userId: string,
  hostUserId: string,
  user: { is_super_admin?: boolean; user_type?: string },
): Promise<{ permission_status: LivePermissionStatus; can_join: boolean }> {
  if (userId === hostUserId) {
    return { permission_status: 'host', can_join: true };
  }
  const invite = await LiveStreamInvite.findOne({
    live_stream_id: sessionId,
    user_id: userId,
  }).lean();
  if (invite) return { permission_status: 'permitted', can_join: true };
  // Admins can always enter as audience (guest), never implied host from the app.
  if (isPlatformAdmin(user)) return { permission_status: 'permitted', can_join: true };
  return { permission_status: 'not_permitted', can_join: false };
}

function serializeBase(doc: InstanceType<typeof LiveStream>, includeSlides = true) {
  const slides = serializeSlides(doc.slides);
  return {
    id: String(doc._id),
    topic: doc.topic,
    details: doc.details || undefined,
    scheduled_at: doc.scheduled_at.toISOString(),
    status: doc.status,
    channel_name: doc.channel_name,
    host_user_id: String(doc.host_user_id),
    created_at: doc.created_at.toISOString(),
    updated_at: doc.updated_at.toISOString(),
    started_at: doc.started_at?.toISOString(),
    ended_at: doc.ended_at?.toISOString(),
    is_previous: isPreviousClass(doc),
    slide_count: slides.length,
    allow_guest_messages: Boolean(doc.allow_guest_messages),
    ...(includeSlides ? { slides } : {}),
  };
}

export async function listLiveStreamsForUser(
  user: { id: string; is_super_admin?: boolean; user_type?: string },
): Promise<LiveStreamListItem[]> {
  const items = await LiveStream.find({
    is_active: true,
    status: { $in: ['scheduled', 'live', 'paused', 'ended'] },
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

  const result: LiveStreamListItem[] = [];
  for (const doc of items) {
    const perm = await permissionFor(String(doc._id), user.id, String(doc.host_user_id), user);
    const previous = isPreviousClass(doc);
    const slides = serializeSlides(doc.slides);
    const viewPresentation = canViewPresentation(doc, user, perm.permission_status);
    result.push({
      id: String(doc._id),
      topic: doc.topic,
      details: doc.details || undefined,
      scheduled_at: doc.scheduled_at.toISOString(),
      status: doc.status,
      host_name: hostName.get(String(doc.host_user_id)),
      permission_status: perm.permission_status,
      can_join: perm.can_join && doc.status === 'live',
      is_previous: previous,
      slide_count: slides.length,
      allow_guest_messages: Boolean(doc.allow_guest_messages),
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
  const perm = await permissionFor(String(doc._id), user.id, String(doc.host_user_id), user);
  const inviteCount = await LiveStreamInvite.countDocuments({ live_stream_id: doc._id });
  const slides = serializeSlides(doc.slides);
  const viewPresentation = canViewPresentation(doc, user, perm.permission_status);
  return {
    ...serializeBase(doc, false),
    slides: viewPresentation ? slides : [],
    slide_count: slides.length,
    can_view_presentation: viewPresentation,
    host_name: host ? host.full_name_bn?.trim() || host.full_name_en : undefined,
    invite_count: inviteCount,
    permission_status: perm.permission_status,
    can_join: perm.can_join && doc.status === 'live',
  };
}

export async function listAdminLiveStreams(limit: number, skip: number) {
  const [total, items] = await Promise.all([
    LiveStream.countDocuments({ is_active: true }),
    LiveStream.find({ is_active: true }).sort({ scheduled_at: -1 }).skip(skip).limit(limit),
  ]);
  const ids = items.map((i) => i._id);
  const counts = await LiveStreamInvite.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: { live_stream_id: { $in: ids } } },
    { $group: { _id: '$live_stream_id', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
  return {
    total,
    items: sortByCurrentDateFirst(
      items.map((doc) => ({
        ...serializeBase(doc, false),
        invite_count: countMap.get(String(doc._id)) ?? 0,
        permission_status: 'host' as const,
        can_join: true,
        can_view_presentation: true,
      })),
    ),
  };
}

export async function createLiveStream(dto: CreateLiveStreamDto, actorId: string) {
  if (dto.scheduled_at.getTime() < Date.now() - 60_000) {
    throw badRequest('Scheduled time must be in the future (or within the last minute).');
  }
  const tempId = new mongoose.Types.ObjectId();
  const doc = await LiveStream.create({
    _id: tempId,
    topic: dto.topic,
    details: dto.details,
    scheduled_at: dto.scheduled_at,
    status: 'scheduled',
    channel_name: channelForId(String(tempId)),
    host_user_id: actorId,
    created_by: actorId,
    is_active: true,
    slides: dto.slides ? serializeSlides(dto.slides) : [],
  });

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
  if (dto.slides !== undefined) doc.slides = serializeSlides(dto.slides);
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

  const perm = await permissionFor(String(doc._id), user.id, String(doc.host_user_id), user);
  if (!perm.can_join) {
    throw forbidden('You are not permitted to join this live session. Ask an admin for access.');
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

  const uid = agoraUidFromUserId(user.id);
  const { appId, token } = buildAgoraRtcToken({
    channel: doc.channel_name,
    uid,
    role,
  });

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

  return {
    app_id: appId,
    channel: doc.channel_name,
    token,
    uid,
    role,
    topic: doc.topic,
    status: doc.status,
    allow_guest_messages: Boolean(doc.allow_guest_messages),
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

  const perm = await permissionFor(String(doc._id), user.id, String(doc.host_user_id), user);
  if (!perm.can_join) {
    throw forbidden('You are not permitted to message in this live session.');
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
