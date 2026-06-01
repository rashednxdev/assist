import mongoose from 'mongoose';
import type {
  CreateSyllabusGroupDto,
  UpdateSyllabusGroupDto,
  CreateSyllabusTopicDto,
  UpdateSyllabusTopicDto,
  CreateSyllabusSubTopicDto,
  UpdateSyllabusSubTopicDto,
  CreateSyllabusReferenceDto,
  UpdateSyllabusReferenceDto,
} from '@ibas/shared-types';
import { SyllabusGroup } from './models/SyllabusGroup.model.js';
import { SyllabusTopic } from './models/SyllabusTopic.model.js';
import { SyllabusSubTopic } from './models/SyllabusSubTopic.model.js';
import { SyllabusReference } from './models/SyllabusReference.model.js';
import { ExamSubject } from '../exams/models/ExamSubject.model.js';
import { BookInfo } from '../books/models/BookInfo.model.js';
import { BookChapter } from '../books/models/BookChapter.model.js';
import { BookTopic } from '../books/models/BookTopic.model.js';
import { Regulation } from '../books/models/Regulation.model.js';
import { notFound, badRequest } from '../../shared/errors/AppError.js';

function idStr(v: mongoose.Types.ObjectId | string | undefined) {
  return v ? String(v) : undefined;
}

function refLevel(ref: InstanceType<typeof SyllabusReference>) {
  if (ref.regulation_id) return 'regulation';
  if (ref.book_topic_id) return 'rule';
  if (ref.book_chapter_id) return 'chapter';
  if (ref.book_info_id) return 'book';
  return undefined;
}

async function enrichReference(ref: InstanceType<typeof SyllabusReference>) {
  const [book, chapter, topic, regulation] = await Promise.all([
    ref.book_info_id ? BookInfo.findById(ref.book_info_id) : null,
    ref.book_chapter_id ? BookChapter.findById(ref.book_chapter_id) : null,
    ref.book_topic_id ? BookTopic.findById(ref.book_topic_id) : null,
    ref.regulation_id ? Regulation.findById(ref.regulation_id) : null,
  ]);
  const resolvedBookId = ref.book_info_id ?? chapter?.book_info_id;
  const resolvedBook =
    book ?? (resolvedBookId && !book ? await BookInfo.findById(resolvedBookId) : null);
  return {
    id: String(ref._id),
    syllabus_topic_id: String(ref.syllabus_topic_id),
    exam_subject_id: String(ref.exam_subject_id),
    ref_level: refLevel(ref),
    book_info_id: idStr(resolvedBookId),
    book_chapter_id: idStr(ref.book_chapter_id),
    book_topic_id: idStr(ref.book_topic_id),
    regulation_id: idStr(ref.regulation_id),
    relevance_note: ref.relevance_note,
    book_name: resolvedBook?.name,
    book_short_name: resolvedBook?.short_name,
    chapter_name: chapter?.name,
    chapter_number: chapter?.chapter_number,
    topic_name: topic?.name,
    rule_number: topic?.rule_number,
    regulation_no: regulation?.regulation_no,
    regulation_title: regulation?.title,
  };
}

export async function getSyllabusTree(examSubjectId: string) {
  const subject = await ExamSubject.findById(examSubjectId);
  if (!subject || !subject.is_active) throw notFound('Exam subject not found');

  const groups = await SyllabusGroup.find({ exam_subject_id: examSubjectId, is_active: true }).sort({
    sort_order: 1,
  });
  const groupIds = groups.map((g) => g._id);
  const topics = await SyllabusTopic.find({ syllabus_group_id: { $in: groupIds }, is_active: true }).sort({
    sort_order: 1,
  });
  const topicIds = topics.map((t) => t._id);
  const [subTopics, references] = await Promise.all([
    SyllabusSubTopic.find({ syllabus_topic_id: { $in: topicIds }, is_active: true }).sort({ sort_order: 1 }),
    SyllabusReference.find({ exam_subject_id: examSubjectId, syllabus_topic_id: { $in: topicIds } }),
  ]);

  const refsByTopic = new Map<string, InstanceType<typeof SyllabusReference>[]>();
  for (const ref of references) {
    const key = String(ref.syllabus_topic_id);
    if (!refsByTopic.has(key)) refsByTopic.set(key, []);
    refsByTopic.get(key)!.push(ref);
  }

  const enrichedRefs = await Promise.all(references.map((r) => enrichReference(r)));
  const refMap = new Map(enrichedRefs.map((r) => [r.id, r]));

  const tree = groups.map((g) => ({
    id: String(g._id),
    name: g.name,
    marks_allocated: g.marks_allocated,
    sort_order: g.sort_order,
    topics: topics
      .filter((t) => String(t.syllabus_group_id) === String(g._id))
      .map((t) => ({
        id: String(t._id),
        name: t.name,
        description: t.description,
        marks_weightage: t.marks_weightage,
        sort_order: t.sort_order,
        sub_topics: subTopics
          .filter((st) => String(st.syllabus_topic_id) === String(t._id))
          .map((st) => ({
            id: String(st._id),
            name: st.name,
            description: st.description,
            sort_order: st.sort_order,
          })),
        references: (refsByTopic.get(String(t._id)) ?? []).map((r) => refMap.get(String(r._id))!),
      })),
  }));

  return { exam_subject_id: examSubjectId, groups: tree };
}

