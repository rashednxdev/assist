import mongoose from 'mongoose';
import type {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  CreateAuthorityDto,
  UpdateAuthorityDto,
  CreateExamNameDto,
  UpdateExamNameDto,
  CreateExamSessionDto,
  UpdateExamSessionDto,
  CreateExamPartDto,
  UpdateExamPartDto,
  CreateExamTypeDto,
  UpdateExamTypeDto,
  CreateExamSubjectDto,
  UpdateExamSubjectDto,
} from '@ibas/shared-types';
import { Department } from './models/Department.model.js';
import { Authority } from './models/Authority.model.js';
import { ExamName } from './models/ExamName.model.js';
import { ExamPart } from './models/ExamPart.model.js';
import { ExamType } from './models/ExamType.model.js';
import { ExamSubject } from './models/ExamSubject.model.js';
import { ExamSession } from './models/ExamSession.model.js';
import { PaperDetail } from '../papers/models/PaperDetail.model.js';
import { notFound, badRequest } from '../../shared/errors/AppError.js';
import {
  assertExamSubjectAllowed,
  filterByExamSubjectScope,
  type ExamSubjectScope,
} from '../users/subject-access.service.js';

function idStr(v: mongoose.Types.ObjectId | string | undefined) {
  return v ? String(v) : undefined;
}

function serializeDepartment(d: InstanceType<typeof Department>) {
  return {
    id: String(d._id),
    name: d.name,
    short_name: d.short_name,
    identity: d.identity,
    location: d.location,
    address: d.address,
    website: d.website,
    is_active: d.is_active,
  };
}

function serializeAuthority(a: InstanceType<typeof Authority>, deptName?: string) {
  return {
    id: String(a._id),
    department_id: String(a.department_id),
    department_name: deptName,
    name: a.name,
    authority_type: a.authority_type,
    description: a.description,
    contact_email: a.contact_email,
    contact_phone: a.contact_phone,
    is_active: a.is_active,
  };
}

function serializeExamName(e: InstanceType<typeof ExamName>, authorityName?: string) {
  return {
    id: String(e._id),
    authority_id: String(e.authority_id),
    authority_name: authorityName,
    name: e.name,
    name_bn: e.name_bn,
    short_name: e.short_name,
    short_name_bn: e.short_name_bn,
    goal: e.goal,
    description: e.description,
    eligibility_criteria: e.eligibility_criteria,
    passing_criteria: e.passing_criteria,
    total_attempts_allowed: e.total_attempts_allowed,
    registration_fee: e.registration_fee,
    is_active: e.is_active,
    created_at: e.created_at,
  };
}

function serializeExamPart(p: InstanceType<typeof ExamPart>) {
  return {
    id: String(p._id),
    exam_name_id: String(p.exam_name_id),
    name: p.name,
    name_bn: p.name_bn,
    part_number: p.part_number,
    description: p.description,
    total_marks: p.total_marks,
    total_marks_bn: p.total_marks_bn,
    pass_marks: p.pass_marks,
    pass_marks_bn: p.pass_marks_bn,
    qualifier_outline: p.qualifier_outline,
    note: p.note,
    is_active: p.is_active,
  };
}

function serializeExamType(t: InstanceType<typeof ExamType>) {
  return {
    id: String(t._id),
    exam_name_id: String(t.exam_name_id),
    name: t.name,
    code: t.code,
    description: t.description,
    total_marks: t.total_marks,
    pass_marks: t.pass_marks,
    total_time: t.total_time,
    note: t.note,
    is_active: t.is_active,
  };
}

function serializeExamSession(s: InstanceType<typeof ExamSession>) {
  return {
    id: String(s._id),
    exam_name_id: String(s.exam_name_id),
    label_en: s.label_en,
    label_bn: s.label_bn,
    sort_order: s.sort_order,
    is_active: s.is_active,
    created_at: s.created_at,
  };
}

function serializeExamSubject(s: InstanceType<typeof ExamSubject>, typeName?: string) {
  return {
    id: String(s._id),
    exam_part_id: String(s.exam_part_id),
    exam_type_id: String(s.exam_type_id),
    exam_type_name: typeName,
    name: s.name,
    name_bn: s.name_bn,
    total_marks: s.total_marks,
    total_marks_bn: s.total_marks_bn,
    pass_marks: s.pass_marks,
    pass_marks_bn: s.pass_marks_bn,
    is_active: s.is_active,
  };
}

// --- Departments ---

export async function listDepartments() {
  const items = await Department.find({ is_active: true }).sort({ name: 1 });
  return items.map(serializeDepartment);
}

