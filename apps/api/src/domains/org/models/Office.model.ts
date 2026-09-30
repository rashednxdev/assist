import mongoose, { Schema, type Document, type Types } from 'mongoose';

/** Offices and sub-offices live in one collection; `parent_id` is null for a top-level office. */
export interface IOffice extends Document {
  name: string;
  name_bn?: string;
  short_name?: string;
  office_code?: string;
  office_type_id: Types.ObjectId;
  parent_id: Types.ObjectId | null;
  email?: string;
  mobile?: string;
  telephone?: string;
  pabx?: string;
  fax?: string;
  address?: string;
  division_id: Types.ObjectId | null;
  district_id: Types.ObjectId | null;
  thana_id: Types.ObjectId | null;
  web_address?: string;
  description?: string;
  serial_no: number;
  is_active: boolean;
  updated_by?: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<IOffice>(
  {
    name: { type: String, required: true, trim: true },
    name_bn: { type: String, trim: true },
    short_name: { type: String, trim: true },
    office_code: { type: String, trim: true },
    office_type_id: { type: Schema.Types.ObjectId, ref: 'OfficeType', required: true },
    parent_id: { type: Schema.Types.ObjectId, ref: 'Office', default: null },
    email: { type: String, trim: true, lowercase: true },
    mobile: { type: String, trim: true },
    telephone: { type: String, trim: true },
    pabx: { type: String, trim: true },
    fax: { type: String, trim: true },
    address: { type: String, trim: true },
    division_id: { type: Schema.Types.ObjectId, ref: 'Division', default: null },
    district_id: { type: Schema.Types.ObjectId, ref: 'District', default: null },
    thana_id: { type: Schema.Types.ObjectId, ref: 'Thana', default: null },
    web_address: { type: String, trim: true },
    description: { type: String, trim: true },
    serial_no: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
    updated_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ parent_id: 1, serial_no: 1, name: 1 });
schema.index({ office_type_id: 1 });
schema.index({ division_id: 1, district_id: 1, thana_id: 1 });
schema.index({ office_code: 1 }, { unique: true, partialFilterExpression: { office_code: { $type: 'string', $gt: '' } } });

export const Office = mongoose.model<IOffice>('Office', schema, 'offices');
