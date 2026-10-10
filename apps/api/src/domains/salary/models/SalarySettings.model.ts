import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ISalarySettings extends Document {
  key: 'global';
  contacts: Array<{ label: string; number: string; whatsapp: boolean }>;
  /** Null means the default bulk size. */
  bulk_size: number | null;
  /** Null means "Others" is allowed. */
  others_allowed: boolean | null;
  /** Periods the free single T.R. Form was on; users registered inside one get it. `to` null = still on. */
  free_tr_periods: Array<{ from: Date; to: Date | null }>;
  /** Null means SALARY_DEFAULT_FREE_TR_COUNT. */
  free_tr_count: number | null;
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
    free_tr_periods: {
      type: [{ _id: false, from: { type: Date, required: true }, to: { type: Date, default: null } }],
      default: [],
    },
    free_tr_count: { type: Number, default: null, min: 1 },
    updated_by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updated_at: { type: Date, default: null },
  },
  { timestamps: false },
);

export const SalarySettings = mongoose.model<ISalarySettings>('SalarySettings', schema, 'salary_settings');
