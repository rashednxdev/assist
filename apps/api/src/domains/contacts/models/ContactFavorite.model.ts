import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IContactFavorite extends Document {
  user_id: Types.ObjectId;
  target_type: 'office' | 'user';
  target_id: Types.ObjectId;
  created_at: Date;
}

const schema = new Schema<IContactFavorite>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    target_type: { type: String, enum: ['office', 'user'], required: true },
    target_id: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
);

schema.index({ user_id: 1, target_type: 1, target_id: 1 }, { unique: true });

export const ContactFavorite = mongoose.model<IContactFavorite>('ContactFavorite', schema, 'contact_favorites');
