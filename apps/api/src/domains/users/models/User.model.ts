import mongoose, { Schema, type Document, type Types } from 'mongoose';
import type { UserType } from '@ibas/shared-constants';
import { BLOOD_GROUPS, type BloodGroup } from '@ibas/shared-types';

export interface WorkflowRoleTag {
  role_id: Types.ObjectId;
  role_code: string;
  is_active: boolean;
  assigned_at: Date;
  assigned_by: Types.ObjectId;
  /** Added by the user themselves: usable in their own runs, never gets handoff notifications or inbox items. */
  self_assigned?: boolean;
}

export interface IUser extends Document {
  employee_id?: string;
  nid?: string;
  full_name_en: string;
  full_name_bn?: string;
  email: string;
  phone: string;
  dob?: Date;
  gender?: 'male' | 'female' | 'other';
  profile_photo?: string;
  user_type: UserType;
  workflow_roles: WorkflowRoleTag[];
  status: 'active' | 'inactive' | 'suspended' | 'pending_verify';
  is_verified: boolean;
  email_verified: boolean;
  phone_verified: boolean;
  is_super_admin: boolean;
  /** Admin-only accounting field — /auth/me exposes only has_paid derived from this. */
  amount_received: number;
  /**
   * When true (default), learner content is not filtered by exam subject.
   * When false, only `exam_subject_ids` are visible in papers / QB / exam-week / QOTD.
   */
  all_exam_subjects: boolean;
  exam_subject_ids: Types.ObjectId[];
  /** Exam part the learner studies in Exam Preparation; empty = Part 1. */
  exam_prep_part_id?: Types.ObjectId | null;
  /** Last reported client build (e.g. ProAssist.1.0.0.11). */
  client_app_version?: string;
  client_platform?: 'mobile' | 'web';
  client_app_version_at?: Date;
  /** Current posting — required before posting in the community. */
  office_id?: Types.ObjectId | null;
  designation_id?: Types.ObjectId | null;
  /** Posting details shown in the contact directory. */
  work_section?: string;
  work_telephone?: string;
  work_pabx?: string;
  /** Contact directory privacy: keep mobile / email out of the directory. */
  directory_hide_phone?: boolean;
  directory_hide_email?: boolean;
  /** When the user agreed to share their details in the contact directory; only these users are listed. */
  directory_consent_at?: Date | null;
  /** Admin-granted honorable user: directory access without consent, posting or verification. */
  contact_honorable?: boolean;
  blood_group?: BloodGroup | null;
  father_name?: string;
  mother_name?: string;
  home_district_id?: Types.ObjectId | null;
  /** Government service joining date (for non-cadre: joining date in `joining_designation_id`). */
  joining_date?: Date | null;
  service_type?: 'cadre' | 'non_cadre' | null;
  bcs_batch?: number | null;
  /** Non-cadre: the post the user joined service in. */
  joining_designation_id?: Types.ObjectId | null;
  alternate_phone?: string;
  emergency_contact_name?: string;
  emergency_contact_relation?: string;
  emergency_contact_phone?: string;
  bio?: string;
  /** Blood bank donor settings; eligibility dates are derived from `blood_donations`. */
  blood_donor?: IBloodDonor | null;
  created_by: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

export interface IBloodDonor {
  is_donor: boolean;
  available: boolean;
  district_id?: Types.ObjectId | null;
  thana_id?: Types.ObjectId | null;
  area?: string;
  show_phone: boolean;
  note?: string;
  last_donation_date?: Date | null;
  next_eligible_date?: Date | null;
  donation_count: number;
}

const bloodDonorSchema = new Schema<IBloodDonor>(
  {
    is_donor: { type: Boolean, default: false },
    available: { type: Boolean, default: true },
    district_id: { type: Schema.Types.ObjectId, ref: 'District', default: null },
    thana_id: { type: Schema.Types.ObjectId, ref: 'Thana', default: null },
    area: { type: String, trim: true },
    show_phone: { type: Boolean, default: true },
    note: { type: String, trim: true },
    last_donation_date: { type: Date, default: null },
    next_eligible_date: { type: Date, default: null },
    donation_count: { type: Number, default: 0 },
  },
  { _id: false },
);

const workflowRoleTagSchema = new Schema<WorkflowRoleTag>(
  {
    role_id: { type: Schema.Types.ObjectId, required: true },
    role_code: { type: String, required: true },
    is_active: { type: Boolean, default: true },
    assigned_at: { type: Date, required: true },
    assigned_by: { type: Schema.Types.ObjectId, required: true },
    self_assigned: { type: Boolean, default: false },
  },
  { _id: false },
);

const userSchema = new Schema<IUser>(
  {
    employee_id: { type: String, sparse: true, unique: true },
    nid: { type: String, sparse: true, unique: true },
    full_name_en: { type: String, required: true },
    full_name_bn: { type: String },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    dob: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    profile_photo: { type: String },
    user_type: {
      type: String,
      enum: ['system_admin', 'admin', 'applicant', 'officer'],
      required: true,
    },
    workflow_roles: { type: [workflowRoleTagSchema], default: [] },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended', 'pending_verify'],
      default: 'active',
    },
    is_verified: { type: Boolean, default: false },
    email_verified: { type: Boolean, default: false },
    phone_verified: { type: Boolean, default: false },
    is_super_admin: { type: Boolean, default: false },
    amount_received: { type: Number, default: 0, min: 0 },
    all_exam_subjects: { type: Boolean, default: true },
    exam_subject_ids: { type: [Schema.Types.ObjectId], default: [], ref: 'ExamSubject' },
    exam_prep_part_id: { type: Schema.Types.ObjectId, ref: 'ExamPart', default: null },
    client_app_version: { type: String, maxlength: 80 },
    client_platform: { type: String, enum: ['mobile', 'web'] },
    client_app_version_at: { type: Date },
    office_id: { type: Schema.Types.ObjectId, ref: 'Office', default: null },
    designation_id: { type: Schema.Types.ObjectId, ref: 'Designation', default: null },
    work_section: { type: String, trim: true },
    work_telephone: { type: String, trim: true },
    work_pabx: { type: String, trim: true },
    directory_hide_phone: { type: Boolean, default: false },
    directory_hide_email: { type: Boolean, default: false },
    directory_consent_at: { type: Date, default: null },
    contact_honorable: { type: Boolean, default: false },
    blood_group: { type: String, enum: [...BLOOD_GROUPS, null], default: null },
    father_name: { type: String, trim: true },
    mother_name: { type: String, trim: true },
    home_district_id: { type: Schema.Types.ObjectId, ref: 'District', default: null },
    joining_date: { type: Date, default: null },
    service_type: { type: String, enum: ['cadre', 'non_cadre', null], default: null },
    bcs_batch: { type: Number, default: null, min: 1, max: 99 },
    joining_designation_id: { type: Schema.Types.ObjectId, ref: 'Designation', default: null },
    alternate_phone: { type: String, trim: true },
    emergency_contact_name: { type: String, trim: true },
    emergency_contact_relation: { type: String, trim: true },
    emergency_contact_phone: { type: String, trim: true },
    bio: { type: String, trim: true },
    blood_donor: { type: bloodDonorSchema, default: null },
    created_by: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

userSchema.index({ user_type: 1, status: 1 });
userSchema.index({ 'workflow_roles.role_code': 1, status: 1 });
userSchema.index({ office_id: 1 }, { sparse: true });
userSchema.index({ designation_id: 1 }, { sparse: true });
userSchema.index({ service_type: 1, bcs_batch: 1 }, { partialFilterExpression: { service_type: 'cadre' } });
userSchema.index({ service_type: 1, joining_designation_id: 1, joining_date: 1 }, { partialFilterExpression: { service_type: 'non_cadre' } });
userSchema.index({ 'blood_donor.is_donor': 1, blood_group: 1, 'blood_donor.district_id': 1 }, { partialFilterExpression: { 'blood_donor.is_donor': true } });

export const User = mongoose.model<IUser>('User', userSchema, 'users');
