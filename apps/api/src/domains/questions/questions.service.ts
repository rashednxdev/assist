import mongoose from 'mongoose';
import type {
  BatchDescriptiveImportDto,
  BatchMcqImportDto,
  CreateQuestionDto,
  CreateQuestionTypeDto,
  QuestionBookLinkInput,
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
import { notFound, badRequest } from '../../shared/errors/AppError.js';
import {
  escapeRegex,
  extractSearchKeywords,
  questionSimilarity,
} from './question-similarity.js';

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
    book_chapter_id: idStr(link.book_chapter_id ?? chapter?._id),
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
    book_chapter_id: idStr(q.book_chapter_id),
    book_topic_id: idStr(q.book_topic_id),
    book_sub_topic_id: idStr(q.book_sub_topic_id),
    regulation_id: idStr(q.regulation_id),
    book_link_count: 0,
    option_count: optionCount,
    created_at: q.created_at,
    updated_at: q.updated_at,
  };
}

async function loadQuestionDetail(questionId: string) {
  const question = await Question.findById(questionId);
  if (!question || !question.is_active) throw notFound('Question not found');

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
    book_links,
    body_en: question.body_en,
    body_bn: question.body_bn,
    difficulty: question.difficulty,
    marks: question.marks,
    negative_marks: question.negative_marks,
    time_seconds: question.time_seconds,
    is_published: question.is_published,
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
        ? await loadModelAnswerSections(question._id, detail as IQuestionAnswerDetail | null)
        : undefined,
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
  question_type_id: string;
  exclude_id?: string;
  threshold?: number;
  limit?: number;
}) {
  const text = params.text.trim();
  const threshold = params.threshold ?? 0.6;
  const limit = params.limit ?? 8;
  if (text.length < 8) return [];

  const qType = await QuestionType.findById(params.question_type_id);
  if (!qType || !qType.is_active) throw notFound('Question type not found');

  const query: Record<string, unknown> = {
    is_active: true,
    question_type_id: qType._id,
  };
  if (params.exclude_id) {
    query._id = { $ne: new mongoose.Types.ObjectId(params.exclude_id) };
  }

  const keywords = extractSearchKeywords(text);
  if (keywords.length > 0) {
    query.$or = keywords.flatMap((w) => [
      { body_en: { $regex: escapeRegex(w), $options: 'i' } },
      { body_bn: { $regex: escapeRegex(w), $options: 'i' } },
    ]);
  }

  let candidates = await Question.find(query)
    .select('body_en body_bn question_type_code is_published')
    .sort({ updated_at: -1 })
    .limit(200);

  if (candidates.length === 0) {
    const fallbackQuery: Record<string, unknown> = {
      is_active: true,
      question_type_id: qType._id,
    };
    if (params.exclude_id) {
      fallbackQuery._id = { $ne: new mongoose.Types.ObjectId(params.exclude_id) };
    }
    candidates = await Question.find(fallbackQuery)
      .select('body_en body_bn question_type_code is_published')
      .sort({ updated_at: -1 })
      .limit(150);
  }

  return candidates
    .map((q) => {
      const scoreEn = questionSimilarity(text, q.body_en);
      const scoreBn = q.body_bn ? questionSimilarity(text, q.body_bn) : 0;
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

export async function listQuestions(filters: {
  q?: string;
  difficulty?: string;
  question_type_id?: string;
  question_type_code?: string;
  is_published?: boolean;
  book_chapter_id?: string;
  book_topic_id?: string;
  book_sub_topic_id?: string;
  regulation_id?: string;
  limit: number;
}) {
  const query: Record<string, unknown> = { is_active: true };
  if (filters.difficulty) query.difficulty = filters.difficulty;
  if (filters.question_type_id) query.question_type_id = filters.question_type_id;
  if (filters.question_type_code) query.question_type_code = filters.question_type_code;
  if (filters.is_published !== undefined) query.is_published = filters.is_published;
  if (filters.book_chapter_id) query.book_chapter_id = filters.book_chapter_id;
  if (filters.book_topic_id) query.book_topic_id = filters.book_topic_id;
  if (filters.book_sub_topic_id) query.book_sub_topic_id = filters.book_sub_topic_id;
  if (filters.regulation_id) query.regulation_id = filters.regulation_id;

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    query.$or = [{ body_en: { $regex: q, $options: 'i' } }, { body_bn: { $regex: q, $options: 'i' } }];
  }

  const items = await Question.find(query).sort({ updated_at: -1 }).limit(filters.limit);
  const typeIds = [...new Set(items.map((q) => String(q.question_type_id)))];
  const types = await QuestionType.find({ _id: { $in: typeIds } });
  const typeMap = new Map(types.map((t) => [String(t._id), t.name]));

  const questionIds = items.map((q) => q._id);
  const linkCounts = await QuestionBookLink.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: { question_id: { $in: questionIds }, is_active: true } },
    { $group: { _id: '$question_id', count: { $sum: 1 } } },
  ]);
  const linkCountMap = new Map(linkCounts.map((c) => [String(c._id), c.count]));

  const result = await Promise.all(
    items.map(async (q) => {
      const optionCount = await QuestionOption.countDocuments({ question_id: q._id });
      const item = serializeQuestionListItem(q, typeMap.get(String(q.question_type_id)), optionCount);
      const storedCount = linkCountMap.get(String(q._id)) ?? 0;
      item.book_link_count = storedCount > 0 ? storedCount : q.book_chapter_id ? 1 : 0;
      return item;
    }),
  );
  return result;
}

