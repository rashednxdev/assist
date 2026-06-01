import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IAuthority extends Document {
  department_id: Types.ObjectId;
  name: string;
  authority_type: string;
  description?: string;
  contact_email?: string;
  contact_phone?: string;
  is_active: boolean;
}

const schema = new Schema<IAuthority>(
  {
    department_id: { type: Schema.Types.ObjectId, required: true, ref: 'ExamDepartment' },
    name: { type: String, required: true },
    authority_type: { type: String, required: true },
    description: { type: String },
    contact_email: { type: String },
    contact_phone: { type: String },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: false },
);

schema.index({ department_id: 1, is_active: 1 });

export const Authority = mongoose.model<IAuthority>('Authority', schema, 'authorities');
