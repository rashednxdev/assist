import mongoose from 'mongoose';
import type { SubmitUserQuestionDto } from '@ibas/shared-types';
import { SubmittedQuestion } from './models/SubmittedQuestion.model.js';
import { ExamSubject } from '../exams/models/ExamSubject.model.js';
import { User } from '../users/models/User.model.js';
import { Question } from '../questions/models/Question.model.js';
import { notFound, badRequest } from '../../shared/errors/AppError.js';

const MAX_SUBMISSIONS_PER_SUBJECT = 10;

export async function submitUserQuestion(userId: string, dto: SubmitUserQuestionDto) {
  const subject = await ExamSubject.findById(dto.exam_subject_id);
  if (!subject || !subject.is_active) throw notFound('Exam subject not found');

  const count = await SubmittedQuestion.countDocuments({
    user_id: userId,
    exam_subject_id: dto.exam_subject_id,
  });
  if (count >= MAX_SUBMISSIONS_PER_SUBJECT) {
    throw badRequest(
      `You've reached the limit of ${MAX_SUBMISSIONS_PER_SUBJECT} submitted questions for this subject`,
    );
  }

  const doc = await SubmittedQuestion.create({
    user_id: userId,
    exam_subject_id: dto.exam_subject_id,
    body: dto.body.trim(),
    status: 'pending',
  });

  return {
    id: String(doc._id),
    exam_subject_id: String(doc.exam_subject_id),
    subject_name: subject.name,
    body: doc.body,
    status: doc.status,
    created_at: doc.created_at.toISOString(),
  };
}

export async function listMySubmittedQuestions(userId: string) {
  const rows = await SubmittedQuestion.find({ user_id: userId }).sort({ created_at: -1 });
  const subjectIds = [...new Set(rows.map((r) => String(r.exam_subject_id)))];
  const subjects = subjectIds.length > 0 ? await ExamSubject.find({ _id: { $in: subjectIds } }) : [];
  const nameById = new Map(subjects.map((s) => [String(s._id), s.name]));

  return rows.map((r) => ({
    id: String(r._id),
    exam_subject_id: String(r.exam_subject_id),
    subject_name: nameById.get(String(r.exam_subject_id)) ?? 'Unknown subject',
    body: r.body,
    status: r.status,
    linked_question_id: r.linked_question_id ? String(r.linked_question_id) : undefined,
    admin_note: r.admin_note,
    created_at: r.created_at.toISOString(),
  }));
}

export async function listAdminSubmittedQuestions(status?: string) {
  const query: Record<string, unknown> = {};
  if (status) query.status = status;

  const rows = await SubmittedQuestion.find(query).sort({ created_at: -1 });
  const subjectIds = [...new Set(rows.map((r) => String(r.exam_subject_id)))];
  const userIds = [...new Set(rows.map((r) => String(r.user_id)))];
  const [subjects, users] = await Promise.all([
    subjectIds.length > 0 ? ExamSubject.find({ _id: { $in: subjectIds } }) : [],
    userIds.length > 0 ? User.find({ _id: { $in: userIds } }).select('full_name_en') : [],
  ]);
  const subjectNameById = new Map(subjects.map((s) => [String(s._id), s.name]));
  const userNameById = new Map(users.map((u) => [String(u._id), u.full_name_en]));

  return rows.map((r) => ({
    id: String(r._id),
    user_id: String(r.user_id),
    user_name: userNameById.get(String(r.user_id)) ?? 'Unknown user',
    exam_subject_id: String(r.exam_subject_id),
    subject_name: subjectNameById.get(String(r.exam_subject_id)) ?? 'Unknown subject',
    body: r.body,
    status: r.status,
    linked_question_id: r.linked_question_id ? String(r.linked_question_id) : undefined,
    admin_note: r.admin_note,
    created_at: r.created_at.toISOString(),
  }));
}

export async function acceptSubmittedQuestion(id: string, linkedQuestionId: string, reviewerId: string) {
  const doc = await SubmittedQuestion.findById(id);
  if (!doc) throw notFound('Submitted question not found');

  const question = await Question.findById(linkedQuestionId);
  if (!question) throw notFound('Question to link not found');

  doc.status = 'accepted';
  doc.linked_question_id = question._id;
  doc.reviewed_by = new mongoose.Types.ObjectId(reviewerId);
  doc.reviewed_at = new Date();
  await doc.save();

  return { id: String(doc._id), status: doc.status };
}

export async function rejectSubmittedQuestion(id: string, adminNote: string | undefined, reviewerId: string) {
  const doc = await SubmittedQuestion.findById(id);
  if (!doc) throw notFound('Submitted question not found');

  doc.status = 'rejected';
  doc.admin_note = adminNote;
  doc.reviewed_by = new mongoose.Types.ObjectId(reviewerId);
  doc.reviewed_at = new Date();
  await doc.save();

  return { id: String(doc._id), status: doc.status };
}
