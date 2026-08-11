import mongoose from 'mongoose';
import type {
  CreateExamRoutineDto,
  UpdateExamRoutineDto,
  CreateExamRoutineEntryDto,
  UpdateExamRoutineEntryDto,
} from '@ibas/shared-types';
import { ExamRoutine } from './models/ExamRoutine.model.js';
import { ExamRoutineEntry } from './models/ExamRoutineEntry.model.js';
import { ExamName } from '../exams/models/ExamName.model.js';
import { ExamSubject } from '../exams/models/ExamSubject.model.js';
import { notFound, badRequest } from '../../shared/errors/AppError.js';

async function nextSortOrder(examRoutineId: string) {
  const last = await ExamRoutineEntry.findOne({ exam_routine_id: examRoutineId, is_active: true }).sort({
    sort_order: -1,
  });
  return last ? last.sort_order + 1 : 1;
}

async function serializeEntries(entries: InstanceType<typeof ExamRoutineEntry>[]) {
  const subjectIds = [...new Set(entries.map((e) => String(e.exam_subject_id)))];
  const subjects = subjectIds.length > 0 ? await ExamSubject.find({ _id: { $in: subjectIds } }) : [];
  const nameById = new Map(subjects.map((s) => [String(s._id), s.name]));
  return entries
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((e) => ({
      id: String(e._id),
      exam_subject_id: String(e.exam_subject_id),
      subject_name: nameById.get(String(e.exam_subject_id)) ?? 'Unknown subject',
      date: e.date,
      time: e.time,
      instruction: e.instruction,
      sort_order: e.sort_order,
    }));
}

export async function listAdminRoutines(limit: number, offset: number) {
  const [routines, total] = await Promise.all([
    ExamRoutine.find({ is_active: true }).sort({ start_date: -1 }).skip(offset).limit(limit),
    ExamRoutine.countDocuments({ is_active: true }),
  ]);
  const examIds = routines.map((r) => r.exam_name_id);
  const exams = examIds.length > 0 ? await ExamName.find({ _id: { $in: examIds } }) : [];
  const examNameById = new Map(exams.map((e) => [String(e._id), e.name]));
  const routineIds = routines.map((r) => r._id);
  const counts =
    routineIds.length > 0
      ? await ExamRoutineEntry.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
          { $match: { exam_routine_id: { $in: routineIds }, is_active: true } },
          { $group: { _id: '$exam_routine_id', count: { $sum: 1 } } },
        ])
      : [];
  const countById = new Map(counts.map((c) => [String(c._id), c.count]));

  const items = routines.map((r) => ({
    id: String(r._id),
    exam_name_id: String(r.exam_name_id),
    exam_name: examNameById.get(String(r.exam_name_id)) ?? 'Unknown exam',
    start_date: r.start_date,
    start_date_note: r.start_date_note || undefined,
    entry_count: countById.get(String(r._id)) ?? 0,
  }));
  return { items, total };
}

export async function createExamRoutine(dto: CreateExamRoutineDto, createdBy: string) {
  const exam = await ExamName.findById(dto.exam_name_id);
  if (!exam || !exam.is_active) throw notFound('Exam not found');

  try {
    const routine = await ExamRoutine.create({
      exam_name_id: dto.exam_name_id,
      start_date: dto.start_date,
      start_date_note: dto.start_date_note?.trim() || undefined,
      created_by: createdBy,
      is_active: true,
    });
    return { id: String(routine._id) };
  } catch (err) {
    if (err instanceof mongoose.mongo.MongoServerError && err.code === 11000) {
      throw badRequest('A routine already exists for this exam');
    }
    throw err;
  }
}

export async function getRoutineDetailById(id: string) {
  const routine = await ExamRoutine.findById(id);
  if (!routine || !routine.is_active) throw notFound('Exam routine not found');
  const exam = await ExamName.findById(routine.exam_name_id);
  const entries = await ExamRoutineEntry.find({ exam_routine_id: routine._id, is_active: true });
  return {
    id: String(routine._id),
    exam_name_id: String(routine.exam_name_id),
    exam_name: exam?.name ?? 'Unknown exam',
    start_date: routine.start_date,
    start_date_note: routine.start_date_note || undefined,
    entries: await serializeEntries(entries),
  };
}

