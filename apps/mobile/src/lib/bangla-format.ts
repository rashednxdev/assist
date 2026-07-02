const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'] as const;

export function toBanglaDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)] ?? d);
}

export function banglaText(value: string | number | undefined | null, fallback = ''): string {
  const raw = value !== undefined && value !== null && String(value).trim() !== '' ? String(value) : fallback;
  return toBanglaDigits(raw);
}

export function formatDurationBn(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) {
    return `${toBanglaDigits(h)} ঘণ্টা ${toBanglaDigits(m)} মিনিট`;
  }
  if (h > 0) return `${toBanglaDigits(h)} ঘণ্টা`;
  return `${toBanglaDigits(m)} মিনিট`;
}
