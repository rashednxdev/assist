import type { SalaryLocale } from '@/lib/salary-i18n';

const KEY = 'salary-locale';

export function readSalaryLocale(): SalaryLocale {
  if (typeof window === 'undefined') return 'bn';
  return sessionStorage.getItem(KEY) === 'en' ? 'en' : 'bn';
}

export function writeSalaryLocale(locale: SalaryLocale): void {
  sessionStorage.setItem(KEY, locale);
}
