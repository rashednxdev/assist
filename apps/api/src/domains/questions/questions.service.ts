import mongoose from 'mongoose';
import type {
  BatchDescriptiveImportDto,
  BatchDifferencesImportDto,
  BatchMcqImportDto,
  CreateQuestionDto,
  CreateQuestionTypeDto,
  QuestionBookLinkInput,
  QuestionSyncDeletion,
  QuestionSyncRow,
  UpdateQuestionDto,
  UpdateQuestionTypeDto,
} from '@ibas/shared-types';
import {
  cleanExplanationSections,
  cleanComparisonTable,
  hasComparisonTableContent,
  parseLegacyExplanation,
  serializeComparisonTable,
  serializeExplanationSections,
  type ComparisonTable,
  type ExplanationSection,
} from '@ibas/shared-types';
import { BookChapter } from '../books/models/BookChapter.model.js';
import { BookInfo } from '../books/models/BookInfo.model.js';
import { BookSubTopic } from '../books/models/BookSubTopic.model.js';
import { BookTopic } from '../books/models/BookTopic.model.js';
import { QuestionType } from './models/QuestionType.model.js';
import { Question } from './models/Question.model.js';
import { QuestionBookLink } from './models/QuestionBookLink.model.js';
import { QuestionOption } from './models/QuestionOption.model.js';
import { QuestionAnswer } from './models/QuestionAnswer.model.js';
import {
  QuestionAnswerDetail,
  type IQuestionAnswerDetail,
} from './models/QuestionAnswerDetail.model.js';
import { UserQuestionEvaluation } from '../evaluation/models/UserQuestionEvaluation.model.js';
import { QuestionDeletion } from './models/QuestionDeletion.model.js';
import { PaperQuestion } from '../papers/models/PaperQuestion.model.js';
import { ChildQuestion } from '../papers/models/ChildQuestion.model.js';
import { User } from '../users/models/User.model.js';
import { notFound, badRequest } from '../../shared/errors/AppError.js';
import { escapeRegex, normalizeQuestionText, queryWordMatchScore } from './question-similarity.js';

const TF_OPTIONS = [
  { option_key: 'a' as const, option_text_en: 'True', option_text_bn: 'সঠিক' },
  { option_key: 'b' as const, option_text_en: 'False', option_text_bn: 'ভুল' },
];

function idStr(v: mongoose.Types.ObjectId | string | undefined) {
  return v ? String(v) : undefined;
}

function isTrueFalseType(code: string) {
  return code === 'TF';
}

function isMcqOrTf(code: string) {
  return code === 'MCQ' || code === 'TF';
}

function isDifferencesType(code: string) {
  return code === 'DIFFERENCES';
}

interface AnswerDetailInput {
  /** Omit to leave existing sections unchanged; pass [] to clear. */
  explanation_sections?: ExplanationSection[];
  model_answer_sections?: ExplanationSection[];
  /** Omit to leave unchanged; pass null/undefined after explicit clear via empty cleaned table. */
  model_answer_comparison?: ComparisonTable | null;
  model_answer?: string;
  note?: string;
  reference_regulation_id?: string;
}

async function loadExplanationSections(
  questionId: mongoose.Types.ObjectId,
  detail: IQuestionAnswerDetail | null,
): Promise<ExplanationSection[]> {
  const fromDetail = serializeExplanationSections(detail?.explanation_sections);
  if (fromDetail.length > 0) return fromDetail;

  if (typeof detail?.explanation === 'string' && detail.explanation.trim()) {
    return parseLegacyExplanation(detail.explanation);
  }

  const raw = await mongoose.connection
    .collection('question_answer_details')
    .findOne({ question_id: questionId }, { projection: { explanation: 1, explanation_sections: 1 } });

  const rawSections = serializeExplanationSections(
    raw?.explanation_sections as ExplanationSection[] | undefined,
  );
  if (rawSections.length > 0) return rawSections;

  if (typeof raw?.explanation === 'string' && raw.explanation.trim()) {
    return parseLegacyExplanation(raw.explanation);
  }

  return [];
}

async function loadModelAnswerSections(
  questionId: mongoose.Types.ObjectId,
  detail: IQuestionAnswerDetail | null,
): Promise<ExplanationSection[]> {
  const fromDetail = serializeExplanationSections(detail?.model_answer_sections);
  if (fromDetail.length > 0) return fromDetail;

  if (typeof detail?.model_answer === 'string' && detail.model_answer.trim()) {
    return parseLegacyExplanation(detail.model_answer);
  }

  const raw = await mongoose.connection
    .collection('question_answer_details')
    .findOne({ question_id: questionId }, { projection: { model_answer: 1, model_answer_sections: 1 } });

  const rawSections = serializeExplanationSections(
    raw?.model_answer_sections as ExplanationSection[] | undefined,
  );
  if (rawSections.length > 0) return rawSections;

  if (typeof raw?.model_answer === 'string' && raw.model_answer.trim()) {
    return parseLegacyExplanation(raw.model_answer);
  }

  return [];
}

function comparisonFromUnknown(value: unknown): ComparisonTable | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as ComparisonTable;
  return serializeComparisonTable({
    title: raw.title,
    feature_header: raw.feature_header,
    columns: Array.isArray(raw.columns) ? raw.columns.map(String) : [],
    rows: Array.isArray(raw.rows)
      ? raw.rows.map((row) => ({
          feature: String(row?.feature ?? ''),
          values: Array.isArray(row?.values) ? row.values.map((v) => String(v ?? '')) : [],
        }))
      : [],
  });
}

async function loadComparisonTable(
  questionId: mongoose.Types.ObjectId,
  detail: IQuestionAnswerDetail | null,
): Promise<ComparisonTable | undefined> {
  const fromDetail = comparisonFromUnknown(detail?.model_answer_comparison);
  if (fromDetail) return fromDetail;

  const raw = await mongoose.connection
    .collection('question_answer_details')
    .findOne({ question_id: questionId }, { projection: { model_answer_comparison: 1 } });

  return comparisonFromUnknown(raw?.model_answer_comparison);
}

function linksFromDto(dto: CreateQuestionDto | UpdateQuestionDto): QuestionBookLinkInput[] | undefined {
  if (dto.book_links !== undefined) return dto.book_links;
  if (dto.link_level && dto.book_chapter_id) {
    return [
      {
        link_level: dto.link_level,
        book_chapter_id: dto.book_chapter_id,
        book_topic_id: dto.book_topic_id,
        book_sub_topic_id: dto.book_sub_topic_id,
        regulation_id: dto.regulation_id,
      },
    ];
  }
  return undefined;
}

function syncPrimaryBookFields(question: InstanceType<typeof Question>, link?: QuestionBookLinkInput | null) {
  if (!link?.book_chapter_id) {
    question.book_chapter_id = undefined;
    question.book_topic_id = undefined;
    question.book_sub_topic_id = undefined;
    question.regulation_id = undefined;
    return;
  }
  question.book_chapter_id = new mongoose.Types.ObjectId(link.book_chapter_id);
  question.book_topic_id = link.book_topic_id ? new mongoose.Types.ObjectId(link.book_topic_id) : undefined;
  question.book_sub_topic_id = link.book_sub_topic_id
    ? new mongoose.Types.ObjectId(link.book_sub_topic_id)
    : undefined;
  question.regulation_id = link.regulation_id ? new mongoose.Types.ObjectId(link.regulation_id) : undefined;
  if (link.link_level === 'chapter') {
    question.book_topic_id = undefined;
    question.book_sub_topic_id = undefined;
  } else if (link.link_level === 'rule') {
    question.book_sub_topic_id = undefined;
  }
}

async function ensureLegacyBookLink(question: InstanceType<typeof Question>) {
  const count = await QuestionBookLink.countDocuments({ question_id: question._id, is_active: true });
  if (count > 0 || !question.book_chapter_id) return;
  let linkLevel: QuestionBookLinkInput['link_level'] = 'chapter';
  if (question.book_sub_topic_id) linkLevel = 'sub_rule';
  else if (question.book_topic_id) linkLevel = 'rule';
  await QuestionBookLink.create({
    question_id: question._id,
    link_level: linkLevel,
    book_chapter_id: question.book_chapter_id,
    book_topic_id: question.book_topic_id,
    book_sub_topic_id: question.book_sub_topic_id,
    regulation_id: question.regulation_id,
    sort_order: 0,
    is_active: true,
  });
}

async function serializeBookLink(link: InstanceType<typeof QuestionBookLink>) {
  const topic = link.book_topic_id ? await BookTopic.findById(link.book_topic_id) : null;
  const subTopic = link.book_sub_topic_id ? await BookSubTopic.findById(link.book_sub_topic_id) : null;

  let chapter = link.book_chapter_id ? await BookChapter.findById(link.book_chapter_id) : null;
  if (!chapter && topic?.book_chapter_id) {
    chapter = await BookChapter.findById(topic.book_chapter_id);
  }
  if (!chapter && subTopic?.book_topic_id) {
    const topicFromSub = await BookTopic.findById(subTopic.book_topic_id);
    if (topicFromSub?.book_chapter_id) {
      chapter = await BookChapter.findById(topicFromSub.book_chapter_id);
    }
  }

  const book = chapter ? await BookInfo.findById(chapter.book_info_id) : null;
  const bookId = book ? String(book._id) : undefined;
  const parts: string[] = [];
  if (book) parts.push(book.short_name || book.name);
  if (chapter) parts.push(`Ch. ${chapter.chapter_number} ${chapter.name}`.trim());
  if (topic) parts.push(topic.rule_number ? `Rule ${topic.rule_number}` : topic.name || 'Rule');
  if (subTopic) parts.push(subTopic.rule_number || subTopic.name || 'Sub-rule');
  return {
    id: String(link._id),
    link_level: link.link_level,
    book_id: bookId,
    book_name: book?.name,
    book_chapter_id: idStr(link.book_chapter_id ?? chapter?._id),
    chapter_number: chapter?.chapter_number,
    chapter_name: chapter?.name,
    book_topic_id: idStr(link.book_topic_id ?? topic?._id ?? subTopic?.book_topic_id),
    book_sub_topic_id: idStr(link.book_sub_topic_id),
    regulation_id: idStr(link.regulation_id),
    label: parts.join(' › '),
  };
}

async function loadSerializedBookLinks(questionId: mongoose.Types.ObjectId | string) {
  const links = await QuestionBookLink.find({ question_id: questionId, is_active: true }).sort({
    sort_order: 1,
  });
  return Promise.all(links.map((link) => serializeBookLink(link)));
}

