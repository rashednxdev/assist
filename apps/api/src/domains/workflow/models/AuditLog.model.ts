import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IAuditLog extends Document {
  actor_id: Types.ObjectId;
  actor_name_en: string;
  actor_name_bn?: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: Types.ObjectId;
  description: string;
  changes?: Record<string, unknown>;
  run_id?: Types.ObjectId;
  step_number?: number;
  ip_address: string;
  user_agent?: string;
  office_code: string;
  fiscal_year: string;
  severity: 'info' | 'warning' | 'critical';
  created_at: Date;
}

const schema = new Schema<IAuditLog>(
  {
    actor_id: { type: Schema.Types.ObjectId, required: true },
    actor_name_en: { type: String, required: true },
    actor_name_bn: { type: String },
    actor_role: { type: String, required: true },
    action: { type: String, required: true },
    entity_type: { type: String, required: true },
    entity_id: { type: Schema.Types.ObjectId, required: true },
    description: { type: String, required: true },
    changes: { type: Schema.Types.Mixed },
    run_id: { type: Schema.Types.ObjectId },
    step_number: { type: Number },
    ip_address: { type: String, required: true },
    user_agent: { type: String },
    office_code: { type: String, required: true },
    fiscal_year: { type: String, required: true },
    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

schema.index({ actor_id: 1, created_at: -1 });
schema.index({ entity_type: 1, entity_id: 1, created_at: -1 });
schema.index({ action: 1, created_at: -1 });
schema.index({ run_id: 1, created_at: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', schema, 'audit_logs');
