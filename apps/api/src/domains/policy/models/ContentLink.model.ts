import mongoose, { Schema, type Document, type Types } from 'mongoose';

/**
 * Curated cross-link from an iBAS++ area (later also a workflow task/step) to library content.
 * Targets are referenced by id and resolved at read time, so renamed rules stay current.
 */
export interface IContentLink extends Document {
  source_type: 'ibas_area' | 'task';
  source_id: string;
  target_type: 'book' | 'book_topic' | 'circular';
  target_id: Types.ObjectId;
  note?: string;
  sort_order: number;
  created_by: Types.ObjectId;
  created_at: Date;
}

const schema = new Schema<IContentLink>(
  {
    source_type: { type: String, enum: ['ibas_area', 'task'], required: true },
    source_id: { type: String, required: true },
    target_type: { type: String, enum: ['book', 'book_topic', 'circular'], required: true },
    target_id: { type: Schema.Types.ObjectId, required: true },
    note: { type: String },
    sort_order: { type: Number, default: 0 },
    created_by: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
);

schema.index({ source_type: 1, source_id: 1, sort_order: 1 });
schema.index({ source_type: 1, source_id: 1, target_type: 1, target_id: 1 }, { unique: true });

export const ContentLink = mongoose.model<IContentLink>('ContentLink', schema, 'content_links');