function bookLinkPointKey(link: QuestionBookLinkInput): string {
  if (link.link_level === 'sub_rule' && link.book_sub_topic_id) {
    return `sub:${link.book_sub_topic_id}`;
  }
  if (link.link_level === 'rule' && link.book_topic_id) {
    return `rule:${link.book_topic_id}`;
  }
  return `chapter:${link.book_chapter_id}`;
}

function assertNoDuplicateBookLinksInList(links: QuestionBookLinkInput[]) {
  const seen = new Set<string>();
  for (const link of links) {
    const key = bookLinkPointKey(link);
    if (seen.has(key)) {
      throw badRequest('This question cannot be linked to the same book location more than once.');
    }
    seen.add(key);
  }
}

async function assertBookLinkPointUnique(
  questionId: string | mongoose.Types.ObjectId,
  dto: QuestionBookLinkInput,
  excludeLinkId?: string,
) {
  const query: Record<string, unknown> = {
    question_id: new mongoose.Types.ObjectId(String(questionId)),
    link_level: dto.link_level,
    is_active: true,
  };
  if (dto.link_level === 'chapter') {
    query.book_chapter_id = new mongoose.Types.ObjectId(dto.book_chapter_id);
  } else if (dto.link_level === 'rule') {
    query.book_topic_id = new mongoose.Types.ObjectId(dto.book_topic_id!);
  } else if (dto.link_level === 'sub_rule') {
    query.book_sub_topic_id = new mongoose.Types.ObjectId(dto.book_sub_topic_id!);
  }
  if (excludeLinkId) {
    query._id = { $ne: new mongoose.Types.ObjectId(excludeLinkId) };
  }
  const existing = await QuestionBookLink.findOne(query);
  if (existing) {
    throw badRequest('This question is already linked to that book location.');
  }
}

async function saveBookLinks(
  questionId: mongoose.Types.ObjectId,
  links: QuestionBookLinkInput[],
  question: InstanceType<typeof Question>,
) {
  await QuestionBookLink.updateMany({ question_id: questionId }, { is_active: false });
  const activeLinks = links.filter((l) => l.link_level && l.book_chapter_id);
  assertNoDuplicateBookLinksInList(activeLinks);
  for (let i = 0; i < activeLinks.length; i++) {
    const l = activeLinks[i]!;
    await QuestionBookLink.create({
      question_id: questionId,
      link_level: l.link_level,
      book_chapter_id: new mongoose.Types.ObjectId(l.book_chapter_id),
      book_topic_id: l.book_topic_id ? new mongoose.Types.ObjectId(l.book_topic_id) : undefined,
      book_sub_topic_id: l.book_sub_topic_id ? new mongoose.Types.ObjectId(l.book_sub_topic_id) : undefined,
      regulation_id: l.regulation_id ? new mongoose.Types.ObjectId(l.regulation_id) : undefined,
      sort_order: i,
      is_active: true,
    });
  }
  syncPrimaryBookFields(question, activeLinks[0] ?? null);
}

function serializeQuestionListItem(
  q: InstanceType<typeof Question>,
  typeName: string | undefined,
  optionCount: number,
  statusByName?: string,
) {
  return {
    id: String(q._id),
    question_type_id: String(q.question_type_id),
    question_type_code: q.question_type_code,
    question_type_name: typeName,
    body_en: q.body_en,
    body_bn: q.body_bn,
    difficulty: q.difficulty,
    marks: q.marks,
    time_seconds: q.time_seconds,
    is_published: q.is_published,
    review_status: q.review_status,
    /** Who most recently set the current review_status — undefined for legacy questions predating this field. */
    status_by_name: statusByName,
    book_chapter_id: idStr(q.book_chapter_id),
    book_topic_id: idStr(q.book_topic_id),
    book_sub_topic_id: idStr(q.book_sub_topic_id),
    regulation_id: idStr(q.regulation_id),
    book_id: undefined as string | undefined,
    book_name: undefined as string | undefined,
    book_link_count: 0,
    option_count: optionCount,
    created_at: q.created_at,
    updated_at: q.updated_at,
  };
}

async function loadQuestionDetail(questionId: string) {
  const question = await Question.findById(questionId);
  if (!question || !question.is_active) throw notFound('Question not found');

  const statusByUser = question.status_changed_by
    ? await User.findById(question.status_changed_by).select('full_name_en full_name_bn')
    : null;

  await ensureLegacyBookLink(question);
  const book_links = await loadSerializedBookLinks(question._id);

  const qType = await QuestionType.findById(question.question_type_id);
  const [options, answers, detail] = await Promise.all([
    QuestionOption.find({ question_id: questionId }).sort({ option_key: 1 }),
    QuestionAnswer.find({ question_id: questionId }),
    QuestionAnswerDetail.findOne({ question_id: questionId }).lean(),
  ]);

  const correctAnswer = answers.find((a) => a.is_correct);
  const correctOption = correctAnswer
    ? options.find((o) => String(o._id) === String(correctAnswer.option_id))
    : undefined;

  let linkLevel: 'chapter' | 'rule' | 'sub_rule' | undefined;
  if (question.book_sub_topic_id) linkLevel = 'sub_rule';
  else if (question.book_topic_id) linkLevel = 'rule';
  else if (question.book_chapter_id) linkLevel = 'chapter';

  const typeCode = qType?.code ?? question.question_type_code;
  const comparison = await loadComparisonTable(
    question._id,
    detail as IQuestionAnswerDetail | null,
  );
  const differences = isDifferencesType(typeCode) || Boolean(comparison);

  // Mother/prototype model answer sharing: a "prototype" question shares its model answer from
  // a "mother" question instead of owning its own — resolve to the mother's content, and surface
  // the whole family (mother + sibling prototypes) regardless of which side we're viewing from.
  const familyMotherId = question.mother_question_id ?? question._id;
  let modelAnswerQuestionId = question._id;
  let modelAnswerDetail = detail as IQuestionAnswerDetail | null;
  let motherQuestionId: string | undefined;
  let motherQuestionLabel: string | undefined;
  if (question.mother_question_id) {
    const mother = await Question.findById(question.mother_question_id);
    if (mother && mother.is_active) {
      motherQuestionId = String(mother._id);
      motherQuestionLabel = mother.body_en.slice(0, 160);
      modelAnswerQuestionId = mother._id;
      modelAnswerDetail = (await QuestionAnswerDetail.findOne({
        question_id: mother._id,
      }).lean()) as IQuestionAnswerDetail | null;
    }
  }
  const prototypeDocs = await Question.find({
    mother_question_id: familyMotherId,
    is_active: true,
    _id: { $ne: question._id },
  }).select('body_en');
  const prototypeQuestions = prototypeDocs.map((p) => ({
    id: String(p._id),
    label: p.body_en.slice(0, 160),
  }));

  return {
    id: String(question._id),
    question_type_id: String(question.question_type_id),
    question_type_code: question.question_type_code || typeCode,
    question_type_name: qType?.name,
    has_options: qType?.has_options ?? false,
    link_level: linkLevel,
    book_chapter_id: idStr(question.book_chapter_id),
    book_topic_id: idStr(question.book_topic_id),
    book_sub_topic_id: idStr(question.book_sub_topic_id),
    regulation_id: idStr(question.regulation_id),
    book_id: book_links[0]?.book_id,
    book_name: book_links[0]?.book_name,
    chapter_number: book_links[0]?.chapter_number,
    chapter_name: book_links[0]?.chapter_name,
    book_links,
    body_en: question.body_en,
    body_bn: question.body_bn,
    difficulty: question.difficulty,
    marks: question.marks,
    negative_marks: question.negative_marks,
    time_seconds: question.time_seconds,
    is_published: question.is_published,
    review_status: question.review_status,
    /** Who most recently set the current review_status — undefined for legacy questions predating this field. */
    status_by_name: statusByUser ? statusByUser.full_name_bn || statusByUser.full_name_en : undefined,
    language: question.language,
    created_by: String(question.created_by),
    reviewed_by: idStr(question.reviewed_by),
    created_at: question.created_at,
    updated_at: question.updated_at,
    options: options.map((o) => ({
      id: String(o._id),
      option_key: o.option_key,
      option_text_en: o.option_text_en,
      option_text_bn: o.option_text_bn,
      is_correct: correctAnswer ? String(correctAnswer.option_id) === String(o._id) : false,
    })),
    correct_option_key: correctOption?.option_key,
    correct_true_false:
      isTrueFalseType(typeCode) && correctOption
        ? correctOption.option_key === 'a'
          ? 'true'
          : 'false'
        : undefined,
    model_answer_sections:
      qType && !qType.has_options && !differences
        ? await loadModelAnswerSections(modelAnswerQuestionId, modelAnswerDetail)
        : undefined,
    mother_question_id: motherQuestionId,
    mother_question_label: motherQuestionLabel,
    prototype_questions: prototypeQuestions,
    model_answer_comparison: comparison,
    explanation_sections:
      qType?.has_options && isMcqOrTf(typeCode)
        ? await loadExplanationSections(question._id, detail as IQuestionAnswerDetail | null)
        : undefined,
    note: detail?.note,
    reference_regulation_id: idStr(detail?.reference_regulation_id),
  };
}