/** Published MCQs linked to books/chapters, with explanations for marathon review. */
export async function listMarathonReview(filters: { q?: string } = {}) {
  const query: Record<string, unknown> = {
    is_active: true,
    is_published: true,
    question_type_code: 'MCQ',
  };
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    query.$or = [{ body_en: { $regex: q, $options: 'i' } }, { body_bn: { $regex: q, $options: 'i' } }];
  }

  const questions = await Question.find(query).limit(3000);
  if (questions.length === 0) return [];

  const questionIds = questions.map((q) => q._id);
  const [links, details] = await Promise.all([
    QuestionBookLink.find({ question_id: { $in: questionIds }, is_active: true }).sort({ sort_order: 1 }),
    QuestionAnswerDetail.find({ question_id: { $in: questionIds } }).lean(),
  ]);

  const linkByQuestion = new Map<string, (typeof links)[number]>();
  for (const link of links) {
    const key = String(link.question_id);
    if (!linkByQuestion.has(key)) linkByQuestion.set(key, link);
  }

  const detailByQuestion = new Map(details.map((d) => [String(d.question_id), d]));

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

  type Row = {
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
    explanation_sections: ExplanationSection[];
  };

  const rows: Row[] = [];
  for (const q of questions) {
    const qid = String(q._id);
    const chapterId = chapterIdByQuestion.get(qid);
    if (!chapterId) continue;
    const chapter = chapterMap.get(chapterId);
    if (!chapter) continue;
    const book = bookMap.get(String(chapter.book_info_id));
    if (!book) continue;

    const detail = detailByQuestion.get(qid) ?? null;
    let explanation_sections = serializeExplanationSections(detail?.explanation_sections);
    if (
      explanation_sections.length === 0 &&
      typeof detail?.explanation === 'string' &&
      detail.explanation.trim()
    ) {
      explanation_sections = parseLegacyExplanation(detail.explanation);
    }

    rows.push({
      id: qid,
      body_en: q.body_en,
      body_bn: q.body_bn,
      book_id: String(book._id),
      book_name: book.short_name?.trim() || book.name,
      chapter_id: chapterId,
      chapter_number: chapter.chapter_number ?? '',
      chapter_name: chapter.name,
      chapter_sort_order: chapter.sort_order ?? 0,
      book_sort_key: book.name,
      explanation_sections,
    });
  }

  rows.sort(
    (a, b) =>
      a.book_sort_key.localeCompare(b.book_sort_key) ||
      a.chapter_sort_order - b.chapter_sort_order ||
      a.chapter_number.localeCompare(b.chapter_number) ||
      a.body_en.localeCompare(b.body_en),
  );

  return rows.map(({ book_sort_key: _b, chapter_sort_order: _c, ...item }, index) => ({
    ...item,
    number: index + 1,
  }));
}

