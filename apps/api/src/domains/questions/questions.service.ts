import mongoose from 'mongoose';
import type {
  CreateQuestionDto,
  CreateQuestionTypeDto,
  UpdateQuestionDto,
  UpdateQuestionTypeDto,
} from '@ibas/shared-types';
import { QuestionType } from './models/QuestionType.model.js';
import { Question } from './models/Question.model.js';
import { QuestionOption } from './models/QuestionOption.model.js';
import { QuestionAnswer } from './models/QuestionAnswer.model.js';
import { QuestionAnswerDetail } from './models/QuestionAnswerDetail.model.js';
import { notFound, badRequest } from '../../shared/errors/AppError.js';

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
    option_count: optionCount,
    created_at: q.created_at,
    updated_at: q.updated_at,
  };
}

async function loadQuestionDetail(questionId: string) {
  const question = await Question.findById(questionId);
  if (!question || !question.is_active) throw notFound('Question not found');

  const qType = await QuestionType.findById(question.question_type_id);
  const [options, answers, detail] = await Promise.all([
    QuestionOption.find({ question_id: questionId }).sort({ option_key: 1 }),
    QuestionAnswer.find({ question_id: questionId }),
    QuestionAnswerDetail.findOne({ question_id: questionId }),
  ]);

  const correctAnswer = answers.find((a) => a.is_correct);
  const correctOption = correctAnswer
    ? options.find((o) => String(o._id) === String(correctAnswer.option_id))
    : undefined;

  let linkLevel: 'chapter' | 'rule' | 'sub_rule' | undefined;
  if (question.book_sub_topic_id) linkLevel = 'sub_rule';
  else if (question.book_topic_id) linkLevel = 'rule';
  else if (question.book_chapter_id) linkLevel = 'chapter';

  return {
    id: String(question._id),
    question_type_id: String(question.question_type_id),
    question_type_code: question.question_type_code,
    question_type_name: qType?.name,
    has_options: qType?.has_options ?? false,
    link_level: linkLevel,
    book_chapter_id: idStr(question.book_chapter_id),
    book_topic_id: idStr(question.book_topic_id),
    book_sub_topic_id: idStr(question.book_sub_topic_id),
    regulation_id: idStr(question.regulation_id),
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
      isTrueFalseType(question.question_type_code) && correctOption
        ? correctOption.option_key === 'a'
          ? 'true'
          : 'false'
        : undefined,
    model_answer: qType?.has_options ? undefined : detail?.explanation,
    explanation: qType?.has_options ? detail?.explanation : undefined,
    note: detail?.note,
    reference_regulation_id: idStr(detail?.reference_regulation_id),
  };
}

async function saveAnswerDetail(
  questionId: mongoose.Types.ObjectId,
  explanation?: string,
  note?: string,
  referenceRegulationId?: string,
) {
  if (explanation?.trim()) {
    await QuestionAnswerDetail.findOneAndUpdate(
      { question_id: questionId },
      {
        explanation: explanation.trim(),
        note: note?.trim() || undefined,
        reference_regulation_id: referenceRegulationId
          ? new mongoose.Types.ObjectId(referenceRegulationId)
          : undefined,
      },
      { upsert: true, new: true },
    );
  } else {
    await QuestionAnswerDetail.deleteOne({ question_id: questionId });
  }
}

async function replaceOptionsAndAnswer(
  questionId: mongoose.Types.ObjectId,
  options: NonNullable<CreateQuestionDto['options']>,
  correctOptionKey: string,
  explanation?: string,
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

  await saveAnswerDetail(questionId, explanation, note, referenceRegulationId);
}

async function replaceTextAnswer(
  questionId: mongoose.Types.ObjectId,
  modelAnswer: string,
  note?: string,
  referenceRegulationId?: string,
) {
  await QuestionOption.deleteMany({ question_id: questionId });
  await QuestionAnswer.deleteMany({ question_id: questionId });
  await saveAnswerDetail(questionId, modelAnswer, note, referenceRegulationId);
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
  if (qType.has_options) {
    const resolved = resolveOptionPayload(dto as CreateQuestionDto, qType.code);
    await replaceOptionsAndAnswer(
      questionId,
      resolved.options,
      resolved.correctOptionKey,
      dto.explanation,
      dto.note,
      dto.reference_regulation_id,
    );
    return;
  }

  const modelAnswer = dto.model_answer?.trim() || dto.explanation?.trim();
  if (!modelAnswer) throw badRequest('Model answer is required for this question type');
  await replaceTextAnswer(questionId, modelAnswer, dto.note, dto.reference_regulation_id);
}