async function saveAnswerDetail(questionId: mongoose.Types.ObjectId, input: AnswerDetailInput) {
  const existing = await QuestionAnswerDetail.findOne({ question_id: questionId }).lean();

  const sectionsToSave =
    input.explanation_sections !== undefined
      ? cleanExplanationSections(input.explanation_sections)
      : undefined;

  const modelSectionsToSave =
    input.model_answer_sections !== undefined
      ? cleanExplanationSections(input.model_answer_sections)
      : undefined;

  const comparisonExplicit = Object.prototype.hasOwnProperty.call(input, 'model_answer_comparison');
  const comparisonToSave = comparisonExplicit
    ? cleanComparisonTable(input.model_answer_comparison ?? undefined) ?? null
    : undefined;

  const note = input.note !== undefined ? input.note.trim() || undefined : undefined;

  const finalSections =
    sectionsToSave !== undefined
      ? sectionsToSave
      : serializeExplanationSections(existing?.explanation_sections as ExplanationSection[] | undefined);

  const finalModelSections =
    modelSectionsToSave !== undefined
      ? modelSectionsToSave
      : serializeExplanationSections(existing?.model_answer_sections as ExplanationSection[] | undefined);

  const finalComparison =
    comparisonToSave !== undefined
      ? comparisonToSave
      : serializeComparisonTable(existing?.model_answer_comparison as ComparisonTable | undefined) ?? null;

  const finalNote = note !== undefined ? note : existing?.note?.trim() || undefined;

  const hasContent =
    finalSections.length > 0 ||
    finalModelSections.length > 0 ||
    Boolean(finalComparison) ||
    Boolean(finalNote);

  if (!hasContent) {
    await QuestionAnswerDetail.deleteOne({ question_id: questionId });
    return;
  }

  const $set: Record<string, unknown> = { question_id: questionId };
  const $unset: Record<string, ''> = { explanation: '', model_answer: '' };

  if (sectionsToSave !== undefined) {
    if (sectionsToSave.length > 0) $set.explanation_sections = sectionsToSave;
    else $unset.explanation_sections = '';
  }

  if (modelSectionsToSave !== undefined) {
    if (modelSectionsToSave.length > 0) $set.model_answer_sections = modelSectionsToSave;
    else $unset.model_answer_sections = '';
  }

  if (comparisonToSave !== undefined) {
    if (comparisonToSave) $set.model_answer_comparison = comparisonToSave;
    else $unset.model_answer_comparison = '';
  }

  if (note !== undefined) {
    if (note) $set.note = note;
    else $unset.note = '';
  }

  if (input.reference_regulation_id !== undefined) {
    if (input.reference_regulation_id) {
      $set.reference_regulation_id = new mongoose.Types.ObjectId(input.reference_regulation_id);
    } else {
      $unset.reference_regulation_id = '';
    }
  }

  await QuestionAnswerDetail.findOneAndUpdate(
    { question_id: questionId },
    { $set, $unset },
    { upsert: true, new: true },
  );
}

async function replaceOptionsAndAnswer(
  questionId: mongoose.Types.ObjectId,
  options: NonNullable<CreateQuestionDto['options']>,
  correctOptionKey: string,
  explanationSections?: ExplanationSection[],
  note?: string,
  referenceRegulationId?: string,
) {
  const correctInput = options.find((o) => o.option_key === correctOptionKey);
  if (!correctInput) throw badRequest('Correct option key must match one of the provided options');

  await QuestionOption.deleteMany({ question_id: questionId });
  await QuestionAnswer.deleteMany({ question_id: questionId });

  const createdOptions = await QuestionOption.insertMany(
    options.map((o) => ({
      question_id: questionId,
      option_key: o.option_key,
      option_text_en: o.option_text_en,
      option_text_bn: o.option_text_bn,
    })),
  );

  const correctOption = createdOptions.find((o) => o.option_key === correctOptionKey);
  if (!correctOption) throw badRequest('Failed to map correct option');

  await QuestionAnswer.insertMany(
    createdOptions.map((o) => ({
      question_id: questionId,
      option_id: o._id,
      is_correct: String(o._id) === String(correctOption._id),
    })),
  );

  await saveAnswerDetail(questionId, {
    explanation_sections: explanationSections,
    model_answer_sections: [],
    note,
    reference_regulation_id: referenceRegulationId,
  });
}

async function replaceTextAnswer(
  questionId: mongoose.Types.ObjectId,
  modelAnswerSections: ExplanationSection[] | undefined,
  note?: string,
  referenceRegulationId?: string,
  modelAnswerComparison?: ComparisonTable | null,
) {
  await QuestionOption.deleteMany({ question_id: questionId });
  await QuestionAnswer.deleteMany({ question_id: questionId });
  await saveAnswerDetail(questionId, {
    model_answer_sections: modelAnswerSections ?? [],
    model_answer_comparison:
      modelAnswerComparison === undefined ? null : modelAnswerComparison,
    explanation_sections: [],
    note,
    reference_regulation_id: referenceRegulationId,
  });
}

function resolveOptionPayload(dto: CreateQuestionDto, typeCode: string) {
  if (isTrueFalseType(typeCode)) {
    const correctKey = dto.correct_true_false === 'false' ? 'b' : 'a';
    return { options: TF_OPTIONS, correctOptionKey: correctKey };
  }
  if (!dto.options?.length) throw badRequest('Options are required for this question type');
  if (!dto.correct_option_key) throw badRequest('Correct option is required');
  const keys = new Set(dto.options.map((o) => o.option_key));
  if (keys.size !== dto.options.length) throw badRequest('Duplicate option keys');
  if (dto.options.length < 2) throw badRequest('At least two options are required');
  return { options: dto.options, correctOptionKey: dto.correct_option_key };
}

async function applyAnswerPayload(
  questionId: mongoose.Types.ObjectId,
  qType: InstanceType<typeof QuestionType>,
  dto: CreateQuestionDto | UpdateQuestionDto,
) {
  const explanationSections =
    dto.explanation_sections !== undefined
      ? cleanExplanationSections(dto.explanation_sections)
      : undefined;

  const modelAnswerSections =
    dto.model_answer_sections !== undefined
      ? cleanExplanationSections(dto.model_answer_sections)
      : undefined;

  const comparisonExplicit = Object.prototype.hasOwnProperty.call(dto, 'model_answer_comparison');
  const comparisonTable = comparisonExplicit
    ? cleanComparisonTable(dto.model_answer_comparison) ?? null
    : undefined;

  if (qType.has_options && isMcqOrTf(qType.code)) {
    const hasOptionUpdate =
      dto.options !== undefined ||
      dto.correct_option_key !== undefined ||
      dto.correct_true_false !== undefined;

    if (hasOptionUpdate) {
      const resolved = resolveOptionPayload(dto as CreateQuestionDto, qType.code);
      await replaceOptionsAndAnswer(
        questionId,
        resolved.options,
        resolved.correctOptionKey,
        explanationSections,
        dto.note,
        dto.reference_regulation_id,
      );
      return;
    }

    if (
      explanationSections !== undefined ||
      dto.note !== undefined ||
      dto.reference_regulation_id !== undefined
    ) {
      await saveAnswerDetail(questionId, {
        explanation_sections: explanationSections,
        model_answer_sections: [],
        model_answer_comparison: null,
        note: dto.note,
        reference_regulation_id: dto.reference_regulation_id,
      });
    }
    return;
  }

  if (qType.has_options) return;

  if (isDifferencesType(qType.code)) {
    if (
      comparisonTable !== undefined ||
      dto.note !== undefined ||
      dto.reference_regulation_id !== undefined
    ) {
      await QuestionOption.deleteMany({ question_id: questionId });
      await QuestionAnswer.deleteMany({ question_id: questionId });
      await saveAnswerDetail(questionId, {
        model_answer_sections: [],
        explanation_sections: [],
        ...(comparisonTable !== undefined ? { model_answer_comparison: comparisonTable } : {}),
        note: dto.note,
        reference_regulation_id: dto.reference_regulation_id,
      });
    }
    return;
  }

  if (
    modelAnswerSections !== undefined ||
    dto.note !== undefined ||
    dto.reference_regulation_id !== undefined
  ) {
    await replaceTextAnswer(
      questionId,
      modelAnswerSections,
      dto.note,
      dto.reference_regulation_id,
      null,
    );
  }
}

export async function listQuestionTypes() {
  const items = await QuestionType.find({ is_active: true }).sort({ name: 1 });
  const counts = await Question.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: { is_active: true } },
    { $group: { _id: '$question_type_id', count: { $sum: 1 } } },
  ]);
  const countByType = new Map(counts.map((c) => [String(c._id), c.count]));
  return items.map((t) => serializeQuestionType(t, countByType.get(String(t._id)) ?? 0));
}

export async function createQuestionType(dto: CreateQuestionTypeDto) {
  const existing = await QuestionType.findOne({ code: dto.code });
  if (existing) throw badRequest(`Question type code "${dto.code}" already exists`);
  const item = await QuestionType.create({ ...dto, is_active: true });
  return serializeQuestionType(item, 0);
}

function serializeQuestionType(t: InstanceType<typeof QuestionType>, question_count = 0) {
  return {
    id: String(t._id),
    name: t.name,
    code: t.code,
    has_options: t.has_options,
    note: t.note,
    question_count,
  };
}

export async function updateQuestionType(id: string, dto: UpdateQuestionTypeDto) {
  const item = await QuestionType.findById(id);
  if (!item) throw notFound('Question type not found');
  if (dto.code && dto.code !== item.code) {
    const clash = await QuestionType.findOne({ code: dto.code });
    if (clash) throw badRequest(`Question type code "${dto.code}" already exists`);
    item.code = dto.code;
  }
  if (dto.name !== undefined) item.name = dto.name;
  if (dto.has_options !== undefined) item.has_options = dto.has_options;
  if (dto.note !== undefined) item.note = dto.note;
  if (dto.is_active !== undefined) item.is_active = dto.is_active;
  await item.save();
  const question_count = await Question.countDocuments({ question_type_id: item._id, is_active: true });
  return serializeQuestionType(item, question_count);
}

export async function deleteQuestionType(id: string) {
  const item = await QuestionType.findById(id);
  if (!item) throw notFound('Question type not found');
  const inUse = await Question.countDocuments({ question_type_id: item._id, is_active: true });
  if (inUse > 0) throw badRequest('Cannot delete: questions still use this type');
  item.is_active = false;
  await item.save();
  return { deleted: true };
}

export async function findSimilarQuestions(params: {
  text: string;
  exclude_id?: string;
  threshold?: number;
  limit?: number;
}) {
  const text = params.text.trim();
  // Same word-match search standard as link-search: any word matching counts, ranked by % of
  // query words found, 50%+ by default — instead of requiring near-identical full-text similarity.
  // Spans every question type — a near-duplicate is worth flagging regardless of type.
  const threshold = params.threshold ?? 0.5;
  const limit = params.limit ?? 8;
  if (text.length < 8) return [];

  const query: Record<string, unknown> = {
    is_active: true,
  };
  if (params.exclude_id) {
    query._id = { $ne: new mongoose.Types.ObjectId(params.exclude_id) };
  }

  // Same word list the scorer uses below, so the Mongo prefilter never drops a candidate the
  // score would otherwise have kept — any single word appearing anywhere is enough to fetch it.
  const words = [...new Set(normalizeQuestionText(text).split(' ').filter((w) => w.length > 1))];
  if (words.length > 0) {
    query.$or = words.flatMap((w) => [
      { body_en: { $regex: escapeRegex(w), $options: 'i' } },
      { body_bn: { $regex: escapeRegex(w), $options: 'i' } },
    ]);
  }

  const candidates = await Question.find(query)
    .select('body_en body_bn question_type_code is_published')
    .sort({ updated_at: -1 })
    .limit(200);

  return candidates
    .map((q) => {
      const scoreEn = queryWordMatchScore(text, q.body_en);
      const scoreBn = q.body_bn ? queryWordMatchScore(text, q.body_bn) : 0;
      const score = Math.max(scoreEn, scoreBn);
      return {
        id: String(q._id),
        body_en: q.body_en,
        body_bn: q.body_bn,
        question_type_code: q.question_type_code,
        is_published: q.is_published,
        similarity: Math.round(score * 100),
        score,
      };
    })
    .filter((item) => item.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score: _score, ...item }) => item);
}

