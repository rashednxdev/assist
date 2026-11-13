import mongoose from 'mongoose';
import type {
  AskSalaryQuestionDto,
  AskSalaryQuestionResult,
  SalaryCalcGuide,
  SalaryCalcGuideWriteDto,
  SalaryTrNotice,
  SalaryTrNoticeWriteDto,
  SalaryCircularRecord,
  SalaryCircularWriteDto,
  SalaryFaqRecord,
  SalaryFaqStatus,
  SalaryFaqWriteDto,
  SalaryHelpFeed,
  SalaryOpenQuestion,
} from '@ibas/shared-types';
import { rankSalaryQuestions, SALARY_FAQ_STATUSES, sanitizeRichHtml } from '@ibas/shared-types';
import { badRequest, notFound } from '../../shared/errors/AppError.js';
import { User } from '../users/models/User.model.js';
import { SalaryCalcGuide as SalaryCalcGuideModel } from './models/SalaryCalcGuide.model.js';
import { SalaryTrNotice as SalaryTrNoticeModel } from './models/SalaryTrNotice.model.js';
import { SalaryCircular, type ISalaryCircular } from './models/SalaryCircular.model.js';
import { SalaryFaq, type ISalaryFaq } from './models/SalaryFaq.model.js';

function iso(value: Date | string | undefined | null): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function faqRecord(doc: ISalaryFaq): SalaryFaqRecord {
  return {
    id: String(doc._id),
    question_bn: doc.question_bn ?? '',
    question_en: doc.question_en ?? '',
    answer_bn: doc.answer_bn ?? '',
    answer_en: doc.answer_en ?? '',
    status: doc.status,
    pinned: Boolean(doc.pinned),
    circular_ids: (doc.circular_ids ?? []).map((id) => String(id)),
    asker_name: doc.asker_name ?? '',
    created_at: iso(doc.created_at),
    updated_at: iso(doc.updated_at),
  };
}

function circularRecord(doc: ISalaryCircular): SalaryCircularRecord {
  return {
    id: String(doc._id),
    title_bn: doc.title_bn ?? '',
    title_en: doc.title_en ?? '',
    circular_no: doc.circular_no ?? '',
    publish_date: doc.publish_date,
    source_url: doc.source_url,
    source_name: doc.source_name,
    summary_bn: doc.summary_bn ?? '',
    summary_en: doc.summary_en ?? '',
    is_published: Boolean(doc.is_published),
    created_at: iso(doc.created_at),
    updated_at: iso(doc.updated_at),
  };
}

function requireId(id: string): mongoose.Types.ObjectId {
  if (!mongoose.isValidObjectId(id)) throw notFound();
  return new mongoose.Types.ObjectId(id);
}

async function existingCircularIds(ids: string[]): Promise<mongoose.Types.ObjectId[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const found = await SalaryCircular.find({ _id: { $in: unique } })
    .select('_id')
    .lean();
  if (found.length !== unique.length) throw badRequest('One or more linked circulars do not exist');
  return unique.map((id) => new mongoose.Types.ObjectId(id));
}

async function matchQuestions(query: string) {
  const rows = await SalaryFaq.find({ status: { $in: ['pending', 'published'] } })
    .select('question_bn question_en status')
    .limit(500)
    .lean();
  return rankSalaryQuestions(
    query,
    rows.map((row) => ({
      id: String(row._id),
      status: row.status,
      texts: [row.question_bn ?? '', row.question_en ?? ''],
    })),
  );
}

export async function getSalaryHelpFeed(userId: string): Promise<SalaryHelpFeed> {
  const [faqs, circulars, pending, rejectedMine] = await Promise.all([
    SalaryFaq.find({ status: 'published' }).sort({ pinned: -1, created_at: -1 }).limit(300),
    SalaryCircular.find({ is_published: true }).sort({ publish_date: -1, created_at: -1 }).limit(200),
    SalaryFaq.find({ status: 'pending' }).sort({ created_at: -1 }).limit(300),
    SalaryFaq.find({ status: 'rejected', asked_by: userId }).sort({ created_at: -1 }).limit(50),
  ]);

  const open: SalaryOpenQuestion[] = [
    ...pending.map((doc) => ({
      id: String(doc._id),
      question_bn: doc.question_bn ?? '',
      question_en: doc.question_en ?? '',
      status: 'pending' as const,
      mine: String(doc.asked_by ?? '') === userId,
      created_at: iso(doc.created_at),
    })),
    ...rejectedMine.map((doc) => ({
      id: String(doc._id),
      question_bn: doc.question_bn ?? '',
      question_en: doc.question_en ?? '',
      status: 'rejected' as const,
      mine: true,
      created_at: iso(doc.created_at),
    })),
  ];

  return {
    faqs: faqs.map(faqRecord),
    circulars: circulars.map(circularRecord),
    open_questions: open,
  };
}

export async function askSalaryQuestion(userId: string, dto: AskSalaryQuestionDto): Promise<AskSalaryQuestionResult> {
  const matches = await matchQuestions(dto.question);
  if (matches.length > 0) {
    return { created: false, item: null, matches };
  }

  const user = await User.findById(userId).select('full_name_en').lean();
  const created = await SalaryFaq.create({
    question_bn: dto.locale === 'bn' ? dto.question : '',
    question_en: dto.locale === 'en' ? dto.question : '',
    answer_bn: '',
    answer_en: '',
    status: 'pending',
    pinned: false,
    circular_ids: [],
    asked_by: userId,
    asker_name: user?.full_name_en?.trim() || 'User',
  });
  return { created: true, item: faqRecord(created), matches: [] };
}

