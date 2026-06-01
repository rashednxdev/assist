import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@ibas/shared-constants';

export const locales = SUPPORTED_LOCALES;
export type AppLocale = (typeof locales)[number];
export const defaultLocale = DEFAULT_LOCALE;
