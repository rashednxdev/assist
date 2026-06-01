import { z } from 'zod';

export const upsertModuleAccessSchema = z.object({
  module_id: z.string().min(1),
  can_read: z.boolean().default(true),
  can_create: z.boolean().default(false),
  can_update: z.boolean().default(false),
  can_delete: z.boolean().default(false),
  can_grade: z.boolean().default(false),
  can_publish: z.boolean().default(false),
  task_restrictions: z.array(z.string()).optional(),
  expires_at: z.coerce.date().optional(),
});

export type UpsertModuleAccessDto = z.infer<typeof upsertModuleAccessSchema>;

export const createDivisionSchema = z.object({
  name_en: z.string().min(1),
  name_bn: z.string().optional(),
  short_code: z.string().min(1),
});

export const createDistrictSchema = createDivisionSchema.extend({
  division_id: z.string().min(1),
});

export const createThanaSchema = createDivisionSchema.extend({
  district_id: z.string().min(1),
});

export const updateGeoSchema = createDivisionSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const createUserAddressSchema = z.object({
  address_type: z.enum(['permanent', 'present', 'office']),
  division_id: z.string().min(1),
  district_id: z.string().min(1),
  thana_id: z.string().min(1),
  village_or_area: z.string().optional(),
  post_code: z.string().optional(),
  full_address: z.string().optional(),
  is_primary: z.boolean().default(false),
});

export type CreateUserAddressDto = z.infer<typeof createUserAddressSchema>;
