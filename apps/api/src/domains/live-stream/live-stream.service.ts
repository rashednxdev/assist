import mongoose from 'mongoose';
import type {
  CreateLiveStreamDto,
  LivePermissionStatus,
  LiveStreamJoinPayload,
  LiveStreamListItem,
  UpdateLiveStreamDto,
} from '@ibas/shared-types';
import { LiveStream } from './models/LiveStream.model.js';
import { LiveStreamInvite } from './models/LiveStreamInvite.model.js';
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

async function permissionFor(
  sessionId: string,
  userId: string,
  hostUserId: string,
  user: { is_super_admin?: boolean; user_type?: string },
): Promise<{ permission_status: LivePermissionStatus; can_join: boolean }> {
  if (userId === hostUserId || isPlatformAdmin(user)) {
    return { permission_status: 'host', can_join: true };
  }
  const invite = await LiveStreamInvite.findOne({
    live_stream_id: sessionId,
    user_id: userId,
  }).lean();
  if (invite) return { permission_status: 'permitted', can_join: true };
  return { permission_status: 'not_permitted', can_join: false };
}

function serializeBase(doc: InstanceType<typeof LiveStream>) {
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
  };
}

export async function listLiveStreamsForUser(
  user: { id: string; is_super_admin?: boolean; user_type?: string },
): Promise<LiveStreamListItem[]> {
  const items = await LiveStream.find({
    is_active: true,
    status: { $in: ['scheduled', 'live', 'ended'] },
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
    result.push({
      id: String(doc._id),
      topic: doc.topic,
      details: doc.details || undefined,
      scheduled_at: doc.scheduled_at.toISOString(),
      status: doc.status,
      host_name: hostName.get(String(doc.host_user_id)),
      permission_status: perm.permission_status,
      can_join: perm.can_join && (doc.status === 'live' || doc.status === 'scheduled'),
      created_at: doc.created_at.toISOString(),
      updated_at: doc.updated_at.toISOString(),
    });
  }
  return result;
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
  return {
    ...serializeBase(doc),
    host_name: host ? host.full_name_bn?.trim() || host.full_name_en : undefined,
    invite_count: inviteCount,
    permission_status: perm.permission_status,
    can_join: perm.can_join && (doc.status === 'live' || doc.status === 'scheduled'),
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
    items: items.map((doc) => ({
      ...serializeBase(doc),
      invite_count: countMap.get(String(doc._id)) ?? 0,
      permission_status: 'host' as const,
      can_join: true,
    })),
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
  if (dto.status !== undefined) {
    doc.status = dto.status;
    if (dto.status === 'live' && !doc.started_at) doc.started_at = new Date();
    if ((dto.status === 'ended' || dto.status === 'cancelled') && !doc.ended_at) {
      doc.ended_at = new Date();
    }
  }
  await doc.save();
  return serializeBase(doc);
}

export async function softDeleteLiveStream(id: string) {
  const doc = await LiveStream.findOne({ _id: id, is_active: true });
  if (!doc) throw notFound('Live session not found');
  doc.is_active = false;
  if (doc.status === 'live') {
    doc.status = 'ended';
    doc.ended_at = new Date();
  }
  await doc.save();
  return { id: String(doc._id), deleted: true };
}

export async function startLiveStream(id: string) {
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

export async function joinLiveStream(
  id: string,
  user: { id: string; is_super_admin?: boolean; user_type?: string },
): Promise<LiveStreamJoinPayload> {
  const doc = await LiveStream.findOne({ _id: id, is_active: true });
  if (!doc) throw notFound('Live session not found');
  if (doc.status === 'cancelled') throw badRequest('This session was cancelled.');
  if (doc.status === 'ended') throw badRequest('This session has ended.');

  const perm = await permissionFor(String(doc._id), user.id, String(doc.host_user_id), user);
  if (!perm.can_join) {
    throw forbidden('You are not permitted to join this live session. Ask an admin for access.');
  }

  const role = perm.permission_status === 'host' ? 'host' : 'audience';
  const uid = agoraUidFromUserId(user.id);
  const { appId, token } = buildAgoraRtcToken({
    channel: doc.channel_name,
    uid,
    role,
  });

  return {
    app_id: appId,
    channel: doc.channel_name,
    token,
    uid,
    role,
    topic: doc.topic,
    status: doc.status,
  };
}