export async function createDepartment(dto: CreateDepartmentDto) {
  const existing = await Department.findOne({ short_name: dto.short_name });
  if (existing) throw badRequest('Department short name already exists');
  const d = await Department.create({ ...dto, is_active: true });
  return serializeDepartment(d);
}

export async function updateDepartment(id: string, dto: UpdateDepartmentDto) {
  const d = await Department.findById(id);
  if (!d) throw notFound('Department not found');
  if (dto.short_name && dto.short_name !== d.short_name) {
    const clash = await Department.findOne({ short_name: dto.short_name });
    if (clash) throw badRequest('Department short name already exists');
  }
  Object.assign(d, dto);
  await d.save();
  return serializeDepartment(d);
}

export async function deleteDepartment(id: string) {
  const d = await Department.findById(id);
  if (!d) throw notFound('Department not found');
  const childCount = await Authority.countDocuments({ department_id: d._id, is_active: true });
  if (childCount > 0) throw badRequest('Remove or deactivate authorities under this department first');
  d.is_active = false;
  await d.save();
  return { deleted: true };
}

// --- Authorities ---

export async function listAuthorities(departmentId?: string) {
  const query: Record<string, unknown> = { is_active: true };
  if (departmentId) query.department_id = departmentId;
  const items = await Authority.find(query).sort({ name: 1 });
  const deptIds = [...new Set(items.map((a) => String(a.department_id)))];
  const depts = await Department.find({ _id: { $in: deptIds } });
  const deptMap = new Map(depts.map((d) => [String(d._id), d.name]));
  return items.map((a) => serializeAuthority(a, deptMap.get(String(a.department_id))));
}

export async function createAuthority(dto: CreateAuthorityDto) {
  const dept = await Department.findById(dto.department_id);
  if (!dept || !dept.is_active) throw notFound('Department not found');
  const a = await Authority.create({ ...dto, is_active: true });
  return serializeAuthority(a, dept.name);
}

export async function updateAuthority(id: string, dto: UpdateAuthorityDto) {
  const a = await Authority.findById(id);
  if (!a) throw notFound('Authority not found');
  if (dto.department_id) {
    const dept = await Department.findById(dto.department_id);
    if (!dept) throw notFound('Department not found');
  }
  Object.assign(a, dto);
  await a.save();
  const dept = await Department.findById(a.department_id);
  return serializeAuthority(a, dept?.name);
}

export async function deleteAuthority(id: string) {
  const a = await Authority.findById(id);
  if (!a) throw notFound('Authority not found');
  const examCount = await ExamName.countDocuments({ authority_id: a._id, is_active: true });
  if (examCount > 0) throw badRequest('Remove or deactivate exam programs under this authority first');
  a.is_active = false;
  await a.save();
  return { deleted: true };
}

// --- Exam names ---

async function examNameIdsForSubjectScope(scope: ExamSubjectScope): Promise<Set<string> | null> {
  if (scope.mode === 'all') return null;
  if (scope.mode === 'none') return new Set();
  const subjects = await ExamSubject.find({ _id: { $in: scope.ids }, is_active: true }).select('exam_part_id');
  const partIds = [...new Set(subjects.map((s) => String(s.exam_part_id)))];
  if (partIds.length === 0) return new Set();
  const parts = await ExamPart.find({ _id: { $in: partIds } }).select('exam_name_id');
  return new Set(parts.map((p) => String(p.exam_name_id)));
}

export async function listExamNames(
  authorityId?: string,
  options?: { bypassCache?: boolean; subjectScope?: ExamSubjectScope },
) {
  const scope = options?.subjectScope ?? { mode: 'all' };
  if (scope.mode === 'none') return [];

  const allowedExamIds = await examNameIdsForSubjectScope(scope);
  const useCache = !options?.bypassCache && allowedExamIds === null;

  if (useCache) {
    const { cachedExamNames } = await import('../content-cache/content-cache.service.js');
    const cached = cachedExamNames<{
      id: string;
      authority_id: string;
      name: string;
      short_name?: string;
      [key: string]: unknown;
    }>();
    if (cached) {
      return authorityId ? cached.filter((e) => String(e.authority_id) === authorityId) : cached;
    }
  }

  const query: Record<string, unknown> = { is_active: true };
  if (authorityId) query.authority_id = authorityId;
  const items = await ExamName.find(query).sort({ name: 1 });
  const authIds = [...new Set(items.map((e) => String(e.authority_id)))];
  const auths = await Authority.find({ _id: { $in: authIds } });
  const authMap = new Map(auths.map((a) => [String(a._id), a.name]));
  const rows = items.map((e) => serializeExamName(e, authMap.get(String(e.authority_id))));
  if (!allowedExamIds) return rows;
  return rows.filter((e) => allowedExamIds.has(e.id));
}

