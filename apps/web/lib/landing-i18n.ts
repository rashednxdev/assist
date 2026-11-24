import bnMessages from '../messages/bn.json';
import enMessages from '../messages/en.json';

export type LandingLocale = 'bn' | 'en';

export type LandingCopy = typeof enMessages.landing;

const STORAGE_KEY = 'proassist_landing_locale';

export function landingCopy(locale: LandingLocale): LandingCopy {
  return locale === 'en' ? enMessages.landing : bnMessages.landing;
}

export function readLandingLocale(): LandingLocale {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'bn') return saved;
  } catch {
    /* ignore */
  }
  return 'en';
}

export function writeLandingLocale(locale: LandingLocale): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}
