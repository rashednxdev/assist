import mongoose from 'mongoose';
import type { AuthUser } from '../../middleware/auth.js';
import { AuditLog } from './models/AuditLog.model.js';
import { User } from '../users/models/User.model.js';

export interface AuditContext {
  actor: AuthUser;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  changes?: Record<string, unknown>;
  runId?: string;
  stepNumber?: number;
  ipAddress?: string;
  userAgent?: string;
  officeCode?: string;
  fiscalYear?: string;
  severity?: 'info' | 'warning' | 'critical';
}

async function resolveActorRole(actor: AuthUser): Promise<string> {
  const active = actor.workflow_roles.filter((r) => r.is_active).map((r) => r.role_code);
  if (active.length > 0) return active[0]!;
  if (actor.is_super_admin) return 'ADMIN';
  return actor.user_type;
}

export async function appendAudit(ctx: AuditContext) {
  const user = await User.findById(ctx.actor.id);
  const actorRole = await resolveActorRole(ctx.actor);

  return AuditLog.create({
    actor_id: new mongoose.Types.ObjectId(ctx.actor.id),
    actor_name_en: user?.full_name_en ?? ctx.actor.email,
    actor_name_bn: user?.full_name_bn,
    actor_role: actorRole,
    action: ctx.action,
    entity_type: ctx.entityType,
    entity_id: new mongoose.Types.ObjectId(ctx.entityId),
    description: ctx.description,
    changes: ctx.changes,
    run_id: ctx.runId ? new mongoose.Types.ObjectId(ctx.runId) : undefined,
    step_number: ctx.stepNumber,
    ip_address: ctx.ipAddress ?? '0.0.0.0',
    user_agent: ctx.userAgent,
    office_code: ctx.officeCode ?? 'HQ-001',
    fiscal_year: ctx.fiscalYear ?? new Date().getFullYear().toString(),
    severity: ctx.severity ?? 'info',
  });
}

export async function listAuditLogs(filters: { skip: number; limit: number }) {
  const items = await AuditLog.find().sort({ created_at: -1 }).skip(filters.skip).limit(filters.limit);
  const total = await AuditLog.countDocuments();
  return {
    items: items.map((log) => ({
      id: String(log._id),
      actor_name_en: log.actor_name_en,
      actor_role: log.actor_role,
      action: log.action,
      entity_type: log.entity_type,
      entity_id: String(log.entity_id),
      description: log.description,
      run_id: log.run_id ? String(log.run_id) : undefined,
      step_number: log.step_number,
      severity: log.severity,
      created_at: log.created_at,
    })),
    total,
  };
}
