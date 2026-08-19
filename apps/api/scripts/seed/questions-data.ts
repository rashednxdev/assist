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
  {
    name: 'Differences',
    code: 'DIFFERENCES',
    has_options: false,
    note: 'Compare two or more items in a feature table (model answer)',
  },
  {
    name: 'Translation',
    code: 'TRANSLATION',
    has_options: false,
    note: 'Translate a passage; model answer required for marking',
  },
  {
    name: 'Summary',
    code: 'SUMMARY',
    has_options: false,
    note: 'Summarise a passage; model answer required for marking',
  },
  {
    name: 'Drafting',
    code: 'DRAFTING',
    has_options: false,
    note: 'Draft a note, letter, or official text; model answer required for marking',
  },
  {
    name: 'Calculation',
    code: 'CALCULATION',
    has_options: false,
    note: 'Numeric or working-out answer; model answer required for marking',
  },
] as const;

export async function ensureQuestionTypes() {
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

  // Combined "Summary & Drafting" was split into SUMMARY and DRAFTING.
  const combined = await QuestionType.find({
    $or: [{ code: 'SUMMARY_DRAFTING' }, { name: /^Summary\s*&\s*Drafting$/i }],
  });
  for (const row of combined) {
    if (row.code === 'SUMMARY' || row.code === 'DRAFTING') continue;
    if (row.is_active) {
      row.is_active = false;
      await row.save();
      console.log(`Deactivated legacy question type: ${row.name} (${row.code})`);
    }
  }

  // Remove legacy singular "Difference" (keep "Differences")
  const legacy = await QuestionType.find({
    $or: [{ name: /^Difference$/i }, { code: /^DIFFERENCE$/i }, { code: 'DF' }],
  });
  for (const row of legacy) {
    if (row.code === 'DIFFERENCES' || row.name === 'Differences') continue;
    if (row.is_active) {
      row.is_active = false;
      await row.save();
      console.log(`Deactivated legacy question type: ${row.name} (${row.code})`);
    }
  }

  await deactivateUnusedDuplicateTypes();

  return map;
}

function normalizeTypeName(name: string) {
  return name.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

/**
 * Hide duplicate types that share a display name (e.g. two "Descriptive") when the extra
 * row has no questions. Keeps the standard-code type, or the one that is actually in use.
 */
async function deactivateUnusedDuplicateTypes() {
  const standardCodes = new Set(STANDARD_TYPES.map((t) => t.code));
  const active = await QuestionType.find({ is_active: true });
  const counts = await Question.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: { is_active: true } },
    { $group: { _id: '$question_type_id', count: { $sum: 1 } } },
  ]);
  const countById = new Map(counts.map((c) => [String(c._id), c.count]));
  const countFor = (id: string) => countById.get(id) ?? 0;

  const groups = new Map<string, typeof active>();
  for (const t of active) {
    const key = normalizeTypeName(t.name);
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => {
      const byCount = countFor(String(b._id)) - countFor(String(a._id));
      if (byCount !== 0) return byCount;
      const aStd = standardCodes.has(a.code) ? 0 : 1;
      const bStd = standardCodes.has(b.code) ? 0 : 1;
      return aStd - bStd;
    });
    const keep = group[0]!;
    for (const extra of group.slice(1)) {
      if (countFor(String(extra._id)) > 0) continue;
      extra.is_active = false;
      await extra.save();
      console.log(
        `Deactivated unused duplicate type: ${extra.name} (${extra.code}) — kept ${keep.name} (${keep.code})`,
      );
    }
  }
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
      explanation_sections: [
        {
          title: 'Classification rule',
          details:
            'GFR Rule 45 requires that all government receipts be classified under the appropriate minor head of account as prescribed in the Chart of Accounts.',
          note: 'Linked to GFR Rule 45 — Classification of Receipts',
          subsections: [],
        },
      ],
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
      explanation_sections: [
        {
          title: 'Same-day entry',
          details: 'Rule 45 detail requires same-day cash book entry by the receiving officer.',
          subsections: [],
        },
      ],
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
      model_answer_sections: [
        {
          title: 'Daily reconciliation',
          details:
            'The DDO shall reconcile daily receipts with the treasury challan before close of business, ensuring amounts and account heads match official records.',
          subsections: [],
        },
      ],
      note: 'Expect 2–4 sentences in exam answers.',
      reference_regulation_id: regulation?._id,
    });
    console.log('Created sample short note for GFR Rule 45(1)');
  }
}
