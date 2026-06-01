import type { Request } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export function parsePagination(req: Request): { page: number; limit: number; skip: number } {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}
