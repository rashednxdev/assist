import type { Response } from 'express';
import {
  createSyllabusGroupSchema,
  updateSyllabusGroupSchema,
  createSyllabusTopicSchema,
  updateSyllabusTopicSchema,
  createSyllabusSubTopicSchema,
  updateSyllabusSubTopicSchema,
  createSyllabusReferenceSchema,
  updateSyllabusReferenceSchema,
} from '@ibas/shared-types';
import type { AuthRequest } from '../../middleware/auth.js';
import * as syllabusService from './syllabus.service.js';

export async function getSyllabusTreeHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await syllabusService.getSyllabusTree(String(req.params.subjectId)) });
}

export async function createSyllabusGroupHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createSyllabusGroupSchema.parse(req.body);
  res.status(201).json({ data: await syllabusService.createSyllabusGroup(dto) });
}

export async function updateSyllabusGroupHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateSyllabusGroupSchema.parse(req.body);
  res.json({ data: await syllabusService.updateSyllabusGroup(String(req.params.id), dto) });
}

export async function createSyllabusTopicHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createSyllabusTopicSchema.parse(req.body);
  res.status(201).json({ data: await syllabusService.createSyllabusTopic(dto) });
}

export async function updateSyllabusTopicHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateSyllabusTopicSchema.parse(req.body);
  res.json({ data: await syllabusService.updateSyllabusTopic(String(req.params.id), dto) });
}

export async function createSyllabusSubTopicHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createSyllabusSubTopicSchema.parse(req.body);
  res.status(201).json({ data: await syllabusService.createSyllabusSubTopic(dto) });
}

export async function updateSyllabusSubTopicHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateSyllabusSubTopicSchema.parse(req.body);
  res.json({ data: await syllabusService.updateSyllabusSubTopic(String(req.params.id), dto) });
}

export async function createSyllabusReferenceHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createSyllabusReferenceSchema.parse(req.body);
  res.status(201).json({ data: await syllabusService.createSyllabusReference(dto) });
}

export async function updateSyllabusReferenceHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateSyllabusReferenceSchema.parse(req.body);
  res.json({ data: await syllabusService.updateSyllabusReference(String(req.params.id), dto) });
}

export async function deleteSyllabusReferenceHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await syllabusService.deleteSyllabusReference(String(req.params.id)) });
}

export async function deleteSyllabusGroupHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await syllabusService.deleteSyllabusGroup(String(req.params.id)) });
}

export async function deleteSyllabusTopicHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await syllabusService.deleteSyllabusTopic(String(req.params.id)) });
}

export async function deleteSyllabusSubTopicHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await syllabusService.deleteSyllabusSubTopic(String(req.params.id)) });
}

export async function getSyllabusReferenceHandler(req: AuthRequest, res: Response): Promise<void> {
  res.json({ data: await syllabusService.getSyllabusReferenceById(String(req.params.id)) });
}