export async function getQuestionById(id: string) {
  return loadQuestionDetail(id);
}

export async function createQuestion(dto: CreateQuestionDto, createdBy: string) {
  const qType = await QuestionType.findById(dto.question_type_id);
  if (!qType || !qType.is_active) throw notFound('Question type not found');

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
    is_active: true,
    created_by: new mongoose.Types.ObjectId(createdBy),
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
    await applyAnswerPayload(question._id, qType, dto as CreateQuestionDto);
  } else if (dto.note !== undefined || dto.reference_regulation_id !== undefined) {
    await saveAnswerDetail(question._id, {
      note: dto.note,
      reference_regulation_id: dto.reference_regulation_id,
    });
  }

  return loadQuestionDetail(id);
}

export async function deleteQuestion(id: string) {
  const question = await Question.findById(id);
  if (!question) throw notFound('Question not found');
  question.is_active = false;
  question.is_published = false;
  await question.save();
  return { deleted: true };
}

export async function publishQuestion(id: string, reviewerId: string) {
  const question = await Question.findById(id);
  if (!question || !question.is_active) throw notFound('Question not found');

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
  question.reviewed_by = new mongoose.Types.ObjectId(reviewerId);
  await question.save();
  return loadQuestionDetail(id);
}

export async function unpublishQuestion(id: string) {
  const question = await Question.findById(id);
  if (!question || !question.is_active) throw notFound('Question not found');
  question.is_published = false;
  await question.save();
  return loadQuestionDetail(id);
}

export async function batchImportMcqQuestions(dto: BatchMcqImportDto, createdBy: string) {
  const chapter = await BookChapter.findById(dto.book_chapter_id);
  if (!chapter || !chapter.is_active) throw notFound('Chapter not found');

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
        book_links: [
          {
            link_level: 'chapter',
            book_chapter_id: String(chapter._id),
          },
        ],
      };

      const detail = await createQuestion(createDto, createdBy);
      if (dto.publish) {
        await publishQuestion(detail.id, createdBy);
      }
      created.push({ row: rowNumber, id: detail.id });
    } catch (err) {
      failed.push({
        row: rowNumber,
        error: err instanceof Error ? err.message : 'Failed to create question',
      });
    }
  }

  return {
    book_chapter_id: String(chapter._id),
    total: dto.rows.length,
    created_count: created.length,
    failed_count: failed.length,
    published: dto.publish,
    created,
    failed,
  };
}

export async function batchImportDescriptiveQuestions(
  dto: BatchDescriptiveImportDto,
  createdBy: string,
) {
  const chapter = await BookChapter.findById(dto.book_chapter_id);
  if (!chapter || !chapter.is_active) throw notFound('Chapter not found');

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
        book_links: [
          {
            link_level: 'chapter',
            book_chapter_id: String(chapter._id),
          },
        ],
      };

      const detail = await createQuestion(createDto, createdBy);
      if (dto.publish) {
        await publishQuestion(detail.id, createdBy);
      }
      created.push({ row: rowNumber, id: detail.id });
    } catch (err) {
      failed.push({
        row: rowNumber,
        error: err instanceof Error ? err.message : 'Failed to create question',
      });
    }
  }

  return {
    book_chapter_id: String(chapter._id),
    total: dto.rows.length,
    created_count: created.length,
    failed_count: failed.length,
    published: dto.publish,
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
