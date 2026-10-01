import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IChargeHandover {
  new_holder_id: Types.ObjectId;
  requested_at: Date;
}

export interface IAdditionalCharge extends Document {
  user_id: Types.ObjectId;
  office_id: Types.ObjectId;
  designation_id: Types.ObjectId;
  status: 'active' | 'ended';
  started_at: Date;
  ended_at?: Date | null;
  end_reason?: 'removed' | 'handed_over' | null;
  handed_over_to?: Types.ObjectId | null;
  /** Open question to the holder after someone joined this post substantively. */
  handover?: IChargeHandover | null;
  /** Past "still holding" answers, so the same newcomer isn't asked about twice. */
  kept_for?: Types.ObjectId[];
  created_at: Date;
  updated_at: Date;
}

const handover = new Schema<IChargeHandover>(
  {
    new_holder_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    requested_at: { type: Date, required: true },
  },
  { _id: false },
);

const schema = new Schema<IAdditionalCharge>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    office_id: { type: Schema.Types.ObjectId, ref: 'Office', required: true },
    designation_id: { type: Schema.Types.ObjectId, ref: 'Designation', required: true },
    status: { type: String, enum: ['active', 'ended'], required: true, default: 'active' },
    started_at: { type: Date, required: true, default: Date.now },
    ended_at: { type: Date, default: null },
    end_reason: { type: String, enum: ['removed', 'handed_over', null], default: null },
    handed_over_to: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    handover: { type: handover, default: null },
    kept_for: { type: [Schema.Types.ObjectId], default: [] },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ user_id: 1, status: 1 });
schema.index({ office_id: 1, designation_id: 1, status: 1 });
schema.index(
  { user_id: 1, office_id: 1, designation_id: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } },
);

export const AdditionalCharge = mongoose.model<IAdditionalCharge>('AdditionalCharge', schema, 'additional_charges');
