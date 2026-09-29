import mongoose, { Schema, type Document, type Types } from 'mongoose';
import type { CommunityLinkType } from '@ibas/shared-types';

export interface ICommunityLinkRef {
  type: CommunityLinkType;
  id: Types.ObjectId;
}

export interface ICommunityThread extends Document {
  title: string;
  body: string;
  category_id: Types.ObjectId;
  author_id: Types.ObjectId;
  tags: string[];
  links: ICommunityLinkRef[];
  accepted_answer_id?: Types.ObjectId | null;
  answer_count: number;
  vote_score: number;
  view_count: number;
  follower_count: number;
  is_pinned: boolean;
  is_locked: boolean;
  is_hidden: boolean;
  is_deleted: boolean;
  moderation_note?: string;
  last_activity_at: Date;
  last_answer_by?: Types.ObjectId;
  edited_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export const linkRefSchema = new Schema<ICommunityLinkRef>(
  {
    type: { type: String, enum: ['task', 'toolkit', 'circular'], required: true },
    id: { type: Schema.Types.ObjectId, required: true },
  },
  { _id: false },
);

const schema = new Schema<ICommunityThread>(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    category_id: { type: Schema.Types.ObjectId, ref: 'CommunityCategory', required: true },
    author_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tags: { type: [String], default: [] },
    links: { type: [linkRefSchema], default: [] },
    accepted_answer_id: { type: Schema.Types.ObjectId, ref: 'CommunityAnswer', default: null },
    answer_count: { type: Number, default: 0 },
    vote_score: { type: Number, default: 0 },
    view_count: { type: Number, default: 0 },
    follower_count: { type: Number, default: 0 },
    is_pinned: { type: Boolean, default: false },
    is_locked: { type: Boolean, default: false },
    is_hidden: { type: Boolean, default: false },
    is_deleted: { type: Boolean, default: false },
    moderation_note: { type: String },
    last_activity_at: { type: Date, default: Date.now },
    last_answer_by: { type: Schema.Types.ObjectId, ref: 'User' },
    edited_at: { type: Date },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ is_deleted: 1, is_hidden: 1, is_pinned: -1, last_activity_at: -1 });
schema.index({ category_id: 1, last_activity_at: -1 });
schema.index({ author_id: 1, created_at: -1 });
schema.index({ tags: 1 });
schema.index({ 'links.type': 1, 'links.id': 1 });

export const CommunityThread = mongoose.model<ICommunityThread>('CommunityThread', schema, 'community_threads');
