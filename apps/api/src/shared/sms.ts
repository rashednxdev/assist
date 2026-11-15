import { env } from '../config/env.js';
import { badRequest } from './errors/AppError.js';
import { logger } from './logger.js';

/** Shown on the texts that name a support number. */
export const PROASSIST_SUPPORT_PHONE = '01866738860';

/** Whole taka with grouping; keeps a fraction only when it is not .00. */
export function formatSmsTaka(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const [whole, fraction] = rounded.toFixed(2).split('.');
  const grouped = (whole ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction === '00' ? grouped : `${grouped}.${fraction}`;
}

/** 01XXXXXXXXX → 8801XXXXXXXXX, the form BulkSMS BD expects. */
export function toSmsPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('880')) return digits;
  if (digits.startsWith('0')) return `88${digits}`;
  return `880${digits}`;
}

/** This gateway reports success as response_code 202, or as status_code 200 with status "Success". */
function smsWasAccepted(httpStatus: number, raw: string): boolean {
  if (httpStatus < 200 || httpStatus >= 300) return false;
  if (raw.trim() === '') return true;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return /submitted successfully|\bsuccess\b/i.test(raw) && !/\berror\b|\bfail/i.test(raw);
  }
  const items = Array.isArray(parsed) ? parsed : [parsed];
  return items.some((item) => {
    if (!item || typeof item !== 'object') return false;
    const row = item as Record<string, unknown>;
    const responseCode = String(row.response_code ?? row.ResponseCode ?? '');
    const statusCode = String(row.status_code ?? row.statusCode ?? '');
    const status = String(row.status ?? '');
    const success = String(row.success_message ?? row.successMessage ?? '');
    const error = String(row.error_message ?? row.errorMessage ?? '').trim();
    if (error) return false;
    if (responseCode === '202') return true;
    if (statusCode === '200' || statusCode === '202') return true;
    if (/success/i.test(status) || /success/i.test(success)) return true;
    return false;
  });
}

/**
 * Sends one text SMS. The API key is read from the environment and is never logged.
 * BulkSMS BD reports success as response_code 202.
 */
export async function sendSms(phone: string, message: string): Promise<void> {
  if (!env.SMS_API_KEY) {
    throw badRequest('SMS is not configured. Try again later.');
  }

  const url = new URL(env.SMS_API_URL);
  url.searchParams.set('api_key', env.SMS_API_KEY);
  url.searchParams.set('type', 'text');
  url.searchParams.set('phone', toSmsPhone(phone));
  url.searchParams.set('senderid', env.SMS_SENDER_ID);
  url.searchParams.set('message', message);

  let res: Response;
  try {
    res = await Promise.race([
      fetch(url.toString(), { method: 'GET' }),
      new Promise<Response>((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), 15_000);
      }),
    ]);
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : 'fetch failed' }, 'SMS request failed');
    throw badRequest('Could not send the text message. Try again in a minute.');
  }

  const text = await res.text();
  if (!smsWasAccepted(res.status, text)) {
    logger.error({ status: res.status, body: text.slice(0, 180) }, 'SMS send rejected');
    throw badRequest('Could not send the text message. Try again in a minute.');
  }
}