/**
 * "Link answer with another question" search — any word in `q` matching anywhere in a question's
 * text counts as a candidate; results are ranked by the % of query words found (any status except
 * trashed, no book-list-cache short-circuit) and only 50%+ matches (by default) are returned.
 */
export async function searchQuestionsForLink(params: {
  q: string;
  exclude_id?: string;
  book_chapter_id?: string;
  book_info_id?: string;
  threshold?: number;
  limit?: number;
}) {
  const text = params.q.trim();
  if (!text) return [];
  const threshold = params.threshold ?? 0.5;
  const limit = params.limit ?? 20;

  const query: Record<string, unknown> = { is_active: true };
  if (params.exclude_id) {
    query._id = { $ne: new mongoose.Types.ObjectId(params.exclude_id) };
  }

  if (params.book_chapter_id) {
    query.book_chapter_id = params.book_chapter_id;
  } else if (params.book_info_id) {
    const chapters = await BookChapter.find({
      book_info_id: params.book_info_id,
      is_active: true,
    }).select('_id');
    const chapterIds = chapters.map((c) => c._id);
    if (chapterIds.length === 0) return [];
    query.book_chapter_id = { $in: chapterIds };
  }

  // Same word list the scorer uses below, so the Mongo prefilter never drops a candidate the
  // score would otherwise have kept — any single word appearing anywhere is enough to fetch it.
  const words = [...new Set(normalizeQuestionText(text).split(' ').filter((w) => w.length > 1))];
  if (words.length > 0) {
    query.$or = words.flatMap((w) => [
      { body_en: { $regex: escapeRegex(w), $options: 'i' } },
      { body_bn: { $regex: escapeRegex(w), $options: 'i' } },
    ]);
  }

  const candidates = await Question.find(query)
    .select('body_en body_bn question_type_code review_status is_published')
    .sort({ updated_at: -1 })
    .limit(300);

  return candidates
    .map((c) => {
      const scoreEn = queryWordMatchScore(text, c.body_en);
      const scoreBn = c.body_bn ? queryWordMatchScore(text, c.body_bn) : 0;
      const score = Math.max(scoreEn, scoreBn);
      return {
        id: String(c._id),
        body_en: c.body_en,
        body_bn: c.body_bn,
        question_type_code: c.question_type_code,
        review_status: c.review_status,
        is_published: c.is_published,
        match: Math.round(score * 100),
        score,
      };
    })
    .filter((item) => item.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score: _score, ...item }) => item);
}

/** Mongo `.sort()` spec for each QUESTION_SORT_OPTIONS value; `_id` tiebreaker keeps skip/limit pages stable. */
function questionMongoSort(sort?: string): Record<string, 1 | -1> {
  switch (sort) {
    case 'updated_asc':
      return { updated_at: 1, _id: 1 };
    case 'created_desc':
      return { created_at: -1, _id: -1 };
    case 'created_asc':
      return { created_at: 1, _id: 1 };
    case 'marks_desc':
      return { marks: -1, _id: -1 };
    case 'marks_asc':
      return { marks: 1, _id: 1 };
    case 'body_en_asc':
      return { body_en: 1, _id: 1 };
    case 'body_en_desc':
      return { body_en: -1, _id: -1 };
    case 'updated_desc':
    default:
      return { updated_at: -1, _id: -1 };
  }
}

/** In-memory equivalent of questionMongoSort() for the cached-published-questions fast path. */
function sortCachedQuestions<T extends { updated_at?: string; created_at?: string; marks?: number; body_en?: string | null }>(
  list: T[],
  sort?: string,
): T[] {
  const ascending = sort?.endsWith('_asc') ?? false;
  const key: keyof T = sort?.startsWith('marks')
    ? 'marks'
    : sort?.startsWith('created')
      ? 'created_at'
      : sort?.startsWith('body_en')
        ? 'body_en'
        : 'updated_at';
  return [...list].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av === bv) return 0;
    if (av === undefined || av === null) return 1;
    if (bv === undefined || bv === null) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return ascending ? cmp : -cmp;
  });
}

export async function listQuestions(
  filters: {
    q?: string;
    difficulty?: string;
    question_type_id?: string;
    question_type_code?: string;
    is_published?: boolean;
    review_status?: string;
    trashed?: boolean;
    book_chapter_id?: string;
    book_topic_id?: string;
    book_sub_topic_id?: string;
    regulation_id?: string;
    book_info_id?: string;
    /** Not tagged to any book/chapter yet — overrides book_chapter_id/book_info_id when true. */
    untagged?: boolean;
    sort?: string;
    limit: number;
    offset?: number;
  },
  options?: { bypassCache?: boolean },
) {
  const offset = Math.max(0, filters.offset ?? 0);
  const limit = filters.limit;

  const canUsePublishedCache =
    !options?.bypassCache && filters.is_published === true && filters.trashed !== true;

  if (canUsePublishedCache) {
    const { cachedPublishedQuestions } = await import('../content-cache/content-cache.service.js');
    type QItem = {
      id: string;
      body_en?: string | null;
      body_bn?: string | null;
      difficulty?: string;
      question_type_id?: string;
      question_type_code?: string;
      book_chapter_id?: string;
      book_topic_id?: string;
      book_sub_topic_id?: string;
      regulation_id?: string;
      book_id?: string;
      marks?: number;
      created_at?: string;
      updated_at?: string;
    };
    const cached = cachedPublishedQuestions<QItem>();
    if (cached) {
      let list = cached;
      if (filters.difficulty) list = list.filter((q) => q.difficulty === filters.difficulty);
      if (filters.question_type_id) {
        list = list.filter((q) => q.question_type_id === filters.question_type_id);
      }
      if (filters.question_type_code) {
        list = list.filter((q) => q.question_type_code === filters.question_type_code);
      }
      if (filters.untagged) {
        list = list.filter((q) => !q.book_chapter_id);
      } else {
        if (filters.book_chapter_id) {
          list = list.filter((q) => q.book_chapter_id === filters.book_chapter_id);
        }
        if (filters.book_topic_id) list = list.filter((q) => q.book_topic_id === filters.book_topic_id);
        if (filters.book_sub_topic_id) {
          list = list.filter((q) => q.book_sub_topic_id === filters.book_sub_topic_id);
        }
        if (filters.regulation_id) list = list.filter((q) => q.regulation_id === filters.regulation_id);
        if (filters.book_info_id) list = list.filter((q) => q.book_id === filters.book_info_id);
      }
      if (filters.q?.trim()) {
        const q = filters.q.trim().toLowerCase();
        list = list.filter(
          (row) =>
            (row.body_en ?? '').toLowerCase().includes(q) ||
            (row.body_bn ?? '').toLowerCase().includes(q),
        );
      }
      list = sortCachedQuestions(list, filters.sort);
      const total = list.length;
      const items = list.slice(offset, offset + limit);
      return { items, total, limit, offset };
    }
  }

  const query: Record<string, unknown> = { is_active: filters.trashed === true ? false : true };
  if (filters.difficulty) query.difficulty = filters.difficulty;
  if (filters.question_type_id) query.question_type_id = filters.question_type_id;
  if (filters.question_type_code) query.question_type_code = filters.question_type_code;
  if (filters.is_published !== undefined) query.is_published = filters.is_published;
  if (filters.review_status) query.review_status = filters.review_status;

  if (filters.untagged) {
    // Not tagged to any book/chapter yet — book_chapter_id is kept unset in sync with book_links.
    query.book_chapter_id = { $exists: false };
  } else {
    if (filters.book_chapter_id) query.book_chapter_id = filters.book_chapter_id;
    if (filters.book_topic_id) query.book_topic_id = filters.book_topic_id;
    if (filters.book_sub_topic_id) query.book_sub_topic_id = filters.book_sub_topic_id;
    if (filters.regulation_id) query.regulation_id = filters.regulation_id;

    if (filters.book_info_id) {
      const chapters = await BookChapter.find({
        book_info_id: filters.book_info_id,
        is_active: true,
      }).select('_id');
      const chapterIds = chapters.map((c) => c._id);
      if (chapterIds.length === 0) {
        return { items: [], total: 0, limit, offset };
      }
      query.book_chapter_id = { $in: chapterIds };
    }
  }

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    query.$or = [{ body_en: { $regex: q, $options: 'i' } }, { body_bn: { $regex: q, $options: 'i' } }];
  }

  const [total, items] = await Promise.all([
    Question.countDocuments(query),
    // _id tiebreaker so skip/offset pages do not overlap or repeat
    Question.find(query).sort(questionMongoSort(filters.sort)).skip(offset).limit(limit),
  ]);

  const typeIds = [...new Set(items.map((q) => String(q.question_type_id)))];
  const types = typeIds.length > 0 ? await QuestionType.find({ _id: { $in: typeIds } }) : [];
  const typeMap = new Map(types.map((t) => [String(t._id), t.name]));

  const statusByUserIds = [
    ...new Set(items.map((q) => idStr(q.status_changed_by)).filter((id): id is string => Boolean(id))),
  ];
  const statusByUsers =
    statusByUserIds.length > 0
      ? await User.find({ _id: { $in: statusByUserIds } }).select('full_name_en full_name_bn')
      : [];
  const statusByNameMap = new Map(
    statusByUsers.map((u) => [String(u._id), u.full_name_bn || u.full_name_en]),
  );

  const questionIds = items.map((q) => q._id);
  const [linkCounts, optionCounts] = await Promise.all([
    questionIds.length
      ? QuestionBookLink.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
          { $match: { question_id: { $in: questionIds }, is_active: true } },
          { $group: { _id: '$question_id', count: { $sum: 1 } } },
        ])
      : Promise.resolve([]),
    questionIds.length
      ? QuestionOption.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
          { $match: { question_id: { $in: questionIds } } },
          { $group: { _id: '$question_id', count: { $sum: 1 } } },
        ])
      : Promise.resolve([]),
  ]);
  const linkCountMap = new Map(linkCounts.map((c) => [String(c._id), c.count]));
  const optionCountMap = new Map(optionCounts.map((c) => [String(c._id), c.count]));

  const chapterIds = [
    ...new Set(items.map((q) => idStr(q.book_chapter_id)).filter((id): id is string => Boolean(id))),
  ];
  const chapters =
    chapterIds.length > 0 ? await BookChapter.find({ _id: { $in: chapterIds } }) : [];
  const chapterBookId = new Map(chapters.map((c) => [String(c._id), String(c.book_info_id)]));
  const bookIds = [...new Set([...chapterBookId.values()].filter(Boolean))];
  const books = bookIds.length > 0 ? await BookInfo.find({ _id: { $in: bookIds } }) : [];
  const bookNameById = new Map(books.map((b) => [String(b._id), b.name]));

  const result = items.map((q) => {
    const item = serializeQuestionListItem(
      q,
      typeMap.get(String(q.question_type_id)),
      optionCountMap.get(String(q._id)) ?? 0,
      q.status_changed_by ? statusByNameMap.get(String(q.status_changed_by)) : undefined,
    );
    const storedCount = linkCountMap.get(String(q._id)) ?? 0;
    item.book_link_count = storedCount > 0 ? storedCount : q.book_chapter_id ? 1 : 0;
    const chapterId = idStr(q.book_chapter_id);
    const bookId = chapterId ? chapterBookId.get(chapterId) : undefined;
    if (bookId) {
      item.book_id = bookId;
      item.book_name = bookNameById.get(bookId);
    }
    return item;
  });
  return { items: result, total, limit, offset };
}