async function nextSortOrder(model: { findOne: Function }, filter: Record<string, unknown>, field: string) {
  const last = await model.findOne(filter).sort({ [field]: -1 });
  return last ? (last[field as keyof typeof last] as number) + 1 : 1;
}

export async function createSyllabusGroup(dto: CreateSyllabusGroupDto) {
  const subject = await ExamSubject.findById(dto.exam_subject_id);
  if (!subject || !subject.is_active) throw notFound('Exam subject not found');
  const sort_order =
    dto.sort_order ??
    (await nextSortOrder(SyllabusGroup, { exam_subject_id: dto.exam_subject_id }, 'sort_order'));
  const g = await SyllabusGroup.create({ ...dto, sort_order, is_active: true });
  return {
    id: String(g._id),
    exam_subject_id: String(g.exam_subject_id),
    name: g.name,
    marks_allocated: g.marks_allocated,
    sort_order: g.sort_order,
  };
}

export async function updateSyllabusGroup(id: string, dto: UpdateSyllabusGroupDto) {
  const g = await SyllabusGroup.findById(id);
  if (!g || !g.is_active) throw notFound('Syllabus group not found');
  if (dto.name !== undefined) g.name = dto.name;
  if (dto.marks_allocated !== undefined) g.marks_allocated = dto.marks_allocated;
  if (dto.sort_order !== undefined) g.sort_order = dto.sort_order;
  if (dto.is_active !== undefined) g.is_active = dto.is_active;
  await g.save();
  return {
    id: String(g._id),
    exam_subject_id: String(g.exam_subject_id),
    name: g.name,
    marks_allocated: g.marks_allocated,
    sort_order: g.sort_order,
  };
}

export async function deleteSyllabusGroup(id: string) {
  const g = await SyllabusGroup.findById(id);
  if (!g) throw notFound('Syllabus group not found');
  const topics = await SyllabusTopic.find({ syllabus_group_id: id });
  const topicIds = topics.map((t) => t._id);
  await SyllabusSubTopic.updateMany({ syllabus_topic_id: { $in: topicIds } }, { is_active: false });
  await SyllabusReference.deleteMany({ syllabus_topic_id: { $in: topicIds } });
  await SyllabusTopic.updateMany({ syllabus_group_id: id }, { is_active: false });
  g.is_active = false;
  await g.save();
  return { deleted: true };
}

export async function createSyllabusTopic(dto: CreateSyllabusTopicDto) {
  const group = await SyllabusGroup.findById(dto.syllabus_group_id);
  if (!group || !group.is_active) throw notFound('Syllabus group not found');
  const sort_order =
    dto.sort_order ??
    (await nextSortOrder(SyllabusTopic, { syllabus_group_id: dto.syllabus_group_id }, 'sort_order'));
  const t = await SyllabusTopic.create({ ...dto, sort_order, is_active: true });
  return {
    id: String(t._id),
    syllabus_group_id: String(t.syllabus_group_id),
    name: t.name,
    description: t.description,
    marks_weightage: t.marks_weightage,
    sort_order: t.sort_order,
  };
}

export async function updateSyllabusTopic(id: string, dto: UpdateSyllabusTopicDto) {
  const t = await SyllabusTopic.findById(id);
  if (!t || !t.is_active) throw notFound('Syllabus topic not found');
  if (dto.name !== undefined) t.name = dto.name;
  if (dto.description !== undefined) t.description = dto.description;
  if (dto.marks_weightage !== undefined) t.marks_weightage = dto.marks_weightage;
  if (dto.sort_order !== undefined) t.sort_order = dto.sort_order;
  if (dto.is_active !== undefined) t.is_active = dto.is_active;
  await t.save();
  return {
    id: String(t._id),
    syllabus_group_id: String(t.syllabus_group_id),
    name: t.name,
    description: t.description,
    marks_weightage: t.marks_weightage,
    sort_order: t.sort_order,
  };
}

export async function deleteSyllabusTopic(id: string) {
  const t = await SyllabusTopic.findById(id);
  if (!t) throw notFound('Syllabus topic not found');
  await SyllabusSubTopic.updateMany({ syllabus_topic_id: id }, { is_active: false });
  await SyllabusReference.deleteMany({ syllabus_topic_id: id });
  t.is_active = false;
  await t.save();
  return { deleted: true };
}

