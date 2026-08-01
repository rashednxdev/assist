import { Division } from '../../src/domains/setup/models/Division.model.js';
import { District } from '../../src/domains/setup/models/District.model.js';
import { Thana } from '../../src/domains/setup/models/Thana.model.js';
import { Module } from '../../src/domains/setup/models/Module.model.js';
import { Role } from '../../src/domains/workflow/models/Role.model.js';

/** Learning & platform modules (sidebar / RBAC). */
const PLATFORM_MODULES = [
  { code: 'BOOKS', name_en: 'Rule library', description_en: 'GFR and government financial rule books', color: '#0F6E56', sort_order: 10 },
  { code: 'QUESTIONS', name_en: 'Question bank', description_en: 'MCQ and descriptive questions linked to rules', color: '#185FA5', sort_order: 11 },
  { code: 'EXAM', name_en: 'Exam programs', description_en: 'SAS, SRAS and promotion exam structure', color: '#534AB7', sort_order: 12 },
  { code: 'SYLLABUS', name_en: 'Syllabus', description_en: 'Subject syllabus and references', color: '#854F0B', sort_order: 13 },
  { code: 'PAPER', name_en: 'Practice papers', description_en: 'Model tests and practice papers', color: '#BA7517', sort_order: 14 },
  { code: 'WORKFLOW', name_en: 'Guided processes', description_en: 'Step-by-step workflow runs and inbox', color: '#1D9E75', sort_order: 15 },
  { code: 'CANDIDATE', name_en: 'Candidate portal', description_en: 'Applicant exam registration', color: '#A32D2D', sort_order: 16 },
  { code: 'USER', name_en: 'User management', description_en: 'Create and manage system users', color: '#64748b', sort_order: 17 },
  { code: 'SETUP', name_en: 'System setup', description_en: 'Modules, geography, and configuration', color: '#64748b', sort_order: 18 },
  { code: 'AUDIT', name_en: 'Audit log', description_en: 'Platform audit trail', color: '#64748b', sort_order: 19 },
  { code: 'OCR', name_en: 'PDF to Word (OCR)', description_en: 'Convert PDF scans to editable Word documents', color: '#7c3aed', sort_order: 20 },
  { code: 'PENSION', name_en: 'Pension calculator', description_en: 'Government pension leave account and lamp grant', color: '#0e7490', sort_order: 21 },
  { code: 'QUESTION_EDIT', name_en: 'Question update (mobile)', description_en: 'Update existing questions/answers and move them between draft, quality check, and published from the mobile app — cannot create new questions', color: '#B45309', sort_order: 22 },
  { code: 'NOTICE', name_en: 'Notifications', description_en: 'Send broadcast or targeted push/in-app notifications to users', color: '#DC2626', sort_order: 23 },
  { code: 'QOTD', name_en: 'Questions of the Day', description_en: 'Daily subject-wise questions picked from the syllabus', color: '#0891B2', sort_order: 24 },
  { code: 'EXAM_ROUTINE', name_en: 'Exam Routine', description_en: 'Exam schedules with countdown and per-subject instructions', color: '#7C2D12', sort_order: 25 },
  { code: 'USER_QUESTIONS', name_en: 'Submitted Questions', description_en: 'Questions submitted by users for admin review and answer', color: '#4D7C0F', sort_order: 26 },
  { code: 'EXAM_WEEK', name_en: 'Exams of the Week', description_en: 'Practice papers featured weekly, published on a schedule', color: '#B91C1C', sort_order: 27 },
];

const MODULES = [
  ...PLATFORM_MODULES,
  { code: 'BUDGET_PREP', name_en: 'Budget Preparation', description_en: 'Annual budget planning', color: '#534AB7', sort_order: 1 },
  { code: 'BUDGET_EXEC', name_en: 'Budget Execution', description_en: 'Budget execution and monitoring', color: '#185FA5', sort_order: 2 },
  { code: 'ACCOUNTING', name_en: 'Accounting', description_en: 'Core accounting operations', color: '#1D9E75', sort_order: 3 },
  { code: 'GL', name_en: 'General Ledger', description_en: 'General ledger management', color: '#0F6E56', sort_order: 4 },
  { code: 'BILL', name_en: 'Online Bill Submission', description_en: 'Online submission of bills', color: '#185FA5', sort_order: 5 },
  { code: 'REPORTING', name_en: 'Financial Reporting', description_en: 'Financial reports and statements', color: '#854F0B', sort_order: 6 },
  { code: 'HR', name_en: 'HR & Payroll', description_en: 'Human resources and payroll', color: '#BA7517', sort_order: 7 },
  { code: 'ESERVICE', name_en: 'Citizen e-Services', description_en: 'Citizen-facing e-services', color: '#A32D2D', sort_order: 8 },
];

const ROLES = [
  { code: 'SDO', name_en: 'Self-Drawing Officer', description_en: 'Submits own bills', color: '#1D9E75', level: 1, can_submit: true },
  { code: 'DDO', name_en: 'Drawing & Disbursement Officer', description_en: 'Forwards bills, manages staff', color: '#185FA5', level: 2, can_forward: true },
  { code: 'AO', name_en: 'Accounts Office', description_en: 'Audits and approves bills', color: '#BA7517', level: 3, can_approve: true },
  { code: 'FD', name_en: 'Finance Division', description_en: 'Policy-level management', color: '#534AB7', level: 4, can_approve: true },
  { code: 'ADMIN', name_en: 'System Administrator', description_en: 'Full system access', color: '#A32D2D', level: 5, can_approve: true },
  { code: 'SYSTEM', name_en: 'Auto-processing', description_en: 'Automated system steps', color: '#888888', level: 0, is_system: true },
];

export async function seedSetupData() {
  for (const m of MODULES) {
    await Module.updateOne({ code: m.code }, { $set: { ...m, is_active: true } }, { upsert: true });
  }
  console.log(`Seeded ${MODULES.length} modules (${PLATFORM_MODULES.length} platform + ${MODULES.length - PLATFORM_MODULES.length} office)`);

  for (const r of ROLES) {
    await Role.updateOne(
      { code: r.code },
      {
        $set: {
          ...r,
          permissions: [],
          modules: [],
          can_submit: r.can_submit ?? false,
          can_forward: r.can_forward ?? false,
          can_approve: r.can_approve ?? false,
          is_system: r.is_system ?? false,
          is_active: true,
        },
      },
      { upsert: true },
    );
  }
  console.log(`Seeded ${ROLES.length} workflow roles`);

  let division = await Division.findOne({ short_code: 'DHK' });
  if (!division) {
    division = await Division.create({
      name_en: 'Dhaka',
      name_bn: 'ঢাকা',
      short_code: 'DHK',
      is_active: true,
    });
    console.log('Created division: Dhaka');
  }

  let district = await District.findOne({ short_code: 'DHK-D', division_id: division._id });
  if (!district) {
    district = await District.create({
      division_id: division._id,
      name_en: 'Dhaka',
      name_bn: 'ঢাকা',
      short_code: 'DHK-D',
      is_active: true,
    });
    console.log('Created district: Dhaka');
  }

  const thanaExists = await Thana.findOne({ short_code: 'DHK-T', district_id: district._id });
  if (!thanaExists) {
    await Thana.create({
      district_id: district._id,
      name_en: 'Ramna',
      name_bn: 'রমনা',
      short_code: 'DHK-T',
      is_active: true,
    });
    console.log('Created thana: Ramna');
  }
}
