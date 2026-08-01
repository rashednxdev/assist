import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ITermsSubsection {
  subtitle: string;
  details?: string;
  note?: string;
}

export interface ITermsSection {
  title: string;
  details?: string;
  note?: string;
  subsections: ITermsSubsection[];
}

export interface ITermsAndConditions extends Document {
  key: 'global';
  header: string;
  sections: ITermsSection[];
  updated_by?: Types.ObjectId;
  updated_at: Date;
}

const subsectionSchema = new Schema<ITermsSubsection>(
  {
    subtitle: { type: String, required: true, default: '' },
    details: { type: String },
    note: { type: String },
  },
  { _id: false },
);

const sectionSchema = new Schema<ITermsSection>(
  {
    title: { type: String, required: true, default: '' },
    details: { type: String },
    note: { type: String },
    subsections: { type: [subsectionSchema], default: [] },
  },
  { _id: false },
);

const schema = new Schema<ITermsAndConditions>(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    header: { type: String, required: true, default: 'Terms and Conditions' },
    sections: { type: [sectionSchema], default: [] },
    updated_by: { type: Schema.Types.ObjectId, ref: 'User' },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

export const TermsAndConditions = mongoose.model<ITermsAndConditions>(
  'TermsAndConditions',
  schema,
  'terms_and_conditions',
);
