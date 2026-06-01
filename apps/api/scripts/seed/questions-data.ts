import mongoose from 'mongoose';
import { QuestionType } from '../../src/domains/questions/models/QuestionType.model.js';
import { Question } from '../../src/domains/questions/models/Question.model.js';
import { QuestionOption } from '../../src/domains/questions/models/QuestionOption.model.js';
import { QuestionAnswer } from '../../src/domains/questions/models/QuestionAnswer.model.js';
import { QuestionAnswerDetail } from '../../src/domains/questions/models/QuestionAnswerDetail.model.js';
import { BookInfo } from '../../src/domains/books/models/BookInfo.model.js';
import { BookChapter } from '../../src/domains/books/models/BookChapter.model.js';
import { BookTopic } from '../../src/domains/books/models/BookTopic.model.js';
import { BookSubTopic } from '../../src/domains/books/models/BookSubTopic.model.js';
import { Regulation } from '../../src/domains/books/models/Regulation.model.js';
import { User } from '../../src/domains/users/models/User.model.js';

const STANDARD_TYPES = [
  {
    name: 'Multiple Choice (MCQ)',
    code: 'MCQ',
    has_options: true,
    note: 'Single correct answer from multiple options (a–e)',
  },
  {
    name: 'True or False',
    code: 'TF',
    has_options: true,
    note: 'Statement marked true or false',
  },
  {
    name: 'Descriptive',
    code: 'DESCRIPTIVE',
    has_options: false,
    note: 'Long-form written answer; model answer required for marking',
  },
  {
    name: 'Short note',
    code: 'SHORT_NOTE',
    has_options: false,
    note: 'Brief written answer (typically 2–5 sentences)',
  },
] as const;

async function ensureQuestionTypes() {
  const map = new Map<string, InstanceType<typeof QuestionType>>();
  for (const t of STANDARD_TYPES) {
    let row = await QuestionType.findOne({ code: t.code });
    if (!row) {
      row = await QuestionType.create({ ...t, is_active: true });
      console.log(`Created question type: ${t.code}`);
    } else {
      row.name = t.name;
      row.has_options = t.has_options;
      row.note = t.note;
      await row.save();
    }
    map.set(t.code, row);
  }
  return map;
}