export async function getExamNameById(id: string) {
  const e = await ExamName.findById(id);
  if (!e || !e.is_active) throw notFound('Exam not found');
  const auth = await Authority.findById(e.authority_id);
  return serializeExamName(e, auth?.name);
}

export async function createExamName(dto: CreateExamNameDto) {
  const auth = await Authority.findById(dto.authority_id);
  if (!auth || !auth.is_active) throw notFound('Authority not found');
  const existing = await ExamName.findOne({ short_name: dto.short_name });
  if (existing) throw badRequest('Exam short name already exists');
  const e = await ExamName.create({ ...dto, is_active: true, created_at: new Date() });
  return serializeExamName(e, auth.name);
}

export async function updateExamName(id: string, dto: UpdateExamNameDto) {
  const e = await ExamName.findById(id);
  if (!e) throw notFound('Exam not found');
  if (dto.short_name && dto.short_name !== e.short_name) {
    const clash = await ExamName.findOne({ short_name: dto.short_name });
    if (clash) throw badRequest('Exam short name already exists');
  }
  Object.assign(e, dto);
  await e.save();
  const auth = await Authority.findById(e.authority_id);
  return serializeExamName(e, auth?.name);
}

export async function deleteExamName(id: string) {
  const e = await ExamName.findById(id);
  if (!e) throw notFound('Exam not found');
  const [parts, types] = await Promise.all([
    ExamPart.find({ exam_name_id: e._id, is_active: true }),
    ExamType.find({ exam_name_id: e._id, is_active: true }),
  ]);
  const partIds = parts.map((p) => p._id);
  await ExamSession.updateMany({ exam_name_id: e._id }, { is_active: false });
  await ExamSubject.updateMany({ exam_part_id: { $in: partIds } }, { is_active: false });
  await ExamPart.updateMany({ exam_name_id: e._id }, { is_active: false });
  await ExamType.updateMany({ exam_name_id: e._id }, { is_active: false });
  e.is_active = false;
  await e.save();
  return { deleted: true };
}

export async function getExamTree(examNameId: string, subjectScope: ExamSubjectScope = { mode: 'all' }) {
  const exam = await ExamName.findById(examNameId);
  if (!exam || !exam.is_active) throw notFound('Exam not found');

  const authority = await Authority.findById(exam.authority_id);
  const department = authority ? await Department.findById(authority.department_id) : null;

  const [parts, types, sessions] = await Promise.all([
    ExamPart.find({ exam_name_id: examNameId, is_active: true }).sort({ part_number: 1 }),
    ExamType.find({ exam_name_id: examNameId, is_active: true }).sort({ name: 1 }),
    ExamSession.find({ exam_name_id: examNameId, is_active: true }).sort({ sort_order: -1, label_en: -1 }),
  ]);

  const partIds = parts.map((p) => p._id);
  const subjects = await ExamSubject.find({ exam_part_id: { $in: partIds }, is_active: true });
  const typeMap = new Map(types.map((t) => [String(t._id), t.name]));

  const partsWithSubjects = parts.map((p) => ({
    ...serializeExamPart(p),
    subjects: filterByExamSubjectScope(
      subjects
        .filter((s) => String(s.exam_part_id) === String(p._id))
        .map((s) => serializeExamSubject(s, typeMap.get(String(s.exam_type_id)))),
      (s) => s.id,
      subjectScope,
    ),
  }));

  return {
    department: department ? serializeDepartment(department) : null,
    authority: authority ? serializeAuthority(authority, department?.name) : null,
    exam: serializeExamName(exam, authority?.name),
    sessions: sessions.map(serializeExamSession),
    parts: partsWithSubjects,
    types: types.map(serializeExamType),
  };
}

export async function getDepartmentById(id: string) {
  const d = await Department.findById(id);
  if (!d || !d.is_active) throw notFound('Department not found');
  return serializeDepartment(d);
}

export async function getAuthorityById(id: string) {
  const a = await Authority.findById(id);
  if (!a || !a.is_active) throw notFound('Authority not found');
  const dept = await Department.findById(a.department_id);
  return serializeAuthority(a, dept?.name);
}

export async function getExamPartById(id: string) {
  const p = await ExamPart.findById(id);
  if (!p || !p.is_active) throw notFound('Exam part not found');
  return serializeExamPart(p);
}

