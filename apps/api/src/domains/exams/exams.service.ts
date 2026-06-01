import mongoose from 'mongoose';
import type {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  CreateAuthorityDto,
  UpdateAuthorityDto,
  CreateExamNameDto,
  UpdateExamNameDto,
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
import { notFound, badRequest } from '../../shared/errors/AppError.js';

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
    short_name: e.short_name,
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
    part_number: p.part_number,
    description: p.description,
    total_marks: p.total_marks,
    pass_marks: p.pass_marks,
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

function serializeExamSubject(s: InstanceType<typeof ExamSubject>, typeName?: string) {
  return {
    id: String(s._id),
    exam_part_id: String(s.exam_part_id),
    exam_type_id: String(s.exam_type_id),
    exam_type_name: typeName,
    name: s.name,
    total_marks: s.total_marks,
    pass_marks: s.pass_marks,
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

// --- Exam names ---

export async function listExamNames(authorityId?: string) {
  const query: Record<string, unknown> = { is_active: true };
  if (authorityId) query.authority_id = authorityId;
  const items = await ExamName.find(query).sort({ name: 1 });
  const authIds = [...new Set(items.map((e) => String(e.authority_id)))];
  const auths = await Authority.find({ _id: { $in: authIds } });
  const authMap = new Map(auths.map((a) => [String(a._id), a.name]));
  return items.map((e) => serializeExamName(e, authMap.get(String(e.authority_id))));
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

export async function getExamTree(examNameId: string) {
  const exam = await ExamName.findById(examNameId);
  if (!exam || !exam.is_active) throw notFound('Exam not found');

  const authority = await Authority.findById(exam.authority_id);
  const department = authority ? await Department.findById(authority.department_id) : null;

  const [parts, types] = await Promise.all([
    ExamPart.find({ exam_name_id: examNameId, is_active: true }).sort({ part_number: 1 }),
    ExamType.find({ exam_name_id: examNameId, is_active: true }).sort({ name: 1 }),
  ]);

  const partIds = parts.map((p) => p._id);
  const subjects = await ExamSubject.find({ exam_part_id: { $in: partIds }, is_active: true });
  const typeMap = new Map(types.map((t) => [String(t._id), t.name]));

  const partsWithSubjects = parts.map((p) => ({
    ...serializeExamPart(p),
    subjects: subjects
      .filter((s) => String(s.exam_part_id) === String(p._id))
      .map((s) => serializeExamSubject(s, typeMap.get(String(s.exam_type_id)))),
  }));

  return {
    department: department ? serializeDepartment(department) : null,
    authority: authority ? serializeAuthority(authority, department?.name) : null,
    exam: serializeExamName(exam, authority?.name),
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

// --- Exam subjects ---

export async function listExamSubjects(examPartId: string) {
  const items = await ExamSubject.find({ exam_part_id: examPartId, is_active: true });
  const typeIds = [...new Set(items.map((s) => String(s.exam_type_id)))];
  const types = await ExamType.find({ _id: { $in: typeIds } });
  const typeMap = new Map(types.map((t) => [String(t._id), t.name]));
  return items.map((s) => serializeExamSubject(s, typeMap.get(String(s.exam_type_id))));
}

export async function getExamSubjectById(id: string) {
  const s = await ExamSubject.findById(id);
  if (!s || !s.is_active) throw notFound('Exam subject not found');
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
