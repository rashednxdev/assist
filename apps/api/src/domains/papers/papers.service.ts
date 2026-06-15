import mongoose from 'mongoose';
import type {
  CreatePaperTypeDto,
  UpdatePaperTypeDto,
  CreatePaperDto,
  UpdatePaperDto,
  ListPapersQuery,
  CreatePaperGroupDto,
  UpdatePaperGroupDto,
  CreatePaperQuestionDto,
  UpdatePaperQuestionDto,
  CreateChildQuestionDto,
  UpdateChildQuestionDto,
} from '@ibas/shared-types';
import { PaperType } from './models/PaperType.model.js';
import { PaperDetail } from './models/PaperDetail.model.js';
import { PaperGroup } from './models/PaperGroup.model.js';
import { PaperQuestion } from './models/PaperQuestion.model.js';
import { ChildQuestion } from './models/ChildQuestion.model.js';
import { ExamSubject } from '../exams/models/ExamSubject.model.js';
import { ExamPart } from '../exams/models/ExamPart.model.js';
import { ExamName } from '../exams/models/ExamName.model.js';
import { Question } from '../questions/models/Question.model.js';
import { QuestionType } from '../questions/models/QuestionType.model.js';
import { notFound, badRequest } from '../../shared/errors/AppError.js';

function idStr(v: mongoose.Types.ObjectId | string | undefined) {
  return v ? String(v) : undefined;
}

async function assertPublishedQuestion(questionId: string) {
  const q = await Question.findById(questionId);
  if (!q || !q.is_active) throw notFound('Question not found');
  if (!q.is_published) throw badRequest('Only published questions can be added to a paper');
  return q;
}

async function getPaperOrThrow(id: string, requireUnpublished = false) {
  const paper = await PaperDetail.findById(id);
  if (!paper || !paper.is_active) throw notFound('Paper not found');
  if (requireUnpublished && paper.is_published) {
    throw badRequest('Published papers cannot be modified');
  }
  return paper;
}

async function enrichSubject(examSubjectId: mongoose.Types.ObjectId | string) {
  const subject = await ExamSubject.findById(examSubjectId);
  if (!subject) return {};
  const part = await ExamPart.findById(subject.exam_part_id);
  const exam = part ? await ExamName.findById(part.exam_name_id) : null;
  return {
    exam_subject_name: subject.name,
    exam_name: exam?.name,
    exam_short_name: exam?.short_name,
  };
}

function serializePaperType(t: InstanceType<typeof PaperType>) {
  return {
    id: String(t._id),
    name: t.name,
    code: t.code,
    description: t.description,
    is_active: t.is_active,
  };
}

function serializePaper(
  p: InstanceType<typeof PaperDetail>,
  extras: Record<string, unknown> = {},
) {
  return {
    id: String(p._id),
    exam_subject_id: String(p.exam_subject_id),
    paper_type_id: String(p.paper_type_id),
    name: p.name,
    total_marks: p.total_marks,
    pass_marks: p.pass_marks,
    duration_minutes: p.duration_minutes,
    instructions: p.instructions,
    is_published: p.is_published,
    is_active: p.is_active,
    created_by: String(p.created_by),
    created_at: p.created_at,
    ...extras,
  };
}

async function enrichQuestion(q: InstanceType<typeof Question>) {
  const type = await QuestionType.findById(q.question_type_id);
  return {
    id: String(q._id),
    question_type_code: q.question_type_code,
    question_type_name: type?.name,
    body_en: q.body_en,
    difficulty: q.difficulty,
    marks: q.marks,
    is_published: q.is_published,
  };
}

async function computePaperMarks(paperId: mongoose.Types.ObjectId) {
  const questions = await PaperQuestion.find({ paper_id: paperId, is_active: true });
  const pqIds = questions.map((q) => q._id);
  const children = await ChildQuestion.find({ paper_question_id: { $in: pqIds }, is_active: true });
  const childMarksByPq = new Map<string, number>();
  for (const c of children) {
    const key = String(c.paper_question_id);
    childMarksByPq.set(key, (childMarksByPq.get(key) ?? 0) + c.marks);
  }
  let total = 0;
  for (const pq of questions) {
    const childTotal = childMarksByPq.get(String(pq._id)) ?? 0;
    total += childTotal > 0 ? childTotal : pq.marks;
  }
  return total;
}

