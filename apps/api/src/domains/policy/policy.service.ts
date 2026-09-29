import mongoose from 'mongoose';
import { POLICY_COLLECTIONS } from '@ibas/shared-constants';
import {
  updateBookCollectionsSchema,
  type PolicyBookItem,
  type PolicyCollectionSummary,
} from '@ibas/shared-types';
import { badRequest, notFound } from '../../shared/errors/AppError.js';
import { BookInfo } from '../books/models/BookInfo.model.js';
import { BookType } from '../books/models/BookType.model.js';
import { Circular } from './models/Circular.model.js';

async function loadBooks(filter: Record<string, unknown>): Promise<PolicyBookItem[]> {
  const [books, types] = await Promise.all([
    BookInfo.find(filter)
      .select('name name_bn short_name book_type_id is_published policy_collections')
      .sort({ name: 1 })
      .lean(),
    BookType.find({}).select('name').lean(),
  ]);
  const typeName = new Map(types.map((t) => [String(t._id), t.name]));
  return books.map((b) => ({
    id: String(b._id),
    name: b.name,
    name_bn: b.name_bn,
    short_name: b.short_name || undefined,
    book_type_name: typeName.get(String(b.book_type_id)),
    is_published: b.is_published,
    policy_collections: (b.policy_collections ?? []) as PolicyBookItem['policy_collections'],
  }));
}

export async function listPolicyCollections(isAdmin: boolean): Promise<PolicyCollectionSummary[]> {
  const bookFilter = isAdmin
    ? { is_active: true, policy_collections: { $exists: true, $ne: [] } }
    : { is_active: true, is_published: true, policy_collections: { $exists: true, $ne: [] } };
  const [books, circularCounts] = await Promise.all([
    loadBooks(bookFilter),
    Circular.aggregate<{ _id: string; count: number }>([
      { $match: { is_active: true, is_published: true } },
      { $unwind: '$collections' },
      { $group: { _id: '$collections', count: { $sum: 1 } } },
    ]),
  ]);
  const counts = new Map(circularCounts.map((c) => [c._id, c.count]));
  return POLICY_COLLECTIONS.map((c) => ({
    code: c.code,
    name_en: c.name_en,
    name_bn: c.name_bn,
    description_en: c.description_en,
    books: books.filter((b) => b.policy_collections.includes(c.code)),
    circular_count: counts.get(c.code) ?? 0,
  }));
}

export function listAllBooksForAdmin(): Promise<PolicyBookItem[]> {
  return loadBooks({ is_active: true });
}

export async function setBookCollections(bookId: string, body: unknown): Promise<PolicyBookItem> {
  if (!mongoose.isValidObjectId(bookId)) throw notFound('Book not found');
  const parsed = updateBookCollectionsSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join('; '));
  const res = await BookInfo.updateOne(
    { _id: bookId, is_active: true },
    { $set: { policy_collections: [...new Set(parsed.data.policy_collections)] } },
  );
  if (res.matchedCount === 0) throw notFound('Book not found');
  const [item] = await loadBooks({ _id: bookId });
  return item!;
}
