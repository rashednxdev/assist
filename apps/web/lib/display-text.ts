import { displayText } from '@ibas/shared-types';

export { displayText };

export function userDisplayName(user: {
  full_name_en?: string;
  full_name_bn?: string;
  email?: string;
}): string {
  return displayText(user) || user.email || '';
}