/** Published MCQs linked to books/chapters, with explanations for marathon review. */
export async function listMarathonReview(
  filters: { q?: string; limit?: number; offset?: number } = {},
) {
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  const offset = Math.max(0, filters.offset ?? 0);

  const query: Record<string, unknown> = {
    is_active: true,
    is_published: true,
    question_type_code: 'MCQ',
  };
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    query.$or = [{ body_en: { $regex: q, $options: 'i' } }, { body_bn: { $regex: q, $options: 'i' } }];
  }

  // Stable order so offset pages do not shuffle between requests.
  const questions = await Question.find(query).sort({ _id: 1 });
  if (questions.length === 0) {
    return { items: [], total: 0, limit, offset };
  }

  const questionIds = questions.map((q) => q._id);
  const links = await QuestionBookLink.find({
    question_id: { $in: questionIds },
    is_active: true,
  }).sort({ sort_order: 1 });

  const linkByQuestion = new Map<string, (typeof links)[number]>();
  for (const link of links) {
    const key = String(link.question_id);
    if (!linkByQuestion.has(key)) linkByQuestion.set(key, link);
  }

  const chapterIdByQuestion = new Map<string, string>();
  for (const q of questions) {
    const qid = String(q._id);
    if (q.book_chapter_id) {
      chapterIdByQuestion.set(qid, String(q.book_chapter_id));
      continue;
    }
    const link = linkByQuestion.get(qid);
    if (link?.book_chapter_id) {
      chapterIdByQuestion.set(qid, String(link.book_chapter_id));
    }
  }

  const chapterIds = [...new Set([...chapterIdByQuestion.values()])];
  const chapters =
    chapterIds.length > 0
      ? await BookChapter.find({ _id: { $in: chapterIds }, is_active: true })
      : [];
  const chapterMap = new Map(chapters.map((c) => [String(c._id), c]));

  const bookIds = [...new Set(chapters.map((c) => String(c.book_info_id)))];
  const books =
    bookIds.length > 0 ? await BookInfo.find({ _id: { $in: bookIds }, is_active: true }) : [];
  const bookMap = new Map(books.map((b) => [String(b._id), b]));

  type LightRow = {
    id: string;
    body_en: string;
    body_bn?: string;
    book_id: string;
    book_name: string;
    chapter_id: string;
    chapter_number: string;
    chapter_name: string;
    chapter_sort_order: number;
    book_sort_key: string;
  };

  const lightRows: LightRow[] = [];
  for (const q of questions) {
    const qid = String(q._id);
    const chapterId = chapterIdByQuestion.get(qid);
    if (!chapterId) continue;
    const chapter = chapterMap.get(chapterId);
    if (!chapter) continue;
    const book = bookMap.get(String(chapter.book_info_id));
    if (!book) continue;

    lightRows.push({
      id: qid,
      body_en: q.body_en,
      body_bn: q.body_bn,
      book_id: String(book._id),
      book_name: book.name,
      chapter_id: chapterId,
      chapter_number: chapter.chapter_number ?? '',
      chapter_name: chapter.name,
      chapter_sort_order: chapter.sort_order ?? 0,
      book_sort_key: book.name,
    });
  }

  lightRows.sort(
    (a, b) =>
      a.book_sort_key.localeCompare(b.book_sort_key) ||
      a.chapter_sort_order - b.chapter_sort_order ||
      a.chapter_number.localeCompare(b.chapter_number) ||
      a.body_en.localeCompare(b.body_en) ||
      a.id.localeCompare(b.id),
  );

  const total = lightRows.length;
  const pageLight = lightRows.slice(offset, offset + limit);
  if (pageLight.length === 0) {
    return { items: [], total, limit, offset };
  }

  const pageIds = pageLight.map((r) => new mongoose.Types.ObjectId(r.id));
  const details = await QuestionAnswerDetail.find({ question_id: { $in: pageIds } }).lean();
  const detailByQuestion = new Map(details.map((d) => [String(d.question_id), d]));

  const items = pageLight.map((row, index) => {
    const detail = detailByQuestion.get(row.id) ?? null;
    let explanation_sections = serializeExplanationSections(detail?.explanation_sections);
    if (
      explanation_sections.length === 0 &&
      typeof detail?.explanation === 'string' &&
      detail.explanation.trim()
    ) {
      explanation_sections = parseLegacyExplanation(detail.explanation);
    }

    const { book_sort_key: _b, chapter_sort_order: _c, ...item } = row;
    return {
      ...item,
      explanation_sections,
      number: offset + index + 1,
    };
  });

  return { items, total, limit, offset };
}

export async function getQuestionById(id: string) {
  return loadQuestionDetail(id);
}

export async function createQuestion(dto: CreateQuestionDto, createdBy: string) {
  const qType = await QuestionType.findById(dto.question_type_id);
  if (!qType || !qType.is_active) throw notFound('Question type not found');

  let motherId: mongoose.Types.ObjectId | undefined;
  if (dto.mother_question_id) {
    const mother = await Question.findById(dto.mother_question_id);
    if (!mother || !mother.is_active) throw notFound('Mother question not found');
    if (mother.mother_question_id) {
      throw badRequest(
        'That question is itself a prototype of another question — pick the original mother question instead.',
      );
    }
    motherId = mother._id;
  }

  const question = await Question.create({
    question_type_id: qType._id,
    question_type_code: qType.code,
    body_en: dto.body_en,
    body_bn: dto.body_bn,
    difficulty: dto.difficulty,
    marks: dto.marks,
    negative_marks: dto.negative_marks,
    time_seconds: dto.time_seconds,
    language: dto.language,
    is_published: false,
    review_status: 'draft',
    is_active: true,
    created_by: new mongoose.Types.ObjectId(createdBy),
    status_changed_by: new mongoose.Types.ObjectId(createdBy),
    mother_question_id: motherId,
  });

  const links = linksFromDto(dto) ?? [];
  await saveBookLinks(question._id, links, question);
  await question.save();
  await applyAnswerPayload(question._id, qType, dto);

  return loadQuestionDetail(String(question._id));
}

export async function addQuestionBookLink(questionId: string, dto: QuestionBookLinkInput) {
  const question = await Question.findById(questionId);
  if (!question || !question.is_active) throw notFound('Question not found');

  await assertBookLinkPointUnique(question._id, dto);

  const latest = await QuestionBookLink.findOne({ question_id: question._id, is_active: true })
    .sort({ sort_order: -1 })
    .select('sort_order');
  const link = await QuestionBookLink.create({
    question_id: question._id,
    link_level: dto.link_level,
    book_chapter_id: new mongoose.Types.ObjectId(dto.book_chapter_id),
    book_topic_id: dto.book_topic_id ? new mongoose.Types.ObjectId(dto.book_topic_id) : undefined,
    book_sub_topic_id: dto.book_sub_topic_id ? new mongoose.Types.ObjectId(dto.book_sub_topic_id) : undefined,
    regulation_id: dto.regulation_id ? new mongoose.Types.ObjectId(dto.regulation_id) : undefined,
    sort_order: (latest?.sort_order ?? -1) + 1,
    is_active: true,
  });

  if (!question.book_chapter_id) {
    syncPrimaryBookFields(question, dto);
    await question.save();
  }

  return serializeBookLink(link);
}

export async function deleteQuestionBookLink(questionId: string, linkId: string) {
  const question = await Question.findById(questionId);
  if (!question || !question.is_active) throw notFound('Question not found');

  const link = await QuestionBookLink.findOne({
    _id: linkId,
    question_id: question._id,
    is_active: true,
  });
  if (!link) throw notFound('Book link not found');

  link.is_active = false;
  await link.save();

  const first = await QuestionBookLink.findOne({ question_id: question._id, is_active: true }).sort({
    sort_order: 1,
  });
  syncPrimaryBookFields(
    question,
    first
      ? {
          link_level: first.link_level,
          book_chapter_id: String(first.book_chapter_id),
          book_topic_id: idStr(first.book_topic_id),
          book_sub_topic_id: idStr(first.book_sub_topic_id),
          regulation_id: idStr(first.regulation_id),
        }
      : null,
  );
  await question.save();
  return { deleted: true };
}