async function validatePaperForPublish(paper: InstanceType<typeof PaperDetail>) {
  const questions = await PaperQuestion.find({ paper_id: paper._id, is_active: true });
  if (questions.length === 0) throw badRequest('Paper must have at least one question before publishing');

  for (const pq of questions) {
    const fromBank = !isCompositePaperQuestion(pq);
    if (fromBank) {
      if (!pq.question_id) throw badRequest('Bank question slot is missing its question reference');
      await assertPublishedQuestion(String(pq.question_id));
    } else {
      if (!pq.header_text?.trim()) {
        throw badRequest(`Composite question #${pq.question_number} needs header text before publishing`);
      }
      const parts = await ChildQuestion.find({ paper_question_id: pq._id, is_active: true });
      if (parts.length === 0) {
        throw badRequest(`Composite question #${pq.question_number} must have at least one sub-part`);
      }
      for (const part of parts) {
        await assertPublishedQuestion(String(part.question_id));
      }
    }
  }

  const allocated = await computePaperMarks(paper._id);
  if (allocated !== paper.total_marks) {
    throw badRequest(
      `Allocated marks (${allocated}) must equal paper total marks (${paper.total_marks}) before publishing`,
    );
  }
}

function isCompositePaperQuestion(pq: InstanceType<typeof PaperQuestion>) {
  return pq.from_question_bank === false || (!pq.question_id && Boolean(pq.header_text?.trim()));
}

function serializePaperQuestionRow(
  pq: InstanceType<typeof PaperQuestion>,
  enrichedMap: Map<string, Awaited<ReturnType<typeof enrichQuestion>>>,
  childrenByPq: Map<string, InstanceType<typeof ChildQuestion>[]>,
) {
  const isComposite = isCompositePaperQuestion(pq);
  return {
    id: String(pq._id),
    from_question_bank: !isComposite,
    question_id: pq.question_id ? String(pq.question_id) : undefined,
    header_text: pq.header_text,
    question_number: pq.question_number,
    display_question_number: pq.display_question_number,
    marks: pq.marks,
    marks_display_bn: pq.marks_display_bn,
    is_compulsory: pq.is_compulsory,
    question: pq.question_id ? enrichedMap.get(String(pq.question_id)) : undefined,
    parts: (childrenByPq.get(String(pq._id)) ?? []).map((c) => ({
      id: String(c._id),
      question_id: String(c.question_id),
      part_label: c.part_label,
      marks: c.marks,
      marks_display_bn: c.marks_display_bn,
      question: enrichedMap.get(String(c.question_id)),
    })),
  };
}

// --- Paper types ---

export async function listPaperTypes() {
  const items = await PaperType.find({ is_active: true }).sort({ name: 1 });
  return items.map(serializePaperType);
}

export async function createPaperType(dto: CreatePaperTypeDto) {
  const existing = await PaperType.findOne({ code: dto.code.toUpperCase() });
  if (existing) throw badRequest('Paper type code already exists');
  const t = await PaperType.create({
    ...dto,
    code: dto.code.toUpperCase(),
    is_active: true,
  });
  return serializePaperType(t);
}

export async function updatePaperType(id: string, dto: UpdatePaperTypeDto) {
  const t = await PaperType.findById(id);
  if (!t) throw notFound('Paper type not found');
  if (dto.code) dto.code = dto.code.toUpperCase();
  Object.assign(t, dto);
  await t.save();
  return serializePaperType(t);
}

export async function deletePaperType(id: string) {
  const t = await PaperType.findById(id);
  if (!t) throw notFound('Paper type not found');
  const inUse = await PaperDetail.countDocuments({ paper_type_id: t._id, is_active: true });
  if (inUse > 0) throw badRequest('Cannot delete: papers still use this type');
  t.is_active = false;
  await t.save();
  return { deleted: true };
}

// --- Papers ---

export async function listPapers(filters: ListPapersQuery) {
  const query: Record<string, unknown> = { is_active: true };
  if (filters.exam_subject_id) query.exam_subject_id = filters.exam_subject_id;
  if (filters.is_published === 'true') query.is_published = true;
  if (filters.is_published === 'false') query.is_published = false;

  const papers = await PaperDetail.find(query).sort({ created_at: -1 });
  const typeIds = [...new Set(papers.map((p) => String(p.paper_type_id)))];
  const types = await PaperType.find({ _id: { $in: typeIds } });
  const typeMap = new Map(types.map((t) => [String(t._id), t]));

  const enriched = await Promise.all(
    papers.map(async (p) => {
      const subjectInfo = await enrichSubject(p.exam_subject_id);
      const type = typeMap.get(String(p.paper_type_id));
      const questionCount = await PaperQuestion.countDocuments({ paper_id: p._id, is_active: true });
      return serializePaper(p, {
        ...subjectInfo,
        paper_type_name: type?.name,
        paper_type_code: type?.code,
        question_count: questionCount,
      });
    }),
  );
  return enriched;
}

