import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IStepResponse extends Document {
  run_id: Types.ObjectId;
  step_id: Types.ObjectId;
  step_number: number;
  performed_by: Types.ObjectId;
  role_code: string;
  action: 'submit' | 'approve' | 'reject' | 'return' | 'skip';
  field_responses?: Record<string, unknown>;
  remarks?: string;
  attachments: string[];
  condition_met?: boolean;
  started_at?: Date;
  duration_ms?: number;
  ip_address?: string;
  performed_at: Date;
}

const schema = new Schema<IStepResponse>(
  {
    run_id: { type: Schema.Types.ObjectId, required: true },
    step_id: { type: Schema.Types.ObjectId, required: true },
    step_number: { type: Number, required: true },
    performed_by: { type: Schema.Types.ObjectId, required: true },
    role_code: { type: String, required: true },
    action: {
      type: String,
      enum: ['submit', 'approve', 'reject', 'return', 'skip'],
      required: true,
    },
    field_responses: { type: Schema.Types.Mixed },
    remarks: { type: String },
    attachments: { type: [String], default: [] },
    condition_met: { type: Boolean },
    started_at: { type: Date },
    duration_ms: { type: Number },
    ip_address: { type: String },
    performed_at: { type: Date, required: true },
  },
  { timestamps: false },
);

schema.index({ run_id: 1, step_number: 1 }, { unique: true });

export const StepResponse = mongoose.model<IStepResponse>('StepResponse', schema, 'step_responses');
