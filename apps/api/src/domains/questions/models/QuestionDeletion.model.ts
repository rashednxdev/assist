import mongoose, { Schema, type Document, type Types } from 'mongoose';

/** Tombstone written when a question is hard-deleted, so mobile delta-sync can detect the removal. */
export interface IQuestionDeletion extends Document {
  question_id: Types.ObjectId;
  deleted_at: Date;
}

const schema = new Schema<IQuestionDeletion>(
  {
    question_id: { type: Schema.Types.ObjectId, required: true },
    deleted_at: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false },
);

schema.index({ deleted_at: 1 });

export const QuestionDeletion = mongoose.model<IQuestionDeletion>(
  'QuestionDeletion',
  schema,
  'question_deletions',
);