export async function getPaperById(id: string) {
  const paper = await getPaperOrThrow(id);
  const [subjectInfo, type] = await Promise.all([
    enrichSubject(paper.exam_subject_id),
    PaperType.findById(paper.paper_type_id),
  ]);
  const questionCount = await PaperQuestion.countDocuments({ paper_id: paper._id, is_active: true });
  const allocatedMarks = await computePaperMarks(paper._id);
  return serializePaper(paper, {
    ...subjectInfo,
    paper_type_name: type?.name,
    paper_type_code: type?.code,
    question_count: questionCount,
    allocated_marks: allocatedMarks,
  });
}

export async function getPaperCompose(id: string) {
  const paper = await getPaperById(id);
  const groups = await PaperGroup.find({ paper_id: id, is_active: true }).sort({ group_number: 1 });
  const questions = await PaperQuestion.find({ paper_id: id, is_active: true }).sort({ question_number: 1 });
  const pqIds = questions.map((q) => q._id);
  const children = await ChildQuestion.find({ paper_question_id: { $in: pqIds }, is_active: true }).sort({
    part_label: 1,
  });

  const questionIds = [
    ...questions.map((q) => q.question_id).filter(Boolean),
    ...children.map((c) => c.question_id),
  ];
  const uniqueQIds = [...new Set(questionIds.map(String))];
  const questionDocs = await Question.find({ _id: { $in: uniqueQIds } });
  const enrichedMap = new Map(
    await Promise.all(questionDocs.map(async (q) => [String(q._id), await enrichQuestion(q)] as const)),
  );

  const childrenByPq = new Map<string, typeof children>();
  for (const c of children) {
    const key = String(c.paper_question_id);
    if (!childrenByPq.has(key)) childrenByPq.set(key, []);
    childrenByPq.get(key)!.push(c);
  }

  const questionsByGroup = new Map<string | 'ungrouped', typeof questions>();
  for (const pq of questions) {
    const key = pq.paper_group_id ? String(pq.paper_group_id) : 'ungrouped';
    if (!questionsByGroup.has(key)) questionsByGroup.set(key, []);
    questionsByGroup.get(key)!.push(pq);
  }

  return {
    paper,
    groups: groups.map((g) => ({
      id: String(g._id),
      name: g.name,
      group_number: g.group_number,
      marks: g.marks,
      instructions: g.instructions,
      questions: (questionsByGroup.get(String(g._id)) ?? []).map((pq) =>
        serializePaperQuestionRow(pq, enrichedMap, childrenByPq),
      ),
    })),
    ungrouped_questions: (questionsByGroup.get('ungrouped') ?? []).map((pq) =>
      serializePaperQuestionRow(pq, enrichedMap, childrenByPq),
    ),
  };
}

export async function createPaper(dto: CreatePaperDto, userId: string) {
  const [subject, type] = await Promise.all([
    ExamSubject.findById(dto.exam_subject_id),
    PaperType.findById(dto.paper_type_id),
  ]);
  if (!subject || !subject.is_active) throw notFound('Exam subject not found');
  if (!type || !type.is_active) throw notFound('Paper type not found');
  if (dto.pass_marks > dto.total_marks) throw badRequest('Pass marks cannot exceed total marks');

  const paper = await PaperDetail.create({
    ...dto,
    is_published: false,
    is_active: true,
    created_by: new mongoose.Types.ObjectId(userId),
    created_at: new Date(),
  });
  return getPaperById(String(paper._id));
}

export async function updatePaper(id: string, dto: UpdatePaperDto) {
  const paper = await getPaperOrThrow(id, true);
  if (dto.exam_subject_id) {
    const subject = await ExamSubject.findById(dto.exam_subject_id);
    if (!subject || !subject.is_active) throw notFound('Exam subject not found');
  }
  if (dto.paper_type_id) {
    const type = await PaperType.findById(dto.paper_type_id);
    if (!type || !type.is_active) throw notFound('Paper type not found');
  }
  if (dto.total_marks !== undefined && dto.pass_marks !== undefined && dto.pass_marks > dto.total_marks) {
    throw badRequest('Pass marks cannot exceed total marks');
  }
  const total = dto.total_marks ?? paper.total_marks;
  const pass = dto.pass_marks ?? paper.pass_marks;
  if (pass > total) throw badRequest('Pass marks cannot exceed total marks');

  Object.assign(paper, dto);
  await paper.save();
  return getPaperById(id);
}

