import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ITaskRun extends Document {
  task_id: Types.ObjectId;
  task_name_en: string;
  task_name_bn?: string;
  task_version: number;
  initiated_by: Types.ObjectId;
  current_step: number;
  current_role: string;
  status: 'in_progress' | 'completed' | 'rejected' | 'cancelled';
  started_at: Date;
  completed_at?: Date;
  last_activity_at: Date;
  duration_ms?: number;
  rejection_reason?: string;
  rejected_by?: Types.ObjectId;
  cancelled_by?: Types.ObjectId;
  office_code: string;
  fiscal_year: string;
  month?: string;
  reference_no?: string;
  metadata?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<ITaskRun>(
  {
    task_id: { type: Schema.Types.ObjectId, required: true },
    task_name_en: { type: String, required: true },
    task_name_bn: { type: String },
    task_version: { type: Number, required: true },
    initiated_by: { type: Schema.Types.ObjectId, required: true },
    current_step: { type: Number, required: true },
    current_role: { type: String, required: true },
    status: {
      type: String,
      enum: ['in_progress', 'completed', 'rejected', 'cancelled'],
      default: 'in_progress',
    },
    started_at: { type: Date, required: true },
    completed_at: { type: Date },
    last_activity_at: { type: Date, required: true },
    duration_ms: { type: Number },
    rejection_reason: { type: String },
    rejected_by: { type: Schema.Types.ObjectId },
    cancelled_by: { type: Schema.Types.ObjectId },
    office_code: { type: String, required: true },
    fiscal_year: { type: String, required: true },
    month: { type: String },
    reference_no: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ task_id: 1, status: 1 });
schema.index({ initiated_by: 1, status: 1 });
schema.index({ current_role: 1, status: 1 });
schema.index({ reference_no: 1 }, { sparse: true });

export const TaskRun = mongoose.model<ITaskRun>('TaskRun', schema, 'task_runs');
