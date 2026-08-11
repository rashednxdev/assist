import mongoose from 'mongoose';
import type { CreateUserDto, UpdateUserDto } from '@ibas/shared-types';
import { hashPassword } from '../auth/auth.service.js';
import { User } from './models/User.model.js';
import { Credentials } from './models/Credentials.model.js';
import { Role } from '../workflow/models/Role.model.js';
import { notFound, badRequest } from '../../shared/errors/AppError.js';

async function serializeUser(user: InstanceType<typeof User>) {
  const credentials = await Credentials.findOne({ user_id: user._id }).select(
    'allow_multi_device bound_device_id bound_device_at bound_device_label',
  );
  return {
    id: String(user._id),
    employee_id: user.employee_id,
    nid: user.nid,
    full_name_en: user.full_name_en,
    full_name_bn: user.full_name_bn,
    email: user.email,
    phone: user.phone,
    user_type: user.user_type,
    status: user.status,
    is_verified: user.is_verified,
    is_super_admin: user.is_super_admin,
    amount_received: Number(user.amount_received ?? 0),
    workflow_roles: user.workflow_roles,
    allow_multi_device: Boolean(credentials?.allow_multi_device),
    bound_device_id: credentials?.bound_device_id ?? null,
    bound_device_at: credentials?.bound_device_at ?? null,
    bound_device_label: credentials?.bound_device_label ?? null,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

export async function listUsers(filters: {
  user_type?: string;
  status?: string;
  q?: string;
  skip: number;
  limit: number;
}) {
  const query: Record<string, unknown> = {};
  if (filters.user_type) query.user_type = filters.user_type;
  if (filters.status) query.status = filters.status;
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    query.$or = [
      { full_name_en: { $regex: q, $options: 'i' } },
      { full_name_bn: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { phone: { $regex: q, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    User.find(query).sort({ created_at: -1 }).skip(filters.skip).limit(filters.limit),
    User.countDocuments(query),
  ]);

  return { items: await Promise.all(items.map((u) => serializeUser(u))), total };
}

export async function getUserById(id: string) {
  const user = await User.findById(id);
  if (!user) throw notFound('User not found');
  return serializeUser(user);
}

export async function createUser(dto: CreateUserDto, createdBy: string, creatorIsSuperAdmin = false) {
  if (dto.user_type === 'system_admin' && !creatorIsSuperAdmin) {
    throw badRequest('Only a super admin can create system admin accounts');
  }
  if (dto.is_super_admin && !creatorIsSuperAdmin) {
    throw badRequest('Only a super admin can grant super admin access');
  }

  const exists = await User.findOne({ $or: [{ email: dto.email.toLowerCase() }, { phone: dto.phone }] });
  if (exists) throw badRequest('Email or phone already in use');

  const user = await User.create({
    full_name_en: dto.full_name_en,
    full_name_bn: dto.full_name_bn,
    email: dto.email.toLowerCase(),
    phone: dto.phone,
    employee_id: dto.employee_id,
    nid: dto.nid,
    user_type: dto.user_type,
    workflow_roles: [],
    status: 'active',
    is_verified: true,
    email_verified: true,
    phone_verified: true,
    is_super_admin: dto.is_super_admin ?? false,
    amount_received: dto.amount_received ?? 0,
    created_by: new mongoose.Types.ObjectId(createdBy),
  });

  await Credentials.create({
    user_id: user._id,
    password_hash: await hashPassword(dto.password),
    status: 'active',
    failed_attempts: 0,
    password_changed_at: new Date(),
    two_fa_enabled: false,
    allow_multi_device: false,
    token_version: 0,
  });

  return serializeUser(user);
}

export async function updateUser(id: string, dto: UpdateUserDto) {
  const user = await User.findById(id);
  if (!user) throw notFound('User not found');

  if (dto.email && dto.email.toLowerCase() !== user.email) {
    const dup = await User.findOne({ email: dto.email.toLowerCase(), _id: { $ne: id } });
    if (dup) throw badRequest('Email already in use');
    user.email = dto.email.toLowerCase();
  }
  if (dto.phone && dto.phone !== user.phone) {
    const dup = await User.findOne({ phone: dto.phone, _id: { $ne: id } });
    if (dup) throw badRequest('Phone already in use');
    user.phone = dto.phone;
  }

  if (dto.full_name_en !== undefined) user.full_name_en = dto.full_name_en;
  if (dto.full_name_bn !== undefined) user.full_name_bn = dto.full_name_bn;
  if (dto.employee_id !== undefined) user.employee_id = dto.employee_id;
  if (dto.nid !== undefined) user.nid = dto.nid;
  if (dto.user_type !== undefined) user.user_type = dto.user_type;
  if (dto.status !== undefined) user.status = dto.status;
  if (dto.is_verified !== undefined) user.is_verified = dto.is_verified;
  if (dto.is_super_admin !== undefined) user.is_super_admin = dto.is_super_admin;
  if (dto.amount_received !== undefined) user.amount_received = dto.amount_received;

  await user.save();

  if (dto.allow_multi_device !== undefined || dto.clear_bound_device || dto.force_logout) {
    const credentials = await Credentials.findOne({ user_id: user._id });
    if (credentials) {
      if (dto.allow_multi_device !== undefined) {
        credentials.allow_multi_device = dto.allow_multi_device;
      }
      if (dto.clear_bound_device) {
        credentials.bound_device_id = undefined;
        credentials.bound_device_at = undefined;
        credentials.bound_device_label = undefined;
        credentials.token_version = (credentials.token_version ?? 0) + 1;
      } else if (dto.force_logout) {
        credentials.token_version = (credentials.token_version ?? 0) + 1;
      }
      await credentials.save();
    }
  }

  return serializeUser(user);
}

export async function deactivateUser(id: string) {
  const user = await User.findById(id);
  if (!user) throw notFound('User not found');
  user.status = 'inactive';
  await user.save();
  return serializeUser(user);
}

export async function assignWorkflowRole(userId: string, roleCode: string, assignedBy: string) {
  const user = await User.findById(userId);
  if (!user) throw notFound('User not found');

  const role = await Role.findOne({ code: roleCode, is_active: true });
  if (!role) throw notFound('Role not found');

  const existing = user.workflow_roles.find((r) => r.role_code === roleCode);
  if (existing) {
    existing.is_active = true;
    existing.assigned_at = new Date();
    existing.assigned_by = new mongoose.Types.ObjectId(assignedBy);
  } else {
    user.workflow_roles.push({
      role_id: role._id,
      role_code: role.code,
      is_active: true,
      assigned_at: new Date(),
      assigned_by: new mongoose.Types.ObjectId(assignedBy),
    });
  }

  await user.save();
  return serializeUser(user);
}

export async function removeWorkflowRole(userId: string, roleCode: string) {
  const user = await User.findById(userId);
  if (!user) throw notFound('User not found');

  const tag = user.workflow_roles.find((r) => r.role_code === roleCode);
  if (!tag) throw notFound('Workflow role not assigned');
  tag.is_active = false;
  await user.save();
  return serializeUser(user);
}
