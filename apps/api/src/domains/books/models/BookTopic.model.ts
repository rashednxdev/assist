import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IComparisonTableRow {
  feature: string;
  values: string[];
}

export interface IComparisonTable {
  /** Optional title spanning the full table width, shown centered above the column headers. */
  title?: string;
  feature_header: string;
  columns: string[];
  rows: IComparisonTableRow[];
}

export interface IBookTopic extends Document {
  book_chapter_id: Types.ObjectId;
  name?: string;
  sub_name?: string;
  rule_number?: string;
  description?: string;
  note?: string;
  /** Optional in-app or absolute URL to embed (e.g. /static-ref/jsi-2016-p). */
  content_link?: string;
  /** Optional comparison table for this rule/topic, same structure as a question's model answer table. */
  table?: IComparisonTable;
  effective_date?: Date;
  is_amended: boolean;
  sort_order: number;
  is_active: boolean;
}

const comparisonRowSchema = new Schema<IComparisonTableRow>(
  {
    feature: { type: String, default: '' },
    values: { type: [String], default: [] },
  },
  { _id: false },
);

const comparisonTableMongooseSchema = new Schema<IComparisonTable>(
  {
    title: { type: String },
    feature_header: { type: String, default: 'Feature' },
    columns: { type: [String], default: [] },
    rows: { type: [comparisonRowSchema], default: [] },
  },
  { _id: false },
);

const schema = new Schema<IBookTopic>(
  {
    book_chapter_id: { type: Schema.Types.ObjectId, required: true, ref: 'BookChapter' },
    name: { type: String, default: '' },
    sub_name: { type: String },
    rule_number: { type: String },
    description: { type: String },
    note: { type: String },
    content_link: { type: String },
    // Nested schema path (not `{ type: schema }`) so $set/$get round-trip reliably.
    table: comparisonTableMongooseSchema,
    effective_date: { type: Date },
    is_amended: { type: Boolean, default: false },
    sort_order: { type: Number, required: true },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: false },
);

schema.index({ book_chapter_id: 1, sort_order: 1 });
schema.index({ rule_number: 1 });

export const BookTopic = mongoose.model<IBookTopic>('BookTopic', schema, 'book_topics');
