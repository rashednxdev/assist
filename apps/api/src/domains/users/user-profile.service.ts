import mongoose from 'mongoose';
import type { CreateUserAddressDto } from '@ibas/shared-types';
import { UserAddress } from './models/UserAddress.model.js';
import { User } from './models/User.model.js';
import { notFound } from '../../shared/errors/AppError.js';

function serializeAddress(doc: InstanceType<typeof UserAddress>) {
  return {
    id: String(doc._id),
    user_id: String(doc.user_id),
    address_type: doc.address_type,
    division_id: String(doc.division_id),
    district_id: String(doc.district_id),
    thana_id: String(doc.thana_id),
    village_or_area: doc.village_or_area,
    post_code: doc.post_code,
    full_address: doc.full_address,
    is_primary: doc.is_primary,
    created_at: doc.created_at,
  };
}

export async function listUserAddresses(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw notFound('User not found');
  const items = await UserAddress.find({ user_id: userId }).sort({ created_at: -1 });
  return items.map(serializeAddress);
}

export async function createUserAddress(userId: string, dto: CreateUserAddressDto) {
  const user = await User.findById(userId);
  if (!user) throw notFound('User not found');

  if (dto.is_primary) {
    await UserAddress.updateMany({ user_id: userId }, { is_primary: false });
  }

  const doc = await UserAddress.create({
    user_id: new mongoose.Types.ObjectId(userId),
    address_type: dto.address_type,
    division_id: new mongoose.Types.ObjectId(dto.division_id),
    district_id: new mongoose.Types.ObjectId(dto.district_id),
    thana_id: new mongoose.Types.ObjectId(dto.thana_id),
    village_or_area: dto.village_or_area,
    post_code: dto.post_code,
    full_address: dto.full_address,
    is_primary: dto.is_primary,
  });

  return serializeAddress(doc);
}

export async function listUserActivity(userId: string, limit = 50) {
  const user = await User.findById(userId);
  if (!user) throw notFound('User not found');
  const { UserActivityLog } = await import('./models/UserActivityLog.model.js');
  const items = await UserActivityLog.find({ user_id: userId }).sort({ created_at: -1 }).limit(limit);
  return items.map((log) => ({
    id: String(log._id),
    action: log.action,
    description: log.description,
    ip_address: log.ip_address,
    created_at: log.created_at,
  }));
}
