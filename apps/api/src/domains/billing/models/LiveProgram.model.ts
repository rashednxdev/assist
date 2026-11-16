import mongoose, { Schema, type Document } from 'mongoose';

/** A named live package. Subject classes (AccessPackage kind live) sit under it. */
export interface ILiveProgram extends Document {
  name: string;
  name_bn?: string;
  description?: string;
  waiver_2: number;
  waiver_3: number;
  waiver_4: number;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<ILiveProgram>(
  {
    name: { type: String, required: true, trim: true },
    name_bn: { type: String, trim: true },
    description: { type: String, trim: true },
    waiver_2: { type: Number, default: 10, min: 0, max: 90 },
    waiver_3: { type: Number, default: 0, min: 0, max: 90 },
    waiver_4: { type: Number, default: 0, min: 0, max: 90 },
    sort_order: { type: Number, default: 100 },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ sort_order: 1, name: 1 });

export const LiveProgram = mongoose.model<ILiveProgram>('LiveProgram', schema, 'live_programs');