export async function createSyllabusSubTopic(dto: CreateSyllabusSubTopicDto) {
  const topic = await SyllabusTopic.findById(dto.syllabus_topic_id);
  if (!topic || !topic.is_active) throw notFound('Syllabus topic not found');
  const sort_order =
    dto.sort_order ??
    (await nextSortOrder(SyllabusSubTopic, { syllabus_topic_id: dto.syllabus_topic_id }, 'sort_order'));
  const st = await SyllabusSubTopic.create({ ...dto, sort_order, is_active: true });
  return {
    id: String(st._id),
    syllabus_topic_id: String(st.syllabus_topic_id),
    name: st.name,
    description: st.description,
    sort_order: st.sort_order,
  };
}

export async function updateSyllabusSubTopic(id: string, dto: UpdateSyllabusSubTopicDto) {
  const st = await SyllabusSubTopic.findById(id);
  if (!st || !st.is_active) throw notFound('Syllabus sub-topic not found');
  if (dto.name !== undefined) st.name = dto.name;
  if (dto.description !== undefined) st.description = dto.description;
  if (dto.sort_order !== undefined) st.sort_order = dto.sort_order;
  if (dto.is_active !== undefined) st.is_active = dto.is_active;
  await st.save();
  return {
    id: String(st._id),
    syllabus_topic_id: String(st.syllabus_topic_id),
    name: st.name,
    description: st.description,
    sort_order: st.sort_order,
  };
}

export async function deleteSyllabusSubTopic(id: string) {
  const st = await SyllabusSubTopic.findById(id);
  if (!st) throw notFound('Syllabus sub-topic not found');
  st.is_active = false;
  await st.save();
  return { deleted: true };
}

function applyRefLevelToDoc(
  ref: InstanceType<typeof SyllabusReference>,
  level: string | undefined,
) {
  if (level === 'book') {
    ref.book_chapter_id = undefined;
    ref.book_topic_id = undefined;
    ref.regulation_id = undefined;
  } else if (level === 'chapter') {
    ref.book_topic_id = undefined;
    ref.regulation_id = undefined;
  } else if (level === 'rule') {
    ref.regulation_id = undefined;
  }
}

export async function getSyllabusReferenceById(id: string) {
  const ref = await SyllabusReference.findById(id);
  if (!ref) throw notFound('Syllabus reference not found');
  return enrichReference(ref);
}

export async function createSyllabusReference(dto: CreateSyllabusReferenceDto) {
  const topic = await SyllabusTopic.findById(dto.syllabus_topic_id);
  if (!topic || !topic.is_active) throw notFound('Syllabus topic not found');
  const subject = await ExamSubject.findById(dto.exam_subject_id);
  if (!subject || !subject.is_active) throw notFound('Exam subject not found');

  if (!dto.book_info_id && !dto.book_chapter_id && !dto.book_topic_id && !dto.regulation_id) {
    throw badRequest('At least one book link is required');
  }

  const ref = await SyllabusReference.create({
    syllabus_topic_id: topic._id,
    exam_subject_id: subject._id,
    book_info_id: dto.book_info_id ? new mongoose.Types.ObjectId(dto.book_info_id) : undefined,
    book_chapter_id: dto.book_chapter_id ? new mongoose.Types.ObjectId(dto.book_chapter_id) : undefined,
    book_topic_id: dto.book_topic_id ? new mongoose.Types.ObjectId(dto.book_topic_id) : undefined,
    regulation_id: dto.regulation_id ? new mongoose.Types.ObjectId(dto.regulation_id) : undefined,
    relevance_note: dto.relevance_note,
  });
  if (dto.ref_level) applyRefLevelToDoc(ref, dto.ref_level);
  await ref.save();
  return enrichReference(ref);
}

export async function updateSyllabusReference(id: string, dto: UpdateSyllabusReferenceDto) {
  const ref = await SyllabusReference.findById(id);
  if (!ref) throw notFound('Syllabus reference not found');

  if (dto.ref_level) applyRefLevelToDoc(ref, dto.ref_level);

  if (dto.book_info_id !== undefined) {
    ref.book_info_id = dto.book_info_id ? new mongoose.Types.ObjectId(dto.book_info_id) : undefined;
  }
  if (dto.book_chapter_id !== undefined) {
    ref.book_chapter_id = dto.book_chapter_id ? new mongoose.Types.ObjectId(dto.book_chapter_id) : undefined;
  }
  if (dto.book_topic_id !== undefined) {
    ref.book_topic_id = dto.book_topic_id ? new mongoose.Types.ObjectId(dto.book_topic_id) : undefined;
  }
  if (dto.regulation_id !== undefined) {
    ref.regulation_id = dto.regulation_id ? new mongoose.Types.ObjectId(dto.regulation_id) : undefined;
  }
  if (dto.relevance_note !== undefined) ref.relevance_note = dto.relevance_note;

  if (
    !ref.book_info_id &&
    !ref.book_chapter_id &&
    !ref.book_topic_id &&
    !ref.regulation_id
  ) {
    throw badRequest('At least one book link is required');
  }

  await ref.save();
  return enrichReference(ref);
}

export async function deleteSyllabusReference(id: string) {
  const ref = await SyllabusReference.findById(id);
  if (!ref) throw notFound('Syllabus reference not found');
  await ref.deleteOne();
  return { deleted: true };
}