export async function getExamTypeById(id: string) {
  const t = await ExamType.findById(id);
  if (!t || !t.is_active) throw notFound('Exam type not found');
  return serializeExamType(t);
}

// --- Exam sessions ---

export async function listExamSessions(examNameId: string) {
  const items = await ExamSession.find({ exam_name_id: examNameId, is_active: true }).sort({
    sort_order: -1,
    label_en: -1,
  });
  return items.map(serializeExamSession);
}

export async function getExamSessionById(id: string) {
  const s = await ExamSession.findById(id);
  if (!s || !s.is_active) throw notFound('Session/year not found');
  return serializeExamSession(s);
}

export async function createExamSession(dto: CreateExamSessionDto) {
  const exam = await ExamName.findById(dto.exam_name_id);
  if (!exam || !exam.is_active) throw notFound('Exam not found');
  const clash = await ExamSession.findOne({
    exam_name_id: dto.exam_name_id,
    label_en: dto.label_en.trim(),
    is_active: true,
  });
  if (clash) throw badRequest('This session/year/training entry already exists for the exam program');
  const latest = await ExamSession.findOne({ exam_name_id: dto.exam_name_id })
    .sort({ sort_order: -1 })
    .select('sort_order');
  const s = await ExamSession.create({
    exam_name_id: dto.exam_name_id,
    label_en: dto.label_en.trim(),
    label_bn: dto.label_bn?.trim() || undefined,
    sort_order: dto.sort_order ?? (latest?.sort_order ?? 0) + 1,
    is_active: true,
    created_at: new Date(),
  });
  return serializeExamSession(s);
}

export async function updateExamSession(id: string, dto: UpdateExamSessionDto) {
  const s = await ExamSession.findById(id);
  if (!s) throw notFound('Session/year not found');
  if (dto.label_en && dto.label_en.trim() !== s.label_en) {
    const clash = await ExamSession.findOne({
      exam_name_id: s.exam_name_id,
      label_en: dto.label_en.trim(),
      is_active: true,
      _id: { $ne: s._id },
    });
    if (clash) throw badRequest('This session/year/training entry already exists for the exam program');
  }
  if (dto.label_en !== undefined) s.label_en = dto.label_en.trim();
  if (dto.label_bn !== undefined) s.label_bn = dto.label_bn.trim() || undefined;
  if (dto.sort_order !== undefined) s.sort_order = dto.sort_order;
  if (dto.is_active !== undefined) s.is_active = dto.is_active;
  await s.save();
  return serializeExamSession(s);
}

export async function deleteExamSession(id: string) {
  const s = await ExamSession.findById(id);
  if (!s) throw notFound('Session/year not found');
  const paperCount = await PaperDetail.countDocuments({ exam_session_id: s._id, is_active: true });
  if (paperCount > 0) {
    throw badRequest('Remove or reassign question papers under this session/year first');
  }
  s.is_active = false;
  await s.save();
  return { deleted: true };
}

// --- Exam parts ---

export async function listExamParts(examNameId: string) {
  const items = await ExamPart.find({ exam_name_id: examNameId, is_active: true }).sort({ part_number: 1 });
  return items.map(serializeExamPart);
}

export async function createExamPart(dto: CreateExamPartDto) {
  const exam = await ExamName.findById(dto.exam_name_id);
  if (!exam || !exam.is_active) throw notFound('Exam not found');
  const clash = await ExamPart.findOne({ exam_name_id: dto.exam_name_id, part_number: dto.part_number });
  if (clash) throw badRequest('Part number already exists for this exam');
  const p = await ExamPart.create({ ...dto, is_active: true });
  return serializeExamPart(p);
}

export async function updateExamPart(id: string, dto: UpdateExamPartDto) {
  const p = await ExamPart.findById(id);
  if (!p) throw notFound('Exam part not found');
  if (dto.part_number !== undefined && dto.part_number !== p.part_number) {
    const clash = await ExamPart.findOne({ exam_name_id: p.exam_name_id, part_number: dto.part_number });
    if (clash) throw badRequest('Part number already exists');
  }
  Object.assign(p, dto);
  await p.save();
  return serializeExamPart(p);
}

export async function deleteExamPart(id: string) {
  const p = await ExamPart.findById(id);
  if (!p) throw notFound('Exam part not found');
  await ExamSubject.updateMany({ exam_part_id: p._id }, { is_active: false });
  p.is_active = false;
  await p.save();
  return { deleted: true };
}

// --- Exam types ---

export async function listExamTypes(examNameId: string) {
  const items = await ExamType.find({ exam_name_id: examNameId, is_active: true }).sort({ name: 1 });
  return items.map(serializeExamType);
}

