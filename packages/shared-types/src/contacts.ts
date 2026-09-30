import { z } from 'zod';

const mongoId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

/** What the viewer may do in the contact directory. */
export interface ContactAccess {
  /** Office + designation set (or admin) — the directory is open. */
  ready: boolean;
  /** Paid users (any active package, admin-marked paid, or admin) can see full numbers and call. */
  can_dial: boolean;
  is_admin: boolean;
  my_office_id: string | null;
  privacy: ContactPrivacy;
}

export interface ContactPrivacy {
  hide_phone: boolean;
  hide_email: boolean;
}

export const contactPrivacySchema = z.object({
  hide_phone: z.boolean(),
  hide_email: z.boolean(),
});

export interface ContactPhone {
  /** Full number for paid viewers, partly hidden (e.g. 017•••••45) otherwise. */
  display: string;
  /** Dialable number; only sent to paid viewers. */
  dial?: string;
}

export interface ContactOffice {
  id: string;
  name: string;
  name_bn?: string;
  short_name?: string;
  office_code?: string;
  office_type: { id: string; name: string; short_name: string } | null;
  parent_id: string | null;
  parent_path: string;
  email?: string;
  web_address?: string;
  address?: string;
  division_name?: string;
  district_name?: string;
  thana_name?: string;
  telephone?: ContactPhone;
  mobile?: ContactPhone;
  pabx?: ContactPhone;
  fax?: ContactPhone;
  sub_office_count: number;
  /** People posted directly in this office. */
  employee_count: number;
  /** People in this office and all its sub-offices. */
  employee_total: number;
  is_favorite: boolean;
  is_my_office: boolean;
}

export interface ContactOfficeDetail extends ContactOffice {
  description?: string;
  /** Ancestors from the top office down to the direct parent. */
  breadcrumb: Array<{ id: string; name: string; short_name?: string }>;
}

export interface ContactEmployee {
  id: string;
  name: string;
  name_bn?: string;
  initials: string;
  designation: { id: string; name: string; short_name: string; grade: number | null } | null;
  office: { id: string; name: string; short_name?: string; parent_path: string } | null;
  mobile?: ContactPhone;
  email?: string;
  phone_hidden: boolean;
  is_favorite: boolean;
  is_me: boolean;
}

export interface ContactTypeGroup {
  type: { id: string; name: string; short_name: string };
  office_count: number;
  offices: ContactOffice[];
}

export interface ContactOverview {
  access: ContactAccess;
  totals: { offices: number; employees: number; office_types: number };
  groups: ContactTypeGroup[];
}

export interface ContactDesignationCount {
  id: string;
  name: string;
  short_name: string;
  grade: number | null;
  count: number;
}

export const contactOfficeQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  type_id: mongoId.optional().or(z.literal('')),
  /** Direct sub-offices of this office. */
  parent_id: mongoId.optional().or(z.literal('')),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const contactEmployeeQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  office_id: mongoId.optional().or(z.literal('')),
  /** With office_id: also people in every sub-office below it. */
  include_sub: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  designation_id: mongoId.optional().or(z.literal('')),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const contactFavoriteSchema = z.object({
  target_type: z.enum(['office', 'user']),
  target_id: mongoId,
});

export interface ContactFavorites {
  offices: ContactOffice[];
  employees: ContactEmployee[];
}
