import { PaperType } from '../../src/domains/papers/models/PaperType.model.js';
import { PaperDetail } from '../../src/domains/papers/models/PaperDetail.model.js';
import { PaperGroup } from '../../src/domains/papers/models/PaperGroup.model.js';
import { PaperQuestion } from '../../src/domains/papers/models/PaperQuestion.model.js';
import { ExamSubject } from '../../src/domains/exams/models/ExamSubject.model.js';
import { ExamPart } from '../../src/domains/exams/models/ExamPart.model.js';
import { ExamName } from '../../src/domains/exams/models/ExamName.model.js';
import { ExamSession } from '../../src/domains/exams/models/ExamSession.model.js';
import { Question } from '../../src/domains/questions/models/Question.model.js';
import { User } from '../../src/domains/users/models/User.model.js';

const PAPER_TYPES = [
  { name: 'Practice', code: 'PRACTICE', description: 'Practice / model test paper' },
  { name: 'Regular', code: 'REGULAR', description: 'Official examination paper' },
  { name: 'Mock', code: 'MOCK', description: 'Mock test for preparation' },
] as const;

export async function seedPapersData() {
  for (const t of PAPER_TYPES) {
    let row = await PaperType.findOne({ code: t.code });
    if (!row) {
      row = await PaperType.create({ ...t, is_active: true });
      console.log(`Created paper type: ${t.code}`);
    }
  }

  const practiceType = await PaperType.findOne({ code: 'PRACTICE' });
  const admin = await User.findOne({ email: process.env.SEED_ADMIN_EMAIL ?? 'admin@ibas.gov.bd' });
  const subject = await ExamSubject.findOne({ name: /Financial Rules/i });

  if (!practiceType || !admin || !subject) {
    console.log('Skipping paper seed — prerequisites missing (run exams/questions seed first)');
    return;
  }

  const part = await ExamPart.findById(subject.exam_part_id);
  const exam = part ? await ExamName.findById(part.exam_name_id) : null;
  if (!exam) {
    console.log('Skipping paper seed — exam name not found for subject');
    return;
  }

  let session = await ExamSession.findOne({ exam_name_id: exam._id, label_en: '2025' });
  if (!session) {
    session = await ExamSession.create({
      exam_name_id: exam._id,
      label_en: '2025',
      label_bn: '২০২৫',
      sort_order: 2025,
      is_active: true,
      created_at: new Date(),
    });
    console.log('Created exam session: 2025');
  }

  let paper = await PaperDetail.findOne({ name: /GFR Practice Paper/i, exam_subject_id: subject._id });
  if (!paper) {
    paper = await PaperDetail.create({
      exam_subject_id: subject._id,
      paper_type_id: practiceType._id,
      exam_session_id: session._id,
      session_year: '2025',
      name: 'GFR Practice Paper — Receipts & Payments',
      total_marks: 5,
      pass_marks: 2,
      duration_minutes: 30,
      instructions: 'Answer all questions. MCQ carries negative marking where indicated.',
      is_published: false,
      is_active: true,
      created_by: admin._id,
      created_at: new Date(),
    });
    console.log('Created GFR practice paper');
  }

  let groupA = await PaperGroup.findOne({ paper_id: paper._id, group_number: 1 });
  if (!groupA) {
    groupA = await PaperGroup.create({
      paper_id: paper._id,
      name: 'Section A — Objective',
      group_number: 1,
      marks: 2,
      instructions: 'Answer all MCQ and True/False questions.',
      is_active: true,
    });
  }

  let groupB = await PaperGroup.findOne({ paper_id: paper._id, group_number: 2 });
  if (!groupB) {
    groupB = await PaperGroup.create({
      paper_id: paper._id,
      name: 'Section B — Short notes',
      group_number: 2,
      marks: 3,
      instructions: 'Answer in brief.',
      is_active: true,
    });
  }

  const mcq = await Question.findOne({ body_en: /Classification of Receipts under GFR Rule 45/i });
  const tf = await Question.findOne({ body_en: /receiving officer enter receipts in the cash book on the same day/i });
  const shortQ = await Question.findOne({ body_en: /Explain daily reconciliation under GFR Rule 45/i });

  if (mcq && !(await PaperQuestion.findOne({ paper_id: paper._id, question_id: mcq._id }))) {
    await PaperQuestion.create({
      paper_id: paper._id,
      paper_group_id: groupA._id,
      question_id: mcq._id,
      question_number: 1,
      marks: 1,
      is_compulsory: true,
      is_active: true,
    });
  }

  if (tf && !(await PaperQuestion.findOne({ paper_id: paper._id, question_id: tf._id }))) {
    await PaperQuestion.create({
      paper_id: paper._id,
      paper_group_id: groupA._id,
      question_id: tf._id,
      question_number: 2,
      marks: 1,
      is_compulsory: true,
      is_active: true,
    });
  }

  if (shortQ && !(await PaperQuestion.findOne({ paper_id: paper._id, question_id: shortQ._id }))) {
    await PaperQuestion.create({
      paper_id: paper._id,
      paper_group_id: groupB._id,
      question_id: shortQ._id,
      question_number: 3,
      marks: 3,
      is_compulsory: true,
      is_active: true,
    });
  }

  console.log('Paper seed complete (5 marks — publish from composer when ready)');
}
