import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ICircular extends Document {
  circular_no: string;
  title: string;
  title_bn?: string;
  summary?: string;
  full_text?: string;
  issuer: string;
  ministry?: string;
  department?: string;
  /** Wing / branch / section. */
  issuer_detail?: string;
  order_by?: string;
  order_by_designation?: string;
  doc_type: string;
  /** YYYY-MM-DD */
  issue_date: string;
  effective_date?: string;
  collections: string[];
  areas: string[];
  tags: string[];
  attachment_url?: string;
  source_url?: string;
  supersedes_ids: Types.ObjectId[];
  checklist: Array<{ id: string; text: string; required: boolean }>;
  note?: string;
  toolkit_ids: Types.ObjectId[];
  is_published: boolean;
  is_active: boolean;
  created_by: Types.ObjectId;
  updated_by?: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<ICircular>(
  {
    circular_no: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    title_bn: { type: String, trim: true },
    summary: { type: String },
    full_text: { type: String },
    issuer: { type: String, required: true },
    ministry: { type: String, trim: true },
    department: { type: String, trim: true },
    issuer_detail: { type: String },
    order_by: { type: String, trim: true },
    order_by_designation: { type: String, trim: true },
    doc_type: { type: String, required: true },
    issue_date: { type: String, required: true },
    effective_date: { type: String },
    collections: { type: [String], default: [] },
    areas: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    attachment_url: { type: String },
    source_url: { type: String },
    supersedes_ids: { type: [Schema.Types.ObjectId], default: [], ref: 'Circular' },
    checklist: {
      type: [
        new Schema(
          {
            id: { type: String, required: true },
            text: { type: String, required: true },
            required: { type: Boolean, default: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    note: { type: String },
    toolkit_ids: { type: [Schema.Types.ObjectId], default: [], ref: 'ToolkitItem' },
    is_published: { type: Boolean, default: false },
    is_active: { type: Boolean, default: true },
    created_by: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    updated_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ is_active: 1, is_published: 1, issue_date: -1 });
schema.index({ areas: 1 });
schema.index({ collections: 1 });
schema.index({ tags: 1 });
schema.index({ supersedes_ids: 1 });

export const Circular = mongoose.model<ICircular>('Circular', schema, 'circulars');
