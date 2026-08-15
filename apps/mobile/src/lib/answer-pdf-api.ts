import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { AnswerPdfPageSize } from '@ibas/shared-types';
import { ApiError, getApiAccessToken } from '@/lib/api';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
const API_TIMEOUT_MS = Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS ?? 90_000);

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return globalThis.btoa(binary);
}

function parseFilename(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ''));
    } catch {
      /* fall through */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() || fallback;
}

async function postAnswerPdf(body: {
  question_ids: string[];
  page_size: AnswerPdfPageSize;
}): Promise<{ uri: string; filename: string }> {
  const token = getApiAccessToken();
  if (!token) throw new ApiError('Sign in required');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}/questions/answer-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new ApiError(json.error?.message ?? `Download failed (${res.status})`, res.status);
    }

    const filename = parseFilename(
      res.headers.get('Content-Disposition'),
      `answers-${body.page_size}.pdf`,
    );
    const buf = await res.arrayBuffer();
    const base64 = arrayBufferToBase64(buf);
    const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!dir) throw new ApiError('Storage is not available on this device');
    const safeName = filename.replace(/[^\w.\-]+/g, '_');
    const uri = `${dir}${safeName}`;
    await FileSystem.writeAsStringAsync(uri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return { uri, filename: safeName };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError('Request timed out. Please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Download answers PDF and open the system share sheet. */
export async function downloadAndShareAnswerPdf(params: {
  questionIds: string[];
  pageSize: AnswerPdfPageSize;
}): Promise<void> {
  const ids = [...new Set(params.questionIds.filter(Boolean))];
  if (ids.length === 0) throw new ApiError('No questions to export');

  const { uri } = await postAnswerPdf({
    question_ids: ids.slice(0, 40),
    page_size: params.pageSize,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new ApiError(
      Platform.OS === 'web'
        ? 'Sharing is not available in this browser'
        : 'Sharing is not available on this device',
    );
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Save answer PDF',
    UTI: 'com.adobe.pdf',
  });
}