export async function deletePaper(id: string) {
  const paper = await getPaperOrThrow(id, true);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      paper.is_active = false;
      await paper.save({ session });
      await PaperGroup.updateMany({ paper_id: paper._id }, { is_active: false }, { session });
      const pqs = await PaperQuestion.find({ paper_id: paper._id }).session(session);
      await PaperQuestion.updateMany({ paper_id: paper._id }, { is_active: false }, { session });
      await ChildQuestion.updateMany(
        { paper_question_id: { $in: pqs.map((q) => q._id) } },
        { is_active: false },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
  return { deleted: true };
}

export async function publishPaper(id: string) {
  const paper = await getPaperOrThrow(id, true);
  await validatePaperForPublish(paper);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      paper.is_published = true;
      await paper.save({ session });
    });
  } finally {
    await session.endSession();
  }
  return getPaperById(id);
}

export async function unpublishPaper(id: string) {
  const paper = await getPaperOrThrow(id);
  paper.is_published = false;
  await paper.save();
  return getPaperById(id);
}

// --- Paper groups ---

export async function createPaperGroup(paperId: string, dto: CreatePaperGroupDto) {
  await getPaperOrThrow(paperId, true);
  const existing = await PaperGroup.findOne({ paper_id: paperId, group_number: dto.group_number, is_active: true });
  if (existing) throw badRequest('Group number already exists on this paper');
  const g = await PaperGroup.create({ ...dto, paper_id: paperId, is_active: true });
  return {
    id: String(g._id),
    name: g.name,
    group_number: g.group_number,
    marks: g.marks,
    instructions: g.instructions,
  };
}

export async function updatePaperGroup(groupId: string, dto: UpdatePaperGroupDto) {
  const g = await PaperGroup.findById(groupId);
  if (!g || !g.is_active) throw notFound('Paper group not found');
  await getPaperOrThrow(String(g.paper_id), true);
  if (dto.group_number !== undefined) {
    const clash = await PaperGroup.findOne({
      paper_id: g.paper_id,
      group_number: dto.group_number,
      is_active: true,
      _id: { $ne: g._id },
    });
    if (clash) throw badRequest('Group number already exists on this paper');
  }
  Object.assign(g, dto);
  await g.save();
  return {
    id: String(g._id),
    name: g.name,
    group_number: g.group_number,
    marks: g.marks,
    instructions: g.instructions,
  };
}

export async function deletePaperGroup(groupId: string) {
  const g = await PaperGroup.findById(groupId);
  if (!g || !g.is_active) throw notFound('Paper group not found');
  await getPaperOrThrow(String(g.paper_id), true);
  g.is_active = false;
  await g.save();
  await PaperQuestion.updateMany({ paper_group_id: g._id }, { paper_group_id: undefined });
  return { deleted: true };
}

// --- Paper questions ---

export async function createPaperQuestion(paperId: string, dto: CreatePaperQuestionDto) {
  await getPaperOrThrow(paperId, true);
  const fromBank = dto.from_question_bank ?? true;

  if (fromBank) {
    await assertPublishedQuestion(dto.question_id!);
    const already = await PaperQuestion.findOne({
      paper_id: paperId,
      question_id: dto.question_id,
      is_active: true,
    });
    if (already) throw badRequest('Question is already on this paper');
  }

  const dup = await PaperQuestion.findOne({
    paper_id: paperId,
    question_number: dto.question_number,
    is_active: true,
  });
  if (dup) throw badRequest('Question number already used on this paper');

  if (dto.paper_group_id) {
    const group = await PaperGroup.findById(dto.paper_group_id);
    if (!group || !group.is_active || String(group.paper_id) !== paperId) {
      throw notFound('Paper group not found');
    }
  }

  const pq = await PaperQuestion.create({
    paper_id: paperId,
    paper_group_id: dto.paper_group_id ? new mongoose.Types.ObjectId(dto.paper_group_id) : undefined,
    from_question_bank: fromBank,
    question_id: fromBank && dto.question_id ? new mongoose.Types.ObjectId(dto.question_id) : undefined,
    header_text: fromBank ? undefined : dto.header_text?.trim(),
    question_number: dto.question_number,
    display_question_number: dto.display_question_number?.trim() || undefined,
    marks: dto.marks,
    marks_display_bn: dto.marks_display_bn?.trim() || undefined,
    is_compulsory: dto.is_compulsory ?? true,
    is_active: true,
  });

  const q = pq.question_id ? await Question.findById(pq.question_id) : null;
  return {
    id: String(pq._id),
    from_question_bank: pq.from_question_bank,
    question_id: pq.question_id ? String(pq.question_id) : undefined,
    header_text: pq.header_text,
    question_number: pq.question_number,
    display_question_number: pq.display_question_number,
    marks: pq.marks,
    marks_display_bn: pq.marks_display_bn,
    is_compulsory: pq.is_compulsory,
    paper_group_id: idStr(pq.paper_group_id),
    question: q ? await enrichQuestion(q) : undefined,
    parts: [],
  };
}