export async function updateQuestion(id: string, dto: UpdateQuestionDto) {
  const question = await Question.findById(id);
  if (!question || !question.is_active) throw notFound('Question not found');

  let qType = await QuestionType.findById(question.question_type_id);
  if (dto.question_type_id) {
    const nextType = await QuestionType.findById(dto.question_type_id);
    if (!nextType) throw notFound('Question type not found');
    question.question_type_id = nextType._id;
    question.question_type_code = nextType.code;
    qType = nextType;
  }
  if (!qType) throw notFound('Question type not found');

  if (dto.body_en !== undefined) question.body_en = dto.body_en;
  if (dto.body_bn !== undefined) question.body_bn = dto.body_bn;
  if (dto.difficulty !== undefined) question.difficulty = dto.difficulty;
  if (dto.marks !== undefined) question.marks = dto.marks;
  if (dto.negative_marks !== undefined) question.negative_marks = dto.negative_marks;
  if (dto.time_seconds !== undefined) question.time_seconds = dto.time_seconds;
  if (dto.language !== undefined) question.language = dto.language;
  if (dto.is_active !== undefined) question.is_active = dto.is_active;
  const links = linksFromDto(dto);
  if (links !== undefined && links.length > 0) {
    await saveBookLinks(question._id, links, question);
  }

  await question.save();

  const hasAnswerUpdate =
    dto.options !== undefined ||
    dto.correct_option_key !== undefined ||
    dto.correct_true_false !== undefined ||
    dto.model_answer_sections !== undefined ||
    dto.model_answer_comparison !== undefined ||
    dto.explanation_sections !== undefined;

  if (hasAnswerUpdate) {
    if (question.mother_question_id && dto.model_answer_sections !== undefined) {
      // This question is a prototype — the model answer belongs to the mother question.
      // Editing it "normally" here edits the mother's copy, which every prototype resolves to.
      await saveAnswerDetail(question.mother_question_id, {
        model_answer_sections: dto.model_answer_sections,
      });
      await Question.updateMany(
        {
          $or: [
            { _id: question.mother_question_id },
            { mother_question_id: question.mother_question_id },
          ],
        },
        { $set: { updated_at: new Date() } },
      );
    } else {
      await applyAnswerPayload(question._id, qType, dto as CreateQuestionDto);
    }
  } else if (dto.note !== undefined || dto.reference_regulation_id !== undefined) {
    await saveAnswerDetail(question._id, {
      note: dto.note,
      reference_regulation_id: dto.reference_regulation_id,
    });
  }

  // Options/answers/explanation/note live on separate, unstamped collections (see
  // QuestionOption/QuestionAnswer/QuestionAnswerDetail models) — Mongoose only bumps
  // `updated_at` when a field on the Question document itself changed, so an edit that
  // touches only those side tables (e.g. explanation-only, or note-only) would otherwise
  // leave `updated_at` stale. Force it whenever any of that content changed, since
  // `Question.updated_at` is the sole "changed since X" signal the mobile sync endpoint
  // (questionsService.listQuestionsSync) relies on.
  if (hasAnswerUpdate || dto.note !== undefined || dto.reference_regulation_id !== undefined) {
    await Question.updateOne({ _id: question._id }, { $set: { updated_at: new Date() } });
  }

  return loadQuestionDetail(id);
}

/**
 * Make this question a "prototype" that shares its model answer from a "mother" question —
 * reads resolve to the mother's content, and editing the answer from either side (normally,
 * no special mode) edits the mother's copy. Only one hop is allowed (a mother cannot itself be
 * a prototype), and a question that already has prototypes of its own cannot become a prototype
 * itself, so the relationship always stays a simple star (one mother, many prototypes), never a
 * chain.
 */
export async function setMotherQuestion(id: string, motherQuestionId: string) {
  if (id === motherQuestionId) {
    throw badRequest('A question cannot be its own mother question');
  }

  const question = await Question.findById(id);
  if (!question || !question.is_active) throw notFound('Question not found');

  const mother = await Question.findById(motherQuestionId);
  if (!mother || !mother.is_active) throw notFound('Mother question not found');

  if (mother.mother_question_id) {
    throw badRequest(
      'That question is itself a prototype of another question — pick the original mother question instead.',
    );
  }

  const prototypeCount = await Question.countDocuments({
    mother_question_id: question._id,
    is_active: true,
  });
  if (prototypeCount > 0) {
    throw badRequest(
      `This question already has ${prototypeCount} prototype question(s) of its own — remove those links first before making this question a prototype of another.`,
    );
  }

  question.mother_question_id = mother._id;
  await question.save();
  return loadQuestionDetail(id);
}

/** Remove the mother link — copies the currently-resolved (mother's) content in first, so nothing is lost. */
export async function removeMotherQuestion(id: string) {
  const question = await Question.findById(id);
  if (!question || !question.is_active) throw notFound('Question not found');
  if (!question.mother_question_id) return loadQuestionDetail(id);

  const mother = await Question.findById(question.mother_question_id);
  if (mother) {
    const motherDetail = await QuestionAnswerDetail.findOne({ question_id: mother._id }).lean();
    const sections = serializeExplanationSections(
      motherDetail?.model_answer_sections as ExplanationSection[] | undefined,
    );
    await saveAnswerDetail(question._id, { model_answer_sections: sections });
  }

  question.mother_question_id = undefined;
  await question.save();
  await Question.updateOne({ _id: question._id }, { $set: { updated_at: new Date() } });
  return loadQuestionDetail(id);
}

/** Soft-delete: inactive + unpublished, hidden from Question Bank. Related docs kept. */
export async function deleteQuestion(id: string) {
  const question = await Question.findById(id);
  if (!question) throw notFound('Question not found');
  if (!question.is_active) {
    return { deleted: true, already_trashed: true, id: String(question._id) };
  }

  question.is_active = false;
  question.is_published = false;
  question.review_status = 'draft';
  await question.save();

  // Hide chapter/book placements while trashed (restored with the question)
  await QuestionBookLink.updateMany(
    { question_id: question._id, is_active: true },
    { $set: { is_active: false, deactivated_by_trash: true } },
  );

  return { deleted: true, trashed: true, id: String(question._id) };
}

export async function restoreQuestion(id: string) {
  const question = await Question.findById(id);
  if (!question) throw notFound('Question not found');
  if (question.is_active) return loadQuestionDetail(id);

  question.is_active = true;
  // Stay unpublished until explicitly published again
  await question.save();

  const marked = await QuestionBookLink.updateMany(
    { question_id: question._id, deactivated_by_trash: true },
    { $set: { is_active: true, deactivated_by_trash: false } },
  );

  // Legacy trash (before deactivated_by_trash): re-enable inactive links for this question
  if (marked.modifiedCount === 0) {
    await QuestionBookLink.updateMany(
      { question_id: question._id, is_active: false },
      { $set: { is_active: true } },
    );
  }

  return loadQuestionDetail(id);
}

/** Hard-delete: remove question and related documents from the database. */
export async function permanentlyDeleteQuestion(id: string) {
  const question = await Question.findById(id);
  if (!question) throw notFound('Question not found');
  if (question.is_active) {
    throw badRequest('Move the question to trash before permanently deleting it');
  }

  const oid = question._id;

  await QuestionDeletion.create({ question_id: oid, deleted_at: new Date() });

  await Promise.all([
    QuestionOption.deleteMany({ question_id: oid }),
    QuestionAnswer.deleteMany({ question_id: oid }),
    QuestionAnswerDetail.deleteMany({ question_id: oid }),
    QuestionBookLink.deleteMany({ question_id: oid }),
    UserQuestionEvaluation.deleteMany({ question_id: oid }),
  ]);

  // Keep paper structure; detach bank refs
  await PaperQuestion.updateMany({ question_id: oid }, { $set: { is_active: false } });
  await ChildQuestion.updateMany({ question_id: oid }, { $set: { is_active: false } });

  await Question.deleteOne({ _id: oid });

  return { permanently_deleted: true, id: String(oid) };
}

export async function batchTrashQuestions(ids: string[]) {
  const results: Array<{ id: string; trashed?: boolean; already_trashed?: boolean; error?: string }> = [];
  for (const id of ids) {
    try {
      const result = await deleteQuestion(id);
      results.push({
        id,
        trashed: Boolean(result.trashed),
        already_trashed: Boolean(result.already_trashed),
      });
    } catch (err) {
      results.push({ id, error: err instanceof Error ? err.message : 'Trash failed' });
    }
  }
  const trashed = results.filter((r) => r.trashed || r.already_trashed).length;
  const failed = results.filter((r) => r.error).length;
  return { trashed, failed, results };
}

export async function batchRestoreQuestions(ids: string[]) {
  const results: Array<{ id: string; restored?: boolean; error?: string }> = [];
  for (const id of ids) {
    try {
      await restoreQuestion(id);
      results.push({ id, restored: true });
    } catch (err) {
      results.push({ id, error: err instanceof Error ? err.message : 'Restore failed' });
    }
  }
  const restored = results.filter((r) => r.restored).length;
  const failed = results.filter((r) => r.error).length;
  return { restored, failed, results };
}

export async function batchPermanentlyDeleteQuestions(ids: string[]) {
  const results: Array<{ id: string; permanently_deleted?: boolean; error?: string }> = [];
  for (const id of ids) {
    try {
      await permanentlyDeleteQuestion(id);
      results.push({ id, permanently_deleted: true });
    } catch (err) {
      results.push({ id, error: err instanceof Error ? err.message : 'Permanent delete failed' });
    }
  }
  const deleted = results.filter((r) => r.permanently_deleted).length;
  const failed = results.filter((r) => r.error).length;
  return { deleted, failed, results };
}

/** Published -> quality_check for each id (skips/reports any that aren't currently published). */
export async function batchUnpublishQuestions(ids: string[], userId: string) {
  const results: Array<{ id: string; unpublished?: boolean; error?: string }> = [];
  for (const id of ids) {
    try {
      await unpublishQuestion(id, userId);
      results.push({ id, unpublished: true });
    } catch (err) {
      results.push({ id, error: err instanceof Error ? err.message : 'Unpublish failed' });
    }
  }
  const unpublished = results.filter((r) => r.unpublished).length;
  const failed = results.filter((r) => r.error).length;
  return { unpublished, failed, results };
}

/** Draft -> quality_check for each id (skips/reports any that aren't currently draft). */
export async function batchSubmitForQualityCheckQuestions(ids: string[], userId: string) {
  const results: Array<{ id: string; submitted?: boolean; error?: string }> = [];
  for (const id of ids) {
    try {
      await submitQuestionForQualityCheck(id, userId);
      results.push({ id, submitted: true });
    } catch (err) {
      results.push({ id, error: err instanceof Error ? err.message : 'Submit for quality check failed' });
    }
  }
  const submitted = results.filter((r) => r.submitted).length;
  const failed = results.filter((r) => r.error).length;
  return { submitted, failed, results };
}

