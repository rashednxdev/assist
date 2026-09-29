import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IToolkitRef {
  target_type: 'book' | 'book_topic' | 'circular';
  target_id: Types.ObjectId;
}

export interface IToolkitField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'number';
  required: boolean;
  placeholder?: string;
  help?: string;
}

export interface IToolkitAttachment {
  title: string;
  url: string;
}

export interface IToolkitItem extends Document {
  kind: 'checklist' | 'template' | 'guide';
  title: string;
  title_bn?: string;
  summary?: string;
  areas: string[];
  category: string;
  tags: string[];
  refs: IToolkitRef[];
  attachments: IToolkitAttachment[];
  items: Array<{
    id: string;
    section?: string;
    text: string;
    help?: string;
    required: boolean;
    refs: IToolkitRef[];
    attachments: IToolkitAttachment[];
  }>;
  fields: IToolkitField[];
  row_label?: string;
  row_fields: IToolkitField[];
  row_template?: string;
  body?: string;
  sections: Array<{ id: string; heading: string; body: string; refs: IToolkitRef[] }>;
  is_published: boolean;
  is_active: boolean;
  created_by: Types.ObjectId;
  updated_by?: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const refSchema = new Schema<IToolkitRef>(
  {
    target_type: { type: String, enum: ['book', 'book_topic', 'circular'], required: true },
    target_id: { type: Schema.Types.ObjectId, required: true },
  },
  { _id: false },
);

const attachmentSchema = new Schema<IToolkitAttachment>(
  {
    title: { type: String, required: true },
    url: { type: String, required: true },
  },
  { _id: false },
);

const fieldSchema = new Schema<IToolkitField>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, enum: ['text', 'textarea', 'date', 'number'], default: 'text' },
    required: { type: Boolean, default: false },
    placeholder: String,
    help: String,
  },
  { _id: false },
);

const schema = new Schema<IToolkitItem>(
  {
    kind: { type: String, enum: ['checklist', 'template', 'guide'], required: true },
    title: { type: String, required: true, trim: true },
    title_bn: { type: String, trim: true },
    summary: String,
    areas: { type: [String], default: [] },
    category: { type: String, required: true },
    tags: { type: [String], default: [] },
    refs: { type: [refSchema], default: [] },
    attachments: { type: [attachmentSchema], default: [] },
    items: {
      type: [
        new Schema(
          {
            id: { type: String, required: true },
            section: String,
            text: { type: String, required: true },
            help: String,
            required: { type: Boolean, default: true },
            refs: { type: [refSchema], default: [] },
            attachments: { type: [attachmentSchema], default: [] },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    fields: { type: [fieldSchema], default: [] },
    row_label: String,
    row_fields: { type: [fieldSchema], default: [] },
    row_template: String,
    body: String,
    sections: {
      type: [
        new Schema(
          {
            id: { type: String, required: true },
            heading: { type: String, required: true },
            body: { type: String, default: '' },
            refs: { type: [refSchema], default: [] },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    is_published: { type: Boolean, default: false },
    is_active: { type: Boolean, default: true },
    created_by: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    updated_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ is_active: 1, is_published: 1, kind: 1 });
schema.index({ areas: 1 });
schema.index({ category: 1 });

export const ToolkitItem = mongoose.model<IToolkitItem>('ToolkitItem', schema, 'toolkit_items');
