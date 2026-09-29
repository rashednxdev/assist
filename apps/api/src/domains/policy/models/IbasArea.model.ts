import mongoose, { Schema, type Document, type Types } from 'mongoose';

/**
 * An iBAS++ Workspace area. Every area has a Module row with the same `code`, which is what gets
 * granted, charged for or stopped; this record holds the workspace-specific settings.
 */
export interface IIbasArea extends Document {
  code: string;
  name_en: string;
  name_bn: string;
  description_en: string;
  color: string;
  /** Other module codes whose grants open this area and whose workflow tasks appear in it. */
  legacy_codes: string[];
  policy_collections: string[];
  sort_order: number;
  /** Hidden areas stay in the database (content keeps its tags) but are not listed to users. */
  is_active: boolean;
  created_by?: Types.ObjectId;
  updated_by?: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<IIbasArea>(
  {
    code: { type: String, required: true, unique: true },
    name_en: { type: String, required: true },
    name_bn: { type: String, default: '' },
    description_en: { type: String, default: '' },
    color: { type: String, required: true },
    legacy_codes: { type: [String], default: [] },
    policy_collections: { type: [String], default: [] },
    sort_order: { type: Number, default: 100 },
    is_active: { type: Boolean, default: true },
    created_by: { type: Schema.Types.ObjectId, ref: 'User' },
    updated_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

export const IbasArea = mongoose.model<IIbasArea>('IbasArea', schema, 'ibas_areas');
