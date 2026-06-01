import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ISyllabusReference extends Document {
  syllabus_topic_id: Types.ObjectId;
  exam_subject_id: Types.ObjectId;
  book_info_id?: Types.ObjectId;
  book_chapter_id?: Types.ObjectId;
  book_topic_id?: Types.ObjectId;
  regulation_id?: Types.ObjectId;
  relevance_note?: string;
}

const schema = new Schema<ISyllabusReference>(
  {
    syllabus_topic_id: { type: Schema.Types.ObjectId, required: true, ref: 'SyllabusTopic' },
    exam_subject_id: { type: Schema.Types.ObjectId, required: true, ref: 'ExamSubject' },
    book_info_id: { type: Schema.Types.ObjectId, ref: 'BookInfo' },
    book_chapter_id: { type: Schema.Types.ObjectId, ref: 'BookChapter' },
    book_topic_id: { type: Schema.Types.ObjectId, ref: 'BookTopic' },
    regulation_id: { type: Schema.Types.ObjectId, ref: 'Regulation' },
    relevance_note: { type: String },
  },
  { timestamps: false },
);

schema.index({ syllabus_topic_id: 1 });
schema.index({ exam_subject_id: 1 });

export const SyllabusReference = mongoose.model<ISyllabusReference>(
  'SyllabusReference',
  schema,
  'syllabus_references',
);