function parseStatus(status: string): SalaryFaqStatus | null {
  return (SALARY_FAQ_STATUSES as readonly string[]).includes(status) ? (status as SalaryFaqStatus) : null;
}

export async function listAdminSalaryFaqs(status: string): Promise<SalaryFaqRecord[]> {
  const filter = parseStatus(status);
  const rows = await SalaryFaq.find(filter ? { status: filter } : {})
    .sort({ status: 1, pinned: -1, created_at: -1 })
    .limit(500);
  return rows.map(faqRecord);
}

export async function createAdminSalaryFaq(dto: SalaryFaqWriteDto): Promise<SalaryFaqRecord> {
  const circularIds = await existingCircularIds(dto.circular_ids);
  const created = await SalaryFaq.create({
    ...dto,
    circular_ids: circularIds,
    asked_by: null,
    asker_name: '',
  });
  return faqRecord(created);
}

export async function updateAdminSalaryFaq(id: string, dto: SalaryFaqWriteDto): Promise<SalaryFaqRecord> {
  const circularIds = await existingCircularIds(dto.circular_ids);
  const updated = await SalaryFaq.findByIdAndUpdate(
    requireId(id),
    { ...dto, circular_ids: circularIds },
    { new: true },
  );
  if (!updated) throw notFound('Question not found');
  return faqRecord(updated);
}

export async function deleteAdminSalaryFaq(id: string): Promise<void> {
  const deleted = await SalaryFaq.findByIdAndDelete(requireId(id));
  if (!deleted) throw notFound('Question not found');
}

export async function listAdminSalaryCirculars(): Promise<SalaryCircularRecord[]> {
  const rows = await SalaryCircular.find({}).sort({ publish_date: -1, created_at: -1 }).limit(500);
  return rows.map(circularRecord);
}

export async function createAdminSalaryCircular(
  userId: string,
  dto: SalaryCircularWriteDto,
): Promise<SalaryCircularRecord> {
  const created = await SalaryCircular.create({ ...dto, created_by: userId });
  return circularRecord(created);
}

export async function updateAdminSalaryCircular(id: string, dto: SalaryCircularWriteDto): Promise<SalaryCircularRecord> {
  const updated = await SalaryCircular.findByIdAndUpdate(requireId(id), dto, { new: true });
  if (!updated) throw notFound('Circular not found');
  return circularRecord(updated);
}

export async function getSalaryCalcGuide(): Promise<SalaryCalcGuide> {
  const doc = await SalaryCalcGuideModel.findOne({ key: 'global' }).lean();
  return {
    body_bn: doc?.body_bn ?? '',
    body_en: doc?.body_en ?? '',
    updated_at: iso(doc?.updated_at),
  };
}

export async function saveSalaryCalcGuide(userId: string, dto: SalaryCalcGuideWriteDto): Promise<SalaryCalcGuide> {
  const body_bn = sanitizeRichHtml(dto.body_bn);
  const body_en = sanitizeRichHtml(dto.body_en);
  const doc = await SalaryCalcGuideModel.findOneAndUpdate(
    { key: 'global' },
    { key: 'global', body_bn, body_en, updated_by: userId, updated_at: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return {
    body_bn: doc.body_bn ?? '',
    body_en: doc.body_en ?? '',
    updated_at: iso(doc.updated_at),
  };
}

export async function getSalaryTrNotice(): Promise<SalaryTrNotice> {
  const doc = await SalaryTrNoticeModel.findOne({ key: 'global' }).lean();
  return {
    body_bn: doc?.body_bn ?? '',
    body_en: doc?.body_en ?? '',
    confirm_bn: doc?.confirm_bn ?? '',
    confirm_en: doc?.confirm_en ?? '',
    shown: doc?.shown !== false,
    updated_at: iso(doc?.updated_at),
  };
}

export async function setSalaryTrNoticeShown(userId: string, shown: boolean): Promise<SalaryTrNotice> {
  await SalaryTrNoticeModel.findOneAndUpdate(
    { key: 'global' },
    { $set: { shown, updated_by: userId, updated_at: new Date() }, $setOnInsert: { key: 'global' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return getSalaryTrNotice();
}

export async function saveSalaryTrNotice(userId: string, dto: SalaryTrNoticeWriteDto): Promise<SalaryTrNotice> {
  const doc = await SalaryTrNoticeModel.findOneAndUpdate(
    { key: 'global' },
    {
      key: 'global',
      body_bn: sanitizeRichHtml(dto.body_bn),
      body_en: sanitizeRichHtml(dto.body_en),
      confirm_bn: dto.confirm_bn,
      confirm_en: dto.confirm_en,
      updated_by: userId,
      updated_at: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return {
    body_bn: doc.body_bn ?? '',
    body_en: doc.body_en ?? '',
    confirm_bn: doc.confirm_bn ?? '',
    confirm_en: doc.confirm_en ?? '',
    shown: doc.shown !== false,
    updated_at: iso(doc.updated_at),
  };
}

export async function deleteAdminSalaryCircular(id: string): Promise<void> {
  const objectId = requireId(id);
  const deleted = await SalaryCircular.findByIdAndDelete(objectId);
  if (!deleted) throw notFound('Circular not found');
  await SalaryFaq.updateMany({ circular_ids: objectId }, { $pull: { circular_ids: objectId } });
}
