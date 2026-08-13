import { z } from 'zod';

const mongoId = z.string().regex(/^[a-f\d]{24}$/i);

export const sendNotificationSchema = z
  .object({
    title: z.string().min(1).max(120),
    message: z.string().min(1).max(2000),
    target_type: z.enum(['all', 'specific']),
    target_user_ids: z.array(mongoId).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.target_type === 'specific' && (!data.target_user_ids || data.target_user_ids.length === 0)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Select at least one user',
        path: ['target_user_ids'],
      });
    }
  });

export const registerDeviceTokenSchema = z.object({
  device_id: z.string().min(8).max(128),
  expo_push_token: z.string().min(10),
});

export const listNotificationsQuerySchema = z.object({
  unread_only: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const listUsersForPickerQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type SendNotificationDto = z.infer<typeof sendNotificationSchema>;
export type RegisterDeviceTokenDto = z.infer<typeof registerDeviceTokenSchema>;
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
export type ListUsersForPickerQuery = z.infer<typeof listUsersForPickerQuerySchema>;

export type AdminNotificationStatus = 'sent' | 'stopped' | 'removed';

export interface AdminNotificationRecord {
  id: string;
  title: string;
  message: string;
  target_type: 'all' | 'specific';
  target_user_ids?: string[];
  recipient_count: number;
  push_sent_count: number;
  push_failed_count: number;
  created_by: string;
  sent_at: string;
  status: AdminNotificationStatus;
  remaining_unread_count: number;
  removed_unread_count: number;
  revoked_at?: string;
}

export interface NotificationRecipientRecord {
  id: string;
  notification_id: string;
  title: string;
  message: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}