export async function seedQuestionsData() {
  const types = await ensureQuestionTypes();
  const mcqType = types.get('MCQ')!;
  const tfType = types.get('TF')!;
  const shortType = types.get('SHORT_NOTE')!;

  const admin = await User.findOne({ email: process.env.SEED_ADMIN_EMAIL ?? 'admin@ibas.gov.bd' });
  if (!admin) {
    console.log('Skipping question seed — admin user not found');
    return;
  }

  const book = await BookInfo.findOne({ short_name: 'GFR' });
  if (!book) {
    console.log('Skipping question seed — GFR book not found (run books seed first)');
    return;
  }

  const chapter = await BookChapter.findOne({ book_info_id: book._id, chapter_number: 'IV' });
  const topic = chapter
    ? await BookTopic.findOne({ book_chapter_id: chapter._id, rule_number: '45' })
    : null;
  const subTopic = topic ? await BookSubTopic.findOne({ book_topic_id: topic._id }) : null;
  const regulation = await Regulation.findOne({ regulation_no: 'GFR-45' });

  if (!chapter || !topic) {
    console.log('Skipping question seed — GFR Rule 45 topic not found');
    return;
  }

  if (!(await Question.findOne({ body_en: /Classification of Receipts under GFR Rule 45/i }))) {
    const question = await Question.create({
      question_type_id: mcqType._id,
      question_type_code: mcqType.code,
      book_chapter_id: chapter._id,
      book_topic_id: topic._id,
      regulation_id: regulation?._id,
      body_en:
        'Under GFR Rule 45, how should all moneys received by or on behalf of the Government be classified?',
      body_bn:
        'জিএফআর নিয়ম ৪৫ অনুযায়ী, সরকারের পক্ষে বা সরকারের নামে প্রাপ্ত সমস্ত অর্থ কীভাবে শ্রেণীবদ্ধ করা উচিত?',
      difficulty: 'medium',
      marks: 1,
      negative_marks: 0.25,
      time_seconds: 60,
      is_published: true,
      is_active: true,
      language: 'both',
      created_by: admin._id,
      reviewed_by: admin._id,
    });

    const options = await QuestionOption.insertMany([
      {
        question_id: question._id,
        option_key: 'a',
        option_text_en: 'Under the appropriate minor head of account per the Chart of Accounts',
        option_text_bn: 'হিসাবের চার্ট অনুযায়ী যথাযথ উপ-শিরোনামে',
      },
      {
        question_id: question._id,
        option_key: 'b',
        option_text_en: 'Under a single consolidated receipt head for all offices',
        option_text_bn: 'সকল দপ্তরের জন্য একটি একীভূত প্রাপ্তি শিরোনামে',
      },
      {
        question_id: question._id,
        option_key: 'c',
        option_text_en: 'At the discretion of the receiving officer without classification',
        option_text_bn: 'শ্রেণীবিভাগ ছাড়াই গ্রহণকারী কর্মকর্তার বিবেচনায়',
      },
      {
        question_id: question._id,
        option_key: 'd',
        option_text_en: 'Only when the amount exceeds the treasury threshold',
        option_text_bn: 'শুধুমাত্র ট্রেজারি সীমা অতিক্রম করলে',
      },
    ]);

    const correctOption = options.find((o) => o.option_key === 'a')!;
    await QuestionAnswer.insertMany(
      options.map((o) => ({
        question_id: question._id,
        option_id: o._id,
        is_correct: String(o._id) === String(correctOption._id),
      })),
    );

    await QuestionAnswerDetail.create({
      question_id: question._id,
      explanation:
        'GFR Rule 45 requires that all government receipts be classified under the appropriate minor head of account as prescribed in the Chart of Accounts.',
      note: 'Linked to GFR Rule 45 — Classification of Receipts',
      reference_regulation_id: regulation?._id,
    });
    console.log('Created sample MCQ for GFR Rule 45');
  }

  if (!(await Question.findOne({ body_en: /receiving officer enter receipts in the cash book on the same day/i }))) {
    const tfQuestion = await Question.create({
      question_type_id: tfType._id,
      question_type_code: tfType.code,
      book_chapter_id: chapter._id,
      book_topic_id: topic._id,
      book_sub_topic_id: subTopic?._id,
      body_en: 'The receiving officer must enter receipts in the cash book on the same day they are received.',
      body_bn: 'গ্রহণকারী কর্মকর্তাকে অর্থ প্রাপ্তির একই দিনে ক্যাশ বুকে তা লিপিবদ্ধ করতে হবে।',
      difficulty: 'easy',
      marks: 1,
      time_seconds: 30,
      is_published: true,
      is_active: true,
      language: 'both',
      created_by: admin._id,
      reviewed_by: admin._id,
    });

    const tfOptions = await QuestionOption.insertMany([
      { question_id: tfQuestion._id, option_key: 'a', option_text_en: 'True', option_text_bn: 'সঠিক' },
      { question_id: tfQuestion._id, option_key: 'b', option_text_en: 'False', option_text_bn: 'ভুল' },
    ]);
    const trueOpt = tfOptions.find((o) => o.option_key === 'a')!;
    await QuestionAnswer.insertMany(
      tfOptions.map((o) => ({
        question_id: tfQuestion._id,
        option_id: o._id,
        is_correct: String(o._id) === String(trueOpt._id),
      })),
    );
    await QuestionAnswerDetail.create({
      question_id: tfQuestion._id,
      explanation: 'Rule 45 detail requires same-day cash book entry by the receiving officer.',
      reference_regulation_id: regulation?._id,
    });
    console.log('Created sample True/False for GFR Rule 45 sub-rule');
  }

  if (!(await Question.findOne({ body_en: /Explain daily reconciliation under GFR Rule 45/i }))) {
    const shortQ = await Question.create({
      question_type_id: shortType._id,
      question_type_code: shortType.code,
      book_chapter_id: chapter._id,
      book_topic_id: topic._id,
      body_en: 'Explain daily reconciliation under GFR Rule 45(1) in brief.',
      body_bn: 'জিএফআর নিয়ম ৪৫(১) অনুযায়ী দৈনিক সমন্বয় সংক্ষেপে ব্যাখ্যা করুন।',
      difficulty: 'medium',
      marks: 3,
      time_seconds: 180,
      is_published: true,
      is_active: true,
      language: 'both',
      created_by: admin._id,
      reviewed_by: admin._id,
    });
    await QuestionAnswerDetail.create({
      question_id: shortQ._id,
      explanation:
        'The DDO shall reconcile daily receipts with the treasury challan before close of business, ensuring amounts and account heads match official records.',
      note: 'Expect 2–4 sentences in exam answers.',
      reference_regulation_id: regulation?._id,
    });
    console.log('Created sample short note for GFR Rule 45(1)');
  }
}