export async function updatePaperQuestion(pqId: string, dto: UpdatePaperQuestionDto) {
  const pq = await PaperQuestion.findById(pqId);
  if (!pq || !pq.is_active) throw notFound('Paper question not found');
  await getPaperOrThrow(String(pq.paper_id), true);

  const wasComposite = isCompositePaperQuestion(pq);
  const fromBank = dto.from_question_bank !== undefined ? dto.from_question_bank : !wasComposite;

  if (fromBank && dto.question_id) await assertPublishedQuestion(dto.question_id);
  if (dto.question_number !== undefined) {
    const clash = await PaperQuestion.findOne({
      paper_id: pq.paper_id,
      question_number: dto.question_number,
      is_active: true,
      _id: { $ne: pq._id },
    });
    if (clash) throw badRequest('Question number already used on this paper');
  }
  if (dto.paper_group_id) {
    const group = await PaperGroup.findById(dto.paper_group_id);
    if (!group || !group.is_active || String(group.paper_id) !== String(pq.paper_id)) {
      throw notFound('Paper group not found');
    }
  }

  if (dto.from_question_bank !== undefined) {
    const willBeComposite = !dto.from_question_bank;
    pq.from_question_bank = !willBeComposite;
    if (willBeComposite) {
      pq.question_id = undefined;
    } else if (wasComposite) {
      pq.header_text = undefined;
    }
  }

  if (dto.question_id !== undefined && fromBank) {
    pq.question_id = new mongoose.Types.ObjectId(dto.question_id);
  }
  if (dto.paper_group_id !== undefined) {
    pq.paper_group_id = dto.paper_group_id
      ? new mongoose.Types.ObjectId(dto.paper_group_id)
      : undefined;
  }
  if (dto.header_text !== undefined) {
    pq.header_text = dto.header_text.trim() || undefined;
  }
  if (dto.question_number !== undefined) pq.question_number = dto.question_number;
  if (dto.display_question_number !== undefined) {
    pq.display_question_number = dto.display_question_number.trim() || undefined;
  }
  if (dto.marks !== undefined) pq.marks = dto.marks;
  if (dto.marks_display_bn !== undefined) {
    pq.marks_display_bn = dto.marks_display_bn.trim() || undefined;
  }
  if (dto.is_compulsory !== undefined) pq.is_compulsory = dto.is_compulsory;
  if (dto.is_active !== undefined) pq.is_active = dto.is_active;

  const isComposite = isCompositePaperQuestion(pq);
  if (!isComposite && !pq.question_id) {
    throw badRequest('Select a published question from the bank');
  }
  if (isComposite && !pq.header_text?.trim()) {
    throw badRequest('Header text is required for composite questions');
  }

  await pq.save();
  const q = pq.question_id ? await Question.findById(pq.question_id) : null;
  return {
    id: String(pq._id),
    from_question_bank: !isCompositePaperQuestion(pq),
    question_id: pq.question_id ? String(pq.question_id) : undefined,
    header_text: pq.header_text,
    question_number: pq.question_number,
    display_question_number: pq.display_question_number,
    marks: pq.marks,
    marks_display_bn: pq.marks_display_bn,
    is_compulsory: pq.is_compulsory,
    paper_group_id: idStr(pq.paper_group_id),
    question: q ? await enrichQuestion(q) : undefined,
  };
}

export async function deletePaperQuestion(pqId: string) {
  const pq = await PaperQuestion.findById(pqId);
  if (!pq || !pq.is_active) throw notFound('Paper question not found');
  await getPaperOrThrow(String(pq.paper_id), true);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      pq.is_active = false;
      await pq.save({ session });
      await ChildQuestion.updateMany({ paper_question_id: pq._id }, { is_active: false }, { session });
    });
  } finally {
    await session.endSession();
  }
  return { deleted: true };
}

