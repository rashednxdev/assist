import { Department } from '../../src/domains/exams/models/Department.model.js';
import { Authority } from '../../src/domains/exams/models/Authority.model.js';
import { ExamName } from '../../src/domains/exams/models/ExamName.model.js';
import { ExamPart } from '../../src/domains/exams/models/ExamPart.model.js';
import { ExamType } from '../../src/domains/exams/models/ExamType.model.js';
import { ExamSubject } from '../../src/domains/exams/models/ExamSubject.model.js';
import { SyllabusGroup } from '../../src/domains/syllabus/models/SyllabusGroup.model.js';
import { SyllabusTopic } from '../../src/domains/syllabus/models/SyllabusTopic.model.js';
import { SyllabusSubTopic } from '../../src/domains/syllabus/models/SyllabusSubTopic.model.js';
import { SyllabusReference } from '../../src/domains/syllabus/models/SyllabusReference.model.js';
import { BookInfo } from '../../src/domains/books/models/BookInfo.model.js';
import { BookChapter } from '../../src/domains/books/models/BookChapter.model.js';
import { BookTopic } from '../../src/domains/books/models/BookTopic.model.js';
import { Regulation } from '../../src/domains/books/models/Regulation.model.js';

export async function seedExamsData() {
  let dept = await Department.findOne({ short_name: 'CAG' });
  if (!dept) {
    dept = await Department.create({
      name: 'Office of the Comptroller and Auditor General of Bangladesh',
      short_name: 'CAG',
      location: 'Dhaka',
      website: 'https://www.cag.org.bd',
      is_active: true,
    });
    console.log('Created department: CAG');
  }

  let authority = await Authority.findOne({ name: /SAS Examination Board/i });
  if (!authority) {
    authority = await Authority.create({
      department_id: dept._id,
      name: 'SAS Examination Board',
      authority_type: 'central',
      description: 'Conducts Subordinate Accounts Service (SAS) examinations for government accounts personnel.',
      contact_email: 'sas@cag.org.bd',
      is_active: true,
    });
    console.log('Created authority: SAS Examination Board');
  }

  let exam = await ExamName.findOne({ short_name: 'SAS' });
  if (!exam) {
    exam = await ExamName.create({
      authority_id: authority._id,
      name: 'Subordinate Accounts Service (SAS) Examination',
      short_name: 'SAS',
      goal: 'Recruit qualified accounts personnel for government audit and accounts offices.',
      description:
        '<p>The SAS examination tests knowledge of government financial rules, accounting procedures, and audit compliance.</p>',
      eligibility_criteria: 'Bachelor degree with accounts/finance background; minimum 2 years service.',
      passing_criteria: 'Minimum 40% in each subject and 50% aggregate in Part I Written.',
      total_attempts_allowed: 3,
      registration_fee: 500,
      is_active: true,
      created_at: new Date(),
    });
    console.log('Created exam: SAS');
  }

  let part = await ExamPart.findOne({ exam_name_id: exam._id, part_number: 1 });
  if (!part) {
    part = await ExamPart.create({
      exam_name_id: exam._id,
      name: 'Part I — Written',
      part_number: 1,
      description: '<p>Written examination covering financial rules and accounting.</p>',
      total_marks: 200,
      pass_marks: 100,
      qualifier_outline: 'Candidates must pass Part I to proceed to viva.',
      is_active: true,
    });
    console.log('Created exam part: Part I Written');
  }

  let examType = await ExamType.findOne({ exam_name_id: exam._id, code: 'WRITTEN' });
  if (!examType) {
    examType = await ExamType.create({
      exam_name_id: exam._id,
      name: 'Written',
      code: 'WRITTEN',
      description: 'Objective and descriptive written paper.',
      total_marks: 100,
      pass_marks: 40,
      total_time: 180,
      is_active: true,
    });
    console.log('Created exam type: Written');
  }

  let subject = await ExamSubject.findOne({ exam_part_id: part._id, name: /Financial Rules/i });
  if (!subject) {
    subject = await ExamSubject.create({
      exam_part_id: part._id,
      exam_type_id: examType._id,
      name: 'Government Financial Rules (GFR)',
      total_marks: 100,
      pass_marks: 40,
      is_active: true,
    });
    console.log('Created exam subject: GFR');
  }

  // Syllabus for GFR subject
  let group = await SyllabusGroup.findOne({ exam_subject_id: subject._id, name: /Core GFR/i });
  if (!group) {
    group = await SyllabusGroup.create({
      exam_subject_id: subject._id,
      name: 'Core GFR — Receipts & Payments',
      marks_allocated: 40,
      sort_order: 1,
      is_active: true,
    });

    const topic1 = await SyllabusTopic.create({
      syllabus_group_id: group._id,
      name: 'Classification of Receipts (Rule 45)',
      description: 'Chart of accounts, daily cash book entry, treasury reconciliation.',
      marks_weightage: 20,
      sort_order: 1,
      is_active: true,
    });

    await SyllabusSubTopic.create({
      syllabus_topic_id: topic1._id,
      name: 'Daily reconciliation (Rule 45(1))',
      description: 'DDO reconciliation with treasury challan.',
      sort_order: 1,
      is_active: true,
    });

    const topic2 = await SyllabusTopic.create({
      syllabus_group_id: group._id,
      name: 'Classification of Payments (Rule 46)',
      description: 'Charging payments to correct account heads.',
      marks_weightage: 20,
      sort_order: 2,
      is_active: true,
    });

    const book = await BookInfo.findOne({ short_name: 'GFR' });
    if (book) {
      const chapter = await BookChapter.findOne({ book_info_id: book._id, chapter_number: 'IV' });
      const rule45 = chapter
        ? await BookTopic.findOne({ book_chapter_id: chapter._id, rule_number: '45' })
        : null;
      const rule46 = chapter
        ? await BookTopic.findOne({ book_chapter_id: chapter._id, rule_number: '46' })
        : null;
      const regulation = await Regulation.findOne({ regulation_no: 'GFR-45' });

      if (chapter && rule45) {
        await SyllabusReference.create({
          syllabus_topic_id: topic1._id,
          exam_subject_id: subject._id,
          book_info_id: book._id,
          book_chapter_id: chapter._id,
          book_topic_id: rule45._id,
          regulation_id: regulation?._id,
          relevance_note: 'Primary syllabus reference for receipt classification.',
        });
      }
      if (chapter && rule46) {
        await SyllabusReference.create({
          syllabus_topic_id: topic2._id,
          exam_subject_id: subject._id,
          book_info_id: book._id,
          book_chapter_id: chapter._id,
          book_topic_id: rule46._id,
          relevance_note: 'Payment classification under GFR Rule 46.',
        });
      }
    }

    console.log('Created SAS GFR syllabus with book references');
  }
}