export async function getRoutineByExamName(examNameId: string) {
  const exam = await ExamName.findById(examNameId);
  if (!exam || !exam.is_active) throw notFound('Exam not found');
  const routine = await ExamRoutine.findOne({ exam_name_id: examNameId, is_active: true });
  if (!routine) throw notFound('No routine published for this exam yet');
  const entries = await ExamRoutineEntry.find({ exam_routine_id: routine._id, is_active: true });
  return {
    id: String(routine._id),
    exam_name_id: String(routine.exam_name_id),
    exam_name: exam.name,
    start_date: routine.start_date,
    start_date_note: routine.start_date_note || undefined,
    entries: await serializeEntries(entries),
  };
}

export async function listRoutinesForMobile() {
  const routines = await ExamRoutine.find({ is_active: true }).sort({ start_date: 1 });
  const examIds = routines.map((r) => r.exam_name_id);
  const exams = examIds.length > 0 ? await ExamName.find({ _id: { $in: examIds } }) : [];
  const examNameById = new Map(exams.map((e) => [String(e._id), e.name]));
  return routines.map((r) => ({
    exam_name_id: String(r.exam_name_id),
    exam_name: examNameById.get(String(r.exam_name_id)) ?? 'Unknown exam',
    start_date: r.start_date,
    start_date_note: r.start_date_note || undefined,
  }));
}

export async function updateExamRoutine(id: string, dto: UpdateExamRoutineDto) {
  const routine = await ExamRoutine.findById(id);
  if (!routine) throw notFound('Exam routine not found');
  if (dto.start_date !== undefined) routine.start_date = dto.start_date;
  if (dto.start_date_note !== undefined) {
    routine.start_date_note = dto.start_date_note?.trim() || undefined;
  }
  if (dto.is_active !== undefined) routine.is_active = dto.is_active;
  await routine.save();
  return { id: String(routine._id) };
}

export async function addExamRoutineEntry(examRoutineId: string, dto: CreateExamRoutineEntryDto) {
  const routine = await ExamRoutine.findById(examRoutineId);
  if (!routine || !routine.is_active) throw notFound('Exam routine not found');
  const subject = await ExamSubject.findById(dto.exam_subject_id);
  if (!subject || !subject.is_active) throw notFound('Exam subject not found');

  const sort_order = await nextSortOrder(examRoutineId);
  try {
    const entry = await ExamRoutineEntry.create({
      exam_routine_id: examRoutineId,
      exam_subject_id: dto.exam_subject_id,
      date: dto.date,
      time: dto.time,
      instruction: dto.instruction,
      sort_order,
      is_active: true,
    });
    return { id: String(entry._id) };
  } catch (err) {
    if (err instanceof mongoose.mongo.MongoServerError && err.code === 11000) {
      throw badRequest('This subject is already on the routine');
    }
    throw err;
  }
}

export async function updateExamRoutineEntry(id: string, dto: UpdateExamRoutineEntryDto) {
  const entry = await ExamRoutineEntry.findById(id);
  if (!entry) throw notFound('Routine entry not found');
  if (dto.date !== undefined) entry.date = dto.date;
  if (dto.time !== undefined) entry.time = dto.time;
  if (dto.instruction !== undefined) entry.instruction = dto.instruction;
  if (dto.sort_order !== undefined) entry.sort_order = dto.sort_order;
  if (dto.is_active !== undefined) entry.is_active = dto.is_active;
  await entry.save();
  return { id: String(entry._id) };
}

export async function deleteExamRoutineEntry(id: string) {
  const entry = await ExamRoutineEntry.findById(id);
  if (!entry) throw notFound('Routine entry not found');
  entry.is_active = false;
  await entry.save();
  return { deleted: true };
}