/** List soft-deleted questions for the trash page. */
export async function listTrashedQuestions(filters: {
  q?: string;
  book_chapter_id?: string;
  book_info_id?: string;
  untagged?: boolean;
  sort?: string;
  limit?: number;
}) {
  const { items } = await listQuestions({
    q: filters.q,
    trashed: true,
    book_chapter_id: filters.book_chapter_id,
    book_info_id: filters.book_info_id,
    untagged: filters.untagged,
    sort: filters.sort,
    limit: filters.limit ?? 100,
    offset: 0,
  });
  return items;
}

/**
 * Draft -> quality_check. A question sits here for an admin to review before it can be published;
 * it stays unpublished the whole time, so no content validation is required to enter review.
 */
export async function submitQuestionForQualityCheck(id: string, userId: string) {
  const question = await Question.findById(id);
  if (!question || !question.is_active) throw notFound('Question not found');
  if (question.review_status !== 'draft') {
    throw badRequest('Only draft questions can be submitted for quality check');
  }
  question.review_status = 'quality_check';
  question.status_changed_by = new mongoose.Types.ObjectId(userId);
  await question.save();
  return loadQuestionDetail(id);
}

/** Quality_check -> draft, e.g. when review finds it needs more work. */
export async function returnQuestionToDraft(id: string, userId: string) {
  const question = await Question.findById(id);
  if (!question || !question.is_active) throw notFound('Question not found');
  if (question.review_status !== 'quality_check') {
    throw badRequest('Only questions in quality check can be sent back to draft');
  }
  question.review_status = 'draft';
  question.status_changed_by = new mongoose.Types.ObjectId(userId);
  await question.save();
  return loadQuestionDetail(id);
}

/**
 * Quality_check -> published. Requires the question to have already passed through quality check
 * (drafts can't publish directly) and to have real content (options+correct answer for MCQ/TF, a
 * comparison table for DIFFERENCES, a model answer for everything else).
 */
export async function publishQuestion(id: string, reviewerId: string) {
  const question = await Question.findById(id);
  if (!question || !question.is_active) throw notFound('Question not found');
  if (question.review_status !== 'quality_check') {
    throw badRequest('Submit this question for quality check before publishing');
  }

  const qType = await QuestionType.findById(question.question_type_id);
  if (!qType) throw notFound('Question type not found');

  if (qType.has_options) {
    const optionCount = await QuestionOption.countDocuments({ question_id: id });
    const minOptions = isTrueFalseType(qType.code) ? 2 : 2;
    if (optionCount < minOptions) throw badRequest('Question must have answer options before publishing');
    const hasCorrect = await QuestionAnswer.findOne({ question_id: id, is_correct: true });
    if (!hasCorrect) throw badRequest('Question must have a correct answer before publishing');
  } else {
    const detail = await QuestionAnswerDetail.findOne({ question_id: id });
    if (isDifferencesType(qType.code)) {
      if (!hasComparisonTableContent(detail?.model_answer_comparison as ComparisonTable | undefined)) {
        throw badRequest('Comparison table model answer is required before publishing');
      }
    } else {
      const modelSections = serializeExplanationSections(detail?.model_answer_sections);
      const hasModelAnswer =
        modelSections.length > 0 ||
        (typeof detail?.model_answer === 'string' && detail.model_answer.trim().length > 0);
      if (!hasModelAnswer) {
        throw badRequest('Model answer is required before publishing this question type');
      }
    }
  }

  question.is_published = true;
  question.review_status = 'published';
  question.reviewed_by = new mongoose.Types.ObjectId(reviewerId);
  question.status_changed_by = new mongoose.Types.ObjectId(reviewerId);
  await question.save();
  return loadQuestionDetail(id);
}

/** Published -> quality_check (not draft) — pulls a live question back for re-review. */
export async function unpublishQuestion(id: string, userId: string) {
  const question = await Question.findById(id);
  if (!question || !question.is_active) throw notFound('Question not found');
  question.is_published = false;
  question.review_status = 'quality_check';
  question.status_changed_by = new mongoose.Types.ObjectId(userId);
  await question.save();
  return loadQuestionDetail(id);
}

export async function batchImportMcqQuestions(dto: BatchMcqImportDto, createdBy: string) {
  let chapter: InstanceType<typeof BookChapter> | null = null;
  if (dto.book_chapter_id) {
    chapter = await BookChapter.findById(dto.book_chapter_id);
    if (!chapter || !chapter.is_active) throw notFound('Chapter not found');
  }

  const qType = await QuestionType.findOne({ code: 'MCQ', is_active: true });
  if (!qType) throw badRequest('MCQ question type is not configured. Create an MCQ type first.');

  const created: Array<{ row: number; id: string }> = [];
  const failed: Array<{ row: number; error: string }> = [];

  for (let i = 0; i < dto.rows.length; i++) {
    const row = dto.rows[i]!;
    const rowNumber = i + 1;
    try {
      const explanation = row.explanation?.trim();
      const createDto: CreateQuestionDto = {
        question_type_id: String(qType._id),
        body_en: row.question.trim(),
        body_bn: row.question.trim(),
        difficulty: dto.difficulty,
        marks: dto.marks,
        negative_marks: dto.negative_marks,
        time_seconds: dto.time_seconds,
        language: dto.language,
        options: [
          { option_key: 'a', option_text_en: row.option_a.trim(), option_text_bn: row.option_a.trim() },
          { option_key: 'b', option_text_en: row.option_b.trim(), option_text_bn: row.option_b.trim() },
          { option_key: 'c', option_text_en: row.option_c.trim(), option_text_bn: row.option_c.trim() },
          { option_key: 'd', option_text_en: row.option_d.trim(), option_text_bn: row.option_d.trim() },
        ],
        correct_option_key: row.correct_option,
        explanation_sections: explanation
          ? [{ title: 'Explanation', details: explanation, subsections: [] }]
          : [],
        book_links: chapter
          ? [
              {
                link_level: 'chapter',
                book_chapter_id: String(chapter._id),
              },
            ]
          : undefined,
      };

      const detail = await createQuestion(createDto, createdBy);
      created.push({ row: rowNumber, id: detail.id });
    } catch (err) {
      failed.push({
        row: rowNumber,
        error: err instanceof Error ? err.message : 'Failed to create question',
      });
    }
  }

  return {
    book_chapter_id: chapter ? String(chapter._id) : undefined,
    total: dto.rows.length,
    created_count: created.length,
    failed_count: failed.length,
    created,
    failed,
  };
}

export async function batchImportDescriptiveQuestions(
  dto: BatchDescriptiveImportDto,
  createdBy: string,
) {
  let chapter: InstanceType<typeof BookChapter> | null = null;
  if (dto.book_chapter_id) {
    chapter = await BookChapter.findById(dto.book_chapter_id);
    if (!chapter || !chapter.is_active) throw notFound('Chapter not found');
  }

  const qType = await resolveDescriptiveQuestionType(dto.question_type_id);
  if (!qType) {
    throw badRequest(
      'No Descriptive question type found. Use an existing non-option type (e.g. Descriptive) or activate it in question types.',
    );
  }
  if (qType.has_options) {
    throw badRequest(`Question type "${qType.name}" has options and cannot be used for descriptive import.`);
  }

  const created: Array<{ row: number; id: string }> = [];
  const failed: Array<{ row: number; error: string }> = [];

  for (let i = 0; i < dto.rows.length; i++) {
    const row = dto.rows[i]!;
    const rowNumber = i + 1;
    try {
      const title = row.title?.trim() ?? '';
      const description = row.description?.trim() ?? '';
      const note = row.note?.trim() ?? '';
      const model_answer_sections =
        title || description || note
          ? cleanExplanationSections([
              {
                title,
                details: description || undefined,
                note: note || undefined,
                subsections: [],
              },
            ])
          : [];

      const createDto: CreateQuestionDto = {
        question_type_id: String(qType._id),
        body_en: row.question.trim(),
        body_bn: row.question.trim(),
        difficulty: dto.difficulty,
        marks: dto.marks,
        negative_marks: dto.negative_marks,
        time_seconds: dto.time_seconds,
        language: dto.language,
        model_answer_sections,
        explanation_sections: [],
        book_links: chapter
          ? [
              {
                link_level: 'chapter',
                book_chapter_id: String(chapter._id),
              },
            ]
          : undefined,
      };

      const detail = await createQuestion(createDto, createdBy);
      created.push({ row: rowNumber, id: detail.id });
    } catch (err) {
      failed.push({
        row: rowNumber,
        error: err instanceof Error ? err.message : 'Failed to create question',
      });
    }
  }

  return {
    book_chapter_id: chapter ? String(chapter._id) : undefined,
    total: dto.rows.length,
    created_count: created.length,
    failed_count: failed.length,
    created,
    failed,
  };
}

/**
 * Prefer an existing Descriptive type — never create one.
 * Order: explicit id → code/name Descriptive (active or inactive) → other text types.
 */
async function resolveDescriptiveQuestionType(questionTypeId?: string) {
  if (questionTypeId) {
    const byId = await QuestionType.findById(questionTypeId);
    if (!byId) return null;
    if (!byId.is_active) {
      byId.is_active = true;
      await byId.save();
    }
    return byId;
  }

  const descriptiveMatch = await QuestionType.findOne({
    $or: [
      { code: { $regex: /^descriptive$/i } },
      { name: { $regex: /^descriptive$/i } },
    ],
  });
  if (descriptiveMatch) {
    if (!descriptiveMatch.is_active) {
      descriptiveMatch.is_active = true;
      await descriptiveMatch.save();
    }
    return descriptiveMatch;
  }

  const byNameContains = await QuestionType.findOne({
    has_options: false,
    name: { $regex: /descriptive/i },
    code: { $not: { $regex: /^differences?$/i } },
  });
  if (byNameContains) {
    if (!byNameContains.is_active) {
      byNameContains.is_active = true;
      await byNameContains.save();
    }
    return byNameContains;
  }

  return QuestionType.findOne({
    is_active: true,
    has_options: false,
    code: { $nin: ['DIFFERENCES', 'DIFFERENCE', 'DF', 'MCQ', 'TF'] },
  }).sort({ name: 1 });
}

