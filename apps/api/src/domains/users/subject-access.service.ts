import mongoose from 'mongoose';
import { User } from './models/User.model.js';
import { ExamSubject } from '../exams/models/ExamSubject.model.js';
import { forbidden } from '../../shared/errors/AppError.js';

export type ExamSubjectScope =
  | { mode: 'all' }
  | { mode: 'none' }
  | { mode: 'subset'; ids: string[] };

function isAdminUser(user?: {
  is_super_admin?: boolean;
  user_type?: string;
} | null): boolean {
  return !!user && (user.is_super_admin || user.user_type === 'system_admin' || user.user_type === 'admin');
}

/** Resolve which exam subjects a user may see in learner content. Admins always get all. */
export function scopeFromUserFields(user: {
  is_super_admin?: boolean;
  user_type?: string;
  all_exam_subjects?: boolean;
  exam_subject_ids?: Array<mongoose.Types.ObjectId | string>;
}): ExamSubjectScope {
  if (isAdminUser(user)) return { mode: 'all' };
  if (user.all_exam_subjects !== false) return { mode: 'all' };
  const ids = [...new Set((user.exam_subject_ids ?? []).map(String).filter(Boolean))];
  if (ids.length === 0) return { mode: 'none' };
  return { mode: 'subset', ids };
}

export async function getExamSubjectScopeForUserId(userId: string): Promise<ExamSubjectScope> {
  const user = await User.findById(userId).select(
    'user_type is_super_admin all_exam_subjects exam_subject_ids',
  );
  if (!user) return { mode: 'none' };
  return scopeFromUserFields(user);
}

export async function getExamSubjectScopeForAuthUser(user?: {
  id: string;
  is_super_admin?: boolean;
  user_type?: string;
} | null): Promise<ExamSubjectScope> {
  if (!user) return { mode: 'all' };
  if (isAdminUser(user)) return { mode: 'all' };
  return getExamSubjectScopeForUserId(user.id);
}

export function subjectObjectIds(scope: ExamSubjectScope): mongoose.Types.ObjectId[] | null {
  if (scope.mode === 'all') return null;
  if (scope.mode === 'none') return [];
  return scope.ids.map((id) => new mongoose.Types.ObjectId(id));
}

/** True when the given subject id is allowed for this scope. */
export function isExamSubjectAllowed(scope: ExamSubjectScope, examSubjectId: string | undefined | null): boolean {
  if (scope.mode === 'all') return true;
  if (!examSubjectId) return false;
  if (scope.mode === 'none') return false;
  return scope.ids.includes(String(examSubjectId));
}

export function assertExamSubjectAllowed(scope: ExamSubjectScope, examSubjectId: string | undefined | null): void {
  if (!isExamSubjectAllowed(scope, examSubjectId)) {
    throw forbidden('This content is not available for your allowed subjects.');
  }
}

/** Serialize subject allow-list for admin user APIs and /auth/me. */
export async function serializeExamSubjectAccess(user: {
  all_exam_subjects?: boolean;
  exam_subject_ids?: Array<mongoose.Types.ObjectId | string>;
}) {
  const all = user.all_exam_subjects !== false;
  const ids = [...new Set((user.exam_subject_ids ?? []).map(String).filter(Boolean))];
  let subjects: Array<{ id: string; name: string; name_bn?: string }> = [];
  if (!all && ids.length > 0) {
    const docs = await ExamSubject.find({ _id: { $in: ids } }).select('name name_bn');
    const map = new Map(docs.map((s) => [String(s._id), s]));
    subjects = ids.flatMap((id) => {
      const s = map.get(id);
      if (!s) return [];
      return [{ id, name: s.name, name_bn: s.name_bn }];
    });
  }
  return {
    all_exam_subjects: all,
    exam_subject_ids: all ? [] : ids,
    exam_subjects: subjects,
  };
}
