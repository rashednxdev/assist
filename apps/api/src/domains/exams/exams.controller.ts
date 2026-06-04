import type { Response } from 'express';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  createAuthoritySchema,
  updateAuthoritySchema,
  createExamNameSchema,
  updateExamNameSchema,
  createExamPartSchema,
  updateExamPartSchema,
  createExamTypeSchema,
  updateExamTypeSchema,
  createExamSubjectSchema,
  updateExamSubjectSchema,
} from '@ibas/shared-types';
import type { AuthRequest } from '../../middleware/auth.js';
import * as examsService from './exams.service.js';

export async function listDepartmentsHandler(_req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await examsService.listDepartments() });
}

export async function createDepartmentHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createDepartmentSchema.parse(req.body);
  res.status(201).json({ data: await examsService.createDepartment(dto) });
}

export async function updateDepartmentHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateDepartmentSchema.parse(req.body);
  res.json({ data: await examsService.updateDepartment(String(req.params.id), dto) });
}

export async function deleteDepartmentHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await examsService.deleteDepartment(String(req.params.id)) });
}

export async function getDepartmentHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await examsService.getDepartmentById(String(req.params.id)) });
}

export async function listAuthoritiesHandler(req: AuthRequest, res: Response): Promise<void> {
  const departmentId = req.query.department_id ? String(req.query.department_id) : undefined;
  res.json({ data: await examsService.listAuthorities(departmentId) });
}

export async function createAuthorityHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createAuthoritySchema.parse(req.body);
  res.status(201).json({ data: await examsService.createAuthority(dto) });
}

export async function updateAuthorityHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateAuthoritySchema.parse(req.body);
  res.json({ data: await examsService.updateAuthority(String(req.params.id), dto) });
}

export async function deleteAuthorityHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await examsService.deleteAuthority(String(req.params.id)) });
}

export async function getAuthorityHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await examsService.getAuthorityById(String(req.params.id)) });
}

export async function listExamNamesHandler(req: AuthRequest, res: Response): Promise<void> {
  const authorityId = req.query.authority_id ? String(req.query.authority_id) : undefined;
  res.json({ data: await examsService.listExamNames(authorityId) });
}

export async function getExamNameHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await examsService.getExamNameById(String(req.params.id)) });
}

export async function getExamTreeHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await examsService.getExamTree(String(req.params.id)) });
}

export async function createExamNameHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createExamNameSchema.parse(req.body);
  res.status(201).json({ data: await examsService.createExamName(dto) });
}

export async function updateExamNameHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateExamNameSchema.parse(req.body);
  res.json({ data: await examsService.updateExamName(String(req.params.id), dto) });
}

export async function deleteExamNameHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await examsService.deleteExamName(String(req.params.id)) });
}

export async function listExamPartsHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await examsService.listExamParts(String(req.params.examId)) });
}

export async function createExamPartHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createExamPartSchema.parse(req.body);
  res.status(201).json({ data: await examsService.createExamPart(dto) });
}

export async function updateExamPartHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateExamPartSchema.parse(req.body);
  res.json({ data: await examsService.updateExamPart(String(req.params.id), dto) });
}

export async function deleteExamPartHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await examsService.deleteExamPart(String(req.params.id)) });
}

export async function getExamPartHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await examsService.getExamPartById(String(req.params.id)) });
}

export async function listExamTypesHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await examsService.listExamTypes(String(req.params.examId)) });
}

export async function createExamTypeHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createExamTypeSchema.parse(req.body);
  res.status(201).json({ data: await examsService.createExamType(dto) });
}

export async function updateExamTypeHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateExamTypeSchema.parse(req.body);
  res.json({ data: await examsService.updateExamType(String(req.params.id), dto) });
}

export async function deleteExamTypeHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await examsService.deleteExamType(String(req.params.id)) });
}

export async function getExamTypeHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await examsService.getExamTypeById(String(req.params.id)) });
}

export async function listExamSubjectsHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await examsService.listExamSubjects(String(req.params.partId)) });
}

export async function getExamSubjectHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await examsService.getExamSubjectById(String(req.params.id)) });
}

export async function createExamSubjectHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createExamSubjectSchema.parse(req.body);
  res.status(201).json({ data: await examsService.createExamSubject(dto) });
}

export async function updateExamSubjectHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateExamSubjectSchema.parse(req.body);
  res.json({ data: await examsService.updateExamSubject(String(req.params.id), dto) });
}

export async function deleteExamSubjectHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await examsService.deleteExamSubject(String(req.params.id)) });
}