export async function batchImportDifferencesQuestions(
  dto: BatchDifferencesImportDto,
  createdBy: string,
) {
  let chapter: InstanceType<typeof BookChapter> | null = null;
  if (dto.book_chapter_id) {
    chapter = await BookChapter.findById(dto.book_chapter_id);
    if (!chapter || !chapter.is_active) throw notFound('Chapter not found');
  }

  const qType = await resolveDifferencesQuestionType(dto.question_type_id);
  if (!qType) {
    throw badRequest(
      'No DIFFERENCES question type found. Create a question type with code "DIFFERENCES" first.',
    );
  }
  if (qType.has_options) {
    throw badRequest(`Question type "${qType.name}" has options and cannot be used for differences import.`);
  }

  const created: Array<{ row: number; id: string }> = [];
  const failed: Array<{ row: number; error: string }> = [];

  for (let i = 0; i < dto.rows.length; i++) {
    const row = dto.rows[i]!;
    const rowNumber = i + 1;
    try {
      const comparison = cleanComparisonTable(row.model_answer_comparison);
      if (!comparison) {
        throw badRequest('Comparison table needs at least 2 columns and 1 row with content');
      }

      const createDto: CreateQuestionDto = {
        question_type_id: String(qType._id),
        body_en: row.question.trim(),
        body_bn: row.question.trim(),
        difficulty: dto.difficulty,
        marks: dto.marks,
        negative_marks: dto.negative_marks,
        time_seconds: dto.time_seconds,
        language: dto.language,
        model_answer_comparison: comparison,
        model_answer_sections: [],
        explanation_sections: [],
        book_links: chapter
          ? [
              {
                link_level: 'chapter',
                book_chapter_id: String(chapter._id),
              },
            ]
          : undefined,
      };

      const detail = await createQuestion(createDto, createdBy);
      created.push({ row: rowNumber, id: detail.id });
    } catch (err) {
      failed.push({
        row: rowNumber,
        error: err instanceof Error ? err.message : 'Failed to create question',
      });
    }
  }

  return {
    book_chapter_id: chapter ? String(chapter._id) : undefined,
    total: dto.rows.length,
    created_count: created.length,
    failed_count: failed.length,
    created,
    failed,
  };
}

/**
 * Prefer an existing DIFFERENCES type — never create one.
 * Order: explicit id → code DIFFERENCES (exact, so `isDifferencesType` matches downstream) →
 * name DIFFERENCES as a last resort. Code is checked as its own query first — a combined
 * code-or-name query has no priority ordering and can match an unrelated legacy code (e.g. a
 * dormant "DF" type whose name also happens to be "Differences").
 */
async function resolveDifferencesQuestionType(questionTypeId?: string) {
  if (questionTypeId) {
    const byId = await QuestionType.findById(questionTypeId);
    if (!byId) return null;
    if (!byId.is_active) {
      byId.is_active = true;
      await byId.save();
    }
    return byId;
  }

  const byCode = await QuestionType.findOne({ code: { $regex: /^differences?$/i } }).sort({
    is_active: -1,
  });
  if (byCode) {
    if (!byCode.is_active) {
      byCode.is_active = true;
      await byCode.save();
    }
    return byCode;
  }

  const byName = await QuestionType.findOne({ name: { $regex: /^differences?$/i } }).sort({
    is_active: -1,
  });
  if (!byName) return null;
  if (!byName.is_active) {
    byName.is_active = true;
    await byName.save();
  }
  return byName;
}

/**
 * Mobile delta-sync. `since` (server clock from a prior call's `synced_at`) excludes anything
 * already pulled; `cursor` continues a run past a same-`updated_at` tie without skipping/repeating
 * rows (seek pagination on `(updated_at, _id)`, since offset/skip would drift as data changes
 * between pages). Soft-deleted/unpublished questions are returned in `data` as-is (the flags tell
 * the client to hide them); `deletions` covers hard deletes only, via the QuestionDeletion tombstone
 * (see permanentlyDeleteQuestion) since those otherwise vanish from the query with no trace.
 */
export async function listQuestionsSync(filters: {
  since?: Date;
  cursor?: string;
  limit?: number;
}): Promise<{
  data: QuestionSyncRow[];
  deletions: QuestionSyncDeletion[];
  has_more: boolean;
  next_cursor?: string;
  synced_at: string;
}> {
  const limit = Math.min(500, Math.max(1, filters.limit ?? 200));

  const seekFilter: Record<string, unknown> = {};
  if (filters.cursor) {
    const [cursorTs, cursorId] = filters.cursor.split('|');
    const cursorDate = cursorTs ? new Date(cursorTs) : undefined;
    if (cursorDate && !Number.isNaN(cursorDate.getTime()) && cursorId) {
      seekFilter.$or = [
        { updated_at: { $gt: cursorDate } },
        { updated_at: cursorDate, _id: { $gt: new mongoose.Types.ObjectId(cursorId) } },
      ];
    }
  } else if (filters.since) {
    seekFilter.updated_at = { $gt: filters.since };
  }

  const rows = await Question.find(seekFilter)
    .sort({ updated_at: 1, _id: 1 })
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const mcqIds = page.filter((q) => q.question_type_code === 'MCQ').map((q) => q._id);
  const [options, answers, details] = await Promise.all([
    QuestionOption.find({ question_id: { $in: mcqIds } }).sort({ option_key: 1 }),
    QuestionAnswer.find({ question_id: { $in: mcqIds } }),
    QuestionAnswerDetail.find({ question_id: { $in: mcqIds } }).lean(),
  ]);

  const optionsByQuestion = new Map<string, typeof options>();
  for (const o of options) {
    const key = String(o.question_id);
    const list = optionsByQuestion.get(key);
    if (list) list.push(o);
    else optionsByQuestion.set(key, [o]);
  }
  const correctOptionIdByQuestion = new Map<string, string>();
  for (const a of answers) {
    if (a.is_correct) correctOptionIdByQuestion.set(String(a.question_id), String(a.option_id));
  }
  const detailByQuestion = new Map(details.map((d) => [String(d.question_id), d]));

  // book_chapter_id lives directly on Question for most rows; older links-only questions
  // (no legacy field set) fall back to their primary QuestionBookLink, same as listMarathonReview.
  const missingChapterIds = page.filter((q) => !q.book_chapter_id).map((q) => q._id);
  const fallbackLinks = missingChapterIds.length
    ? await QuestionBookLink.find({
        question_id: { $in: missingChapterIds },
        is_active: true,
      }).sort({ sort_order: 1 })
    : [];
  const fallbackChapterByQuestion = new Map<string, string>();
  for (const link of fallbackLinks) {
    const key = String(link.question_id);
    if (!fallbackChapterByQuestion.has(key) && link.book_chapter_id) {
      fallbackChapterByQuestion.set(key, String(link.book_chapter_id));
    }
  }

  const chapterIdByQuestion = new Map<string, string>();
  for (const q of page) {
    const qid = String(q._id);
    const direct = idStr(q.book_chapter_id);
    const chapterId = direct ?? fallbackChapterByQuestion.get(qid);
    if (chapterId) chapterIdByQuestion.set(qid, chapterId);
  }

  const chapterIds = [...new Set([...chapterIdByQuestion.values()])];
  const chapters = chapterIds.length ? await BookChapter.find({ _id: { $in: chapterIds } }) : [];
  const chapterMap = new Map(chapters.map((c) => [String(c._id), c]));
  const bookIds = [...new Set(chapters.map((c) => String(c.book_info_id)))];
  const books = bookIds.length ? await BookInfo.find({ _id: { $in: bookIds } }) : [];
  const bookMap = new Map(books.map((b) => [String(b._id), b]));

  const data: QuestionSyncRow[] = page.map((q) => {
    const qidForBook = String(q._id);
    const chapterId = chapterIdByQuestion.get(qidForBook);
    const chapter = chapterId ? chapterMap.get(chapterId) : undefined;
    const book = chapter ? bookMap.get(String(chapter.book_info_id)) : undefined;

    const row: QuestionSyncRow = {
      id: String(q._id),
      question_type_code: q.question_type_code,
      body_en: q.body_en,
      body_bn: q.body_bn,
      difficulty: q.difficulty,
      marks: q.marks,
      time_seconds: q.time_seconds,
      is_published: q.is_published,
      is_active: q.is_active,
      book_chapter_id: idStr(q.book_chapter_id),
      book_topic_id: idStr(q.book_topic_id),
      book_sub_topic_id: idStr(q.book_sub_topic_id),
      regulation_id: idStr(q.regulation_id),
      book_id: book ? String(book._id) : undefined,
      book_name: book?.name,
      chapter_number: chapter?.chapter_number ?? undefined,
      chapter_name: chapter?.name,
      updated_at: q.updated_at.toISOString(),
    };

    if (q.question_type_code !== 'MCQ') return row;

    const qid = String(q._id);
    const correctOptionId = correctOptionIdByQuestion.get(qid);
    row.options = (optionsByQuestion.get(qid) ?? []).map((o) => ({
      id: String(o._id),
      option_key: o.option_key,
      option_text_en: o.option_text_en,
      option_text_bn: o.option_text_bn,
      is_correct: correctOptionId === String(o._id),
    }));

    const detail = detailByQuestion.get(qid) ?? null;
    let explanationSections = serializeExplanationSections(detail?.explanation_sections);
    if (
      explanationSections.length === 0 &&
      typeof detail?.explanation === 'string' &&
      detail.explanation.trim()
    ) {
      explanationSections = parseLegacyExplanation(detail.explanation);
    }
    row.explanation_sections = explanationSections;

    return row;
  });

  // Deletions: rare compared to updates, so a single limit-capped page per sync call is enough in
  // practice today; not seek-paginated like `data` above.
  const deletionFilter: Record<string, unknown> = filters.since
    ? { deleted_at: { $gt: filters.since } }
    : {};
  const deletionRows = await QuestionDeletion.find(deletionFilter)
    .sort({ deleted_at: 1 })
    .limit(limit);
  const deletions: QuestionSyncDeletion[] = deletionRows.map((d) => ({
    question_id: String(d.question_id),
    deleted_at: d.deleted_at.toISOString(),
  }));

  const last = data[data.length - 1];
  return {
    data,
    deletions,
    has_more: hasMore,
    next_cursor: hasMore && last ? `${last.updated_at}|${last.id}` : undefined,
    synced_at: new Date().toISOString(),
  };
}