// --- Child questions ---

export async function createChildQuestion(pqId: string, dto: CreateChildQuestionDto) {
  const pq = await PaperQuestion.findById(pqId);
  if (!pq || !pq.is_active) throw notFound('Paper question not found');
  await getPaperOrThrow(String(pq.paper_id), true);
  if (!isCompositePaperQuestion(pq)) {
    throw badRequest('Sub-parts can only be added under composite (non-bank) questions');
  }
  await assertPublishedQuestion(dto.question_id);

  const inactive = await ChildQuestion.findOne({
    paper_question_id: pq._id,
    part_label: dto.part_label,
    is_active: false,
  });
  if (inactive) {
    inactive.is_active = true;
    inactive.question_id = new mongoose.Types.ObjectId(dto.question_id);
    inactive.marks = dto.marks;
    inactive.marks_display_bn = dto.marks_display_bn?.trim() || undefined;
    await inactive.save();
    const q = await Question.findById(inactive.question_id);
    return {
      id: String(inactive._id),
      question_id: String(inactive.question_id),
      part_label: inactive.part_label,
      marks: inactive.marks,
      marks_display_bn: inactive.marks_display_bn,
      question: q ? await enrichQuestion(q) : undefined,
    };
  }

  const dup = await ChildQuestion.findOne({
    paper_question_id: pqId,
    part_label: dto.part_label,
    is_active: true,
  });
  if (dup) throw badRequest('Part label already exists for this question');

  const c = await ChildQuestion.create({
    paper_question_id: pq._id,
    question_id: new mongoose.Types.ObjectId(dto.question_id),
    part_label: dto.part_label,
    marks: dto.marks,
    marks_display_bn: dto.marks_display_bn?.trim() || undefined,
    is_active: true,
  });
  const q = await Question.findById(c.question_id);
  return {
    id: String(c._id),
    question_id: String(c.question_id),
    part_label: c.part_label,
    marks: c.marks,
    marks_display_bn: c.marks_display_bn,
    question: q ? await enrichQuestion(q) : undefined,
  };
}

export async function updateChildQuestion(partId: string, dto: UpdateChildQuestionDto) {
  const c = await ChildQuestion.findById(partId);
  if (!c || !c.is_active) throw notFound('Child question not found');
  const pq = await PaperQuestion.findById(c.paper_question_id);
  if (!pq) throw notFound('Paper question not found');
  await getPaperOrThrow(String(pq.paper_id), true);

  if (dto.question_id) await assertPublishedQuestion(dto.question_id);
  if (dto.part_label !== undefined) {
    if (dto.part_label !== c.part_label) {
      await ChildQuestion.deleteMany({
        paper_question_id: c.paper_question_id,
        part_label: dto.part_label,
        is_active: false,
        _id: { $ne: c._id },
      });
    }
    const clash = await ChildQuestion.findOne({
      paper_question_id: c.paper_question_id,
      part_label: dto.part_label,
      is_active: true,
      _id: { $ne: c._id },
    });
    if (clash) throw badRequest('Part label already exists for this question');
  }

  if (dto.question_id !== undefined) c.question_id = new mongoose.Types.ObjectId(dto.question_id);
  if (dto.part_label !== undefined) c.part_label = dto.part_label;
  if (dto.marks !== undefined) c.marks = dto.marks;
  if (dto.marks_display_bn !== undefined) {
    c.marks_display_bn = dto.marks_display_bn.trim() || undefined;
  }
  if (dto.is_active !== undefined) c.is_active = dto.is_active;
  await c.save();

  const q = await Question.findById(c.question_id);
  return {
    id: String(c._id),
    question_id: String(c.question_id),
    part_label: c.part_label,
    marks: c.marks,
    marks_display_bn: c.marks_display_bn,
    question: q ? await enrichQuestion(q) : undefined,
  };
}

export async function deleteChildQuestion(partId: string) {
  const c = await ChildQuestion.findById(partId);
  if (!c || !c.is_active) throw notFound('Child question not found');
  const pq = await PaperQuestion.findById(c.paper_question_id);
  if (!pq) throw notFound('Paper question not found');
  await getPaperOrThrow(String(pq.paper_id), true);
  c.is_active = false;
  await c.save();
  return { deleted: true };
}
