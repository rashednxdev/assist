import { Linking } from 'react-native';

/** Support WhatsApp for payment / access requests (display + wa.me). */
export const SUPPORT_WHATSAPP_DISPLAY = '01911 120 610';
export const SUPPORT_WHATSAPP_INTL = '8801911120610';

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

export function openPhoneDialer(phone: string): void {
  const normalized = normalizeBdPhone(phone);
  if (!normalized) return;
  void Linking.openURL(`tel:${normalized.local}`).catch(() => undefined);
}

export function openWhatsAppToNumber(phone: string, text?: string): void {
  const normalized = normalizeBdPhone(phone);
  if (!normalized) return;
  const q = text?.trim() ? `?text=${encodeURIComponent(text.trim())}` : '';
  void Linking.openURL(`https://wa.me/${normalized.intl}${q}`).catch(() => undefined);
}

export function openSupportWhatsApp(text: string): void {
  const q = `?text=${encodeURIComponent(text)}`;
  void Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP_INTL}${q}`).catch(() => undefined);
}
