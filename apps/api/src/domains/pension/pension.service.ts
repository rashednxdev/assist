import {
  calculatePension,
  calculatePrl,
  createPensionLeaveTypeSchema,
  ensureRestLeaveType,
  ensureSuspensionAndUnauthorizedLeaveTypes,
  pensionCalculateSchema,
  pensionPrlCalculateSchema,
  updatePensionLeaveTypeSchema,
  type PensionCalculateInput,
  type PensionLeaveTypeCalc,
} from '@ibas/shared-types';
import { badRequest, notFound } from '../../shared/errors/AppError.js';
import { PensionLeaveType } from './models/PensionLeaveType.model.js';

function serializeLeaveType(doc: InstanceType<typeof PensionLeaveType>) {
  return {
    id: String(doc._id),
    code: doc.code,
    name_en: doc.name_en,
    name_bn: doc.name_bn,
    description_en: doc.description_en,
    pay_category: doc.pay_category,
    deduction_rule: doc.deduction_rule,
    sort_order: doc.sort_order,
    is_active: doc.is_active,
    is_auto_entitlement: doc.is_auto_entitlement ?? false,
    entitlement_days_per_cycle: doc.entitlement_days_per_cycle,
    entitlement_cycle_years: doc.entitlement_cycle_years,
    allowance_basic_months: doc.allowance_basic_months,
  };
}

export async function listLeaveTypes(activeOnly = true) {
  const query = activeOnly ? { is_active: true } : {};
  const items = await PensionLeaveType.find(query).sort({ sort_order: 1, name_en: 1 });
  return items.map(serializeLeaveType);
}

export async function createLeaveType(dto: ReturnType<typeof createPensionLeaveTypeSchema.parse>) {
  const exists = await PensionLeaveType.findOne({ code: dto.code.toUpperCase() });
  if (exists) throw badRequest('Leave type code already exists');
  const doc = await PensionLeaveType.create({
    ...dto,
    code: dto.code.toUpperCase(),
    is_auto_entitlement: dto.is_auto_entitlement ?? false,
  });
  return serializeLeaveType(doc);
}

export async function updateLeaveType(id: string, dto: ReturnType<typeof updatePensionLeaveTypeSchema.parse>) {
  const doc = await PensionLeaveType.findById(id);
  if (!doc) throw notFound('Leave type not found');
  if (dto.code && dto.code.toUpperCase() !== doc.code) {
    const dup = await PensionLeaveType.findOne({ code: dto.code.toUpperCase(), _id: { $ne: id } });
    if (dup) throw badRequest('Leave type code already exists');
    doc.code = dto.code.toUpperCase();
  }
  if (dto.name_en !== undefined) doc.name_en = dto.name_en;
  if (dto.name_bn !== undefined) doc.name_bn = dto.name_bn;
  if (dto.description_en !== undefined) doc.description_en = dto.description_en;
  if (dto.pay_category !== undefined) doc.pay_category = dto.pay_category;
  if (dto.deduction_rule !== undefined) doc.deduction_rule = dto.deduction_rule;
  if (dto.sort_order !== undefined) doc.sort_order = dto.sort_order;
  if (dto.is_active !== undefined) doc.is_active = dto.is_active;
  if (dto.is_auto_entitlement !== undefined) doc.is_auto_entitlement = dto.is_auto_entitlement;
  if (dto.entitlement_days_per_cycle !== undefined) {
    doc.entitlement_days_per_cycle = dto.entitlement_days_per_cycle;
  }
  if (dto.entitlement_cycle_years !== undefined) doc.entitlement_cycle_years = dto.entitlement_cycle_years;
  if (dto.allowance_basic_months !== undefined) doc.allowance_basic_months = dto.allowance_basic_months;
  await doc.save();
  return serializeLeaveType(doc);
}

export async function deleteLeaveType(id: string) {
  const doc = await PensionLeaveType.findById(id);
  if (!doc) throw notFound('Leave type not found');
  doc.is_active = false;
  await doc.save();
  return serializeLeaveType(doc);
}

export async function calculatePensionAccount(dto: ReturnType<typeof pensionCalculateSchema.parse>) {
  const types = await listLeaveTypes(true);
  if (types.length === 0) throw badRequest('No leave types configured. Ask an admin to set up pension leave types.');

  const calcTypes: PensionLeaveTypeCalc[] = ensureSuspensionAndUnauthorizedLeaveTypes(
    ensureRestLeaveType(
      types.map((t) => ({
        id: t.id,
        code: t.code,
        name_en: t.name_en,
        pay_category: t.pay_category,
        deduction_rule: t.deduction_rule,
        is_auto_entitlement: t.is_auto_entitlement,
        entitlement_days_per_cycle: t.entitlement_days_per_cycle,
        entitlement_cycle_years: t.entitlement_cycle_years,
        allowance_basic_months: t.allowance_basic_months,
      })),
    ),
  );

  // Validate against calcTypes (not the raw DB list) so synthesized fallback
  // types (REST, SUSPENSION, UNAUTHORISEDLEAVE) are accepted even when unseeded.
  const unknown = dto.enjoyed_leaves.find((row) => !calcTypes.some((t) => t.id === row.leave_type_id));
  if (unknown) throw badRequest('One or more leave types are invalid or inactive');

  const input: PensionCalculateInput = {
    join_date: dto.join_date,
    end_date: dto.end_date,
    last_basic_salary: dto.last_basic_salary,
    enjoyed_leaves: dto.enjoyed_leaves,
  };

  return calculatePension(input, calcTypes);
}

export function calculatePrlAccount(dto: ReturnType<typeof pensionPrlCalculateSchema.parse>) {
  return calculatePrl({
    dob: dto.dob,
    prl_date: dto.prl_date,
    total_leave_months: dto.total_leave_months,
    last_basic_salary: dto.last_basic_salary,
    chosen_lump_sum_months: dto.chosen_lump_sum_months,
  });
}
