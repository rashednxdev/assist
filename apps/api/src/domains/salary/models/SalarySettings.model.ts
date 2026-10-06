import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ISalarySettings extends Document {
  key: 'global';
  contacts: Array<{ label: string; number: string; whatsapp: boolean }>;
  /** Null means the default bulk size. */
  bulk_size: number | null;
  /** Null means "Others" is allowed. */
  others_allowed: boolean | null;
  updated_by: Types.ObjectId | null;
  updated_at: Date | null;
}

const schema = new Schema<ISalarySettings>(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    contacts: {
      type: [
        {
          _id: false,
          label: { type: String, default: '' },
          number: { type: String, required: true },
          whatsapp: { type: Boolean, default: false },
        },
      ],
      default: [],
    },
    bulk_size: { type: Number, default: null, min: 1 },
    others_allowed: { type: Boolean, default: null },
    updated_by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updated_at: { type: Date, default: null },
  },
  { timestamps: false },
);

export const SalarySettings = mongoose.model<ISalarySettings>('SalarySettings', schema, 'salary_settings');
