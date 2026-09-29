export const SUPPORT_WHATSAPP_DISPLAY = '01911 120 610';
export const SUPPORT_WHATSAPP_INTL = '8801911120610';

export function supportWhatsAppHref(text?: string): string {
  const q = text?.trim() ? `?text=${encodeURIComponent(text.trim())}` : '';
  return `https://wa.me/${SUPPORT_WHATSAPP_INTL}${q}`;
}

/** Convert BD local `01XXXXXXXXX` (or already-intl) to digits for wa.me / tel. */
export function normalizeBdPhone(phone: string): { local: string; intl: string } | null {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (/^01[3-9]\d{8}$/.test(digits)) {
    return { local: digits, intl: `88${digits}` };
  }
  if (/^8801[3-9]\d{8}$/.test(digits)) {
    return { local: digits.slice(2), intl: digits };
  }
  if (digits.length >= 8) {
    return { local: digits, intl: digits.startsWith('88') ? digits : `88${digits}` };
  }
  return null;
}

export function phoneTelHref(phone: string): string | null {
  const n = normalizeBdPhone(phone);
  return n ? `tel:${n.local}` : null;
}

export function phoneWhatsAppHref(phone: string, text?: string): string | null {
  const n = normalizeBdPhone(phone);
  if (!n) return null;
  const q = text?.trim() ? `?text=${encodeURIComponent(text.trim())}` : '';
  return `https://wa.me/${n.intl}${q}`;
}