function applyBookLinks(question: InstanceType<typeof Question>, dto: CreateQuestionDto | UpdateQuestionDto) {
  if (dto.link_level === 'chapter') {
    question.book_topic_id = undefined;
    question.book_sub_topic_id = undefined;
  } else if (dto.link_level === 'rule') {
    question.book_sub_topic_id = undefined;
  }
}

export async function listQuestionTypes() {
  const items = await QuestionType.find({ is_active: true }).sort({ name: 1 });
  return items.map((t) => ({
    id: String(t._id),
    name: t.name,
    code: t.code,
    has_options: t.has_options,
    note: t.note,
  }));
}

export async function createQuestionType(dto: CreateQuestionTypeDto) {
  const existing = await QuestionType.findOne({ code: dto.code });
  if (existing) throw badRequest(`Question type code "${dto.code}" already exists`);
  const item = await QuestionType.create({ ...dto, is_active: true });
  return {
    id: String(item._id),
    name: item.name,
    code: item.code,
    has_options: item.has_options,
    note: item.note,
  };
}

function serializeQuestionType(t: InstanceType<typeof QuestionType>) {
  return {
    id: String(t._id),
    name: t.name,
    code: t.code,
    has_options: t.has_options,
    note: t.note,
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
  return serializeQuestionType(item);
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

  const result = await Promise.all(
    items.map(async (q) => {
      const optionCount = await QuestionOption.countDocuments({ question_id: q._id });
      return serializeQuestionListItem(q, typeMap.get(String(q.question_type_id)), optionCount);
    }),
  );
  return result;
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
    book_chapter_id: dto.book_chapter_id ? new mongoose.Types.ObjectId(dto.book_chapter_id) : undefined,
    book_topic_id: dto.book_topic_id ? new mongoose.Types.ObjectId(dto.book_topic_id) : undefined,
    book_sub_topic_id: dto.book_sub_topic_id ? new mongoose.Types.ObjectId(dto.book_sub_topic_id) : undefined,
    regulation_id: dto.regulation_id ? new mongoose.Types.ObjectId(dto.regulation_id) : undefined,
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

  applyBookLinks(question, dto);
  await question.save();
  await applyAnswerPayload(question._id, qType, dto);

  return loadQuestionDetail(String(question._id));
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
  if (dto.book_chapter_id !== undefined) {
    question.book_chapter_id = dto.book_chapter_id
      ? new mongoose.Types.ObjectId(dto.book_chapter_id)
      : undefined;
  }
  if (dto.book_topic_id !== undefined) {
    question.book_topic_id = dto.book_topic_id ? new mongoose.Types.ObjectId(dto.book_topic_id) : undefined;
  }
  if (dto.book_sub_topic_id !== undefined) {
    question.book_sub_topic_id = dto.book_sub_topic_id
      ? new mongoose.Types.ObjectId(dto.book_sub_topic_id)
      : undefined;
  }
  if (dto.regulation_id !== undefined) {
    question.regulation_id = dto.regulation_id ? new mongoose.Types.ObjectId(dto.regulation_id) : undefined;
  }

  if (dto.link_level) applyBookLinks(question, dto as CreateQuestionDto);

  await question.save();

  const hasAnswerUpdate =
    dto.options !== undefined ||
    dto.correct_option_key !== undefined ||
    dto.correct_true_false !== undefined ||
    dto.model_answer !== undefined ||
    dto.explanation !== undefined;

  if (hasAnswerUpdate) {
    await applyAnswerPayload(question._id, qType, dto as CreateQuestionDto);
  } else if (dto.note !== undefined || dto.reference_regulation_id !== undefined) {
    const existing = await QuestionAnswerDetail.findOne({ question_id: question._id });
    if (existing?.explanation) {
      await saveAnswerDetail(
        question._id,
        existing.explanation,
        dto.note ?? existing.note,
        dto.reference_regulation_id ?? idStr(existing.reference_regulation_id),
      );
    }
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
    if (!detail?.explanation?.trim()) {
      throw badRequest('Model answer is required before publishing this question type');
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