export async function createExamType(dto: CreateExamTypeDto) {
  const exam = await ExamName.findById(dto.exam_name_id);
  if (!exam || !exam.is_active) throw notFound('Exam not found');
  const t = await ExamType.create({ ...dto, is_active: true });
  return serializeExamType(t);
}

export async function updateExamType(id: string, dto: UpdateExamTypeDto) {
  const t = await ExamType.findById(id);
  if (!t) throw notFound('Exam type not found');
  Object.assign(t, dto);
  await t.save();
  return serializeExamType(t);
}

export async function deleteExamType(id: string) {
  const t = await ExamType.findById(id);
  if (!t) throw notFound('Exam type not found');
  const subjectCount = await ExamSubject.countDocuments({ exam_type_id: t._id, is_active: true });
  if (subjectCount > 0) throw badRequest('Remove or deactivate subjects using this exam type first');
  t.is_active = false;
  await t.save();
  return { deleted: true };
}

// --- Exam subjects ---

export async function listExamSubjects(examPartId: string, subjectScope: ExamSubjectScope = { mode: 'all' }) {
  const items = await ExamSubject.find({ exam_part_id: examPartId, is_active: true });
  const typeIds = [...new Set(items.map((s) => String(s.exam_type_id)))];
  const types = await ExamType.find({ _id: { $in: typeIds } });
  const typeMap = new Map(types.map((t) => [String(t._id), t.name]));
  return filterByExamSubjectScope(
    items.map((s) => serializeExamSubject(s, typeMap.get(String(s.exam_type_id)))),
    (s) => s.id,
    subjectScope,
  );
}

export async function getExamSubjectById(id: string, subjectScope: ExamSubjectScope = { mode: 'all' }) {
  const s = await ExamSubject.findById(id);
  if (!s || !s.is_active) throw notFound('Exam subject not found');
  assertExamSubjectAllowed(subjectScope, String(s._id));
  const [type, part] = await Promise.all([
    ExamType.findById(s.exam_type_id),
    ExamPart.findById(s.exam_part_id),
  ]);
  const exam = part ? await ExamName.findById(part.exam_name_id) : null;
  return {
    ...serializeExamSubject(s, type?.name),
    exam_part_name: part?.name,
    exam_name_id: idStr(part?.exam_name_id),
    exam_name: exam?.name,
    exam_short_name: exam?.short_name,
  };
}

async function assertSubjectSlotUnique(
  examPartId: mongoose.Types.ObjectId | string,
  examTypeId: mongoose.Types.ObjectId | string,
  name: string,
  excludeId?: mongoose.Types.ObjectId | string,
) {
  const dup = await ExamSubject.findOne({
    exam_part_id: examPartId,
    exam_type_id: examTypeId,
    name: name.trim(),
    is_active: true,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  if (dup) {
    throw badRequest(
      'This subject already exists for the selected part and type. Use the existing subject to add more question papers.',
    );
  }
}

export async function createExamSubject(dto: CreateExamSubjectDto) {
  const [part, type] = await Promise.all([
    ExamPart.findById(dto.exam_part_id),
    ExamType.findById(dto.exam_type_id),
  ]);
  if (!part || !part.is_active) throw notFound('Exam part not found');
  if (!type || !type.is_active) throw notFound('Exam type not found');
  if (String(part.exam_name_id) !== String(type.exam_name_id)) {
    throw badRequest('Exam part and type must belong to the same exam');
  }
  await assertSubjectSlotUnique(dto.exam_part_id, dto.exam_type_id, dto.name);
  const s = await ExamSubject.create({ ...dto, is_active: true });
  return serializeExamSubject(s, type.name);
}

export async function updateExamSubject(id: string, dto: UpdateExamSubjectDto) {
  const s = await ExamSubject.findById(id);
  if (!s) throw notFound('Exam subject not found');
  if (dto.exam_type_id) {
    const type = await ExamType.findById(dto.exam_type_id);
    if (!type) throw notFound('Exam type not found');
  }
  Object.assign(s, dto);
  const partId = dto.exam_part_id ?? s.exam_part_id;
  const typeId = dto.exam_type_id ?? s.exam_type_id;
  const name = dto.name ?? s.name;
  await assertSubjectSlotUnique(partId, typeId, name, s._id);
  await s.save();
  const type = await ExamType.findById(s.exam_type_id);
  return serializeExamSubject(s, type?.name);
}

export async function deleteExamSubject(id: string) {
  const s = await ExamSubject.findById(id);
  if (!s) throw notFound('Exam subject not found');
  s.is_active = false;
  await s.save();
  return { deleted: true };
}
