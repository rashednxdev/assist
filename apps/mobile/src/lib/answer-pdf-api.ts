import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';
import type { AnswerPdfPageSize } from '@ibas/shared-types';
import { ApiError } from '@/lib/api';
import { fetchQuestionDetail } from '@/lib/questions-api';
import { getCachedMcqDetail } from '@/lib/questions-db';
import type { QuestionDetail } from '@/types/questions';
import { buildAnswerPdfHtml, pdfPagePoints } from '@/lib/answer-pdf-html';

const MAX_QUESTIONS = 40;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const KALPURUSH_MODULE = require('../../assets/fonts/Kalpurush.ttf') as number;

let cachedFontBase64: string | null = null;

async function loadKalpurushBase64(): Promise<string> {
  if (cachedFontBase64) return cachedFontBase64;
  const asset = Asset.fromModule(KALPURUSH_MODULE);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) throw new ApiError('Could not load Kalpurush font');
  cachedFontBase64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return cachedFontBase64;
}

async function loadQuestionForPdf(id: string): Promise<QuestionDetail | null> {
  const cached = getCachedMcqDetail(id);
  if (cached) return cached;
  try {
    return await fetchQuestionDetail(id);
  } catch {
    return null;
  }
}

async function collectQuestions(ids: string[]): Promise<QuestionDetail[]> {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, MAX_QUESTIONS);
  if (unique.length === 0) throw new ApiError('No questions to export');
  const out: QuestionDetail[] = [];
  for (const id of unique) {
    const q = await loadQuestionForPdf(id);
    if (q) out.push(q);
  }
  if (out.length === 0) throw new ApiError('Could not load questions for PDF');
  return out;
}

/** Build answer PDF on-device (same layout as reading UI) and open the share sheet. */
export async function downloadAndShareAnswerPdf(params: {
  questionIds: string[];
  pageSize: AnswerPdfPageSize;
}): Promise<void> {
  const questions = await collectQuestions(params.questionIds);
  const fontBase64 = await loadKalpurushBase64();
  const html = buildAnswerPdfHtml({
    questions,
    pageSize: params.pageSize,
    fontBase64,
  });
  const { width, height } = pdfPagePoints(params.pageSize);

  const { uri } = await Print.printToFileAsync({
    html,
    width,
    height,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const sizeTag = params.pageSize === 'pocket' ? 'digest-5x8' : 'a4';
  const filename =
    questions.length === 1
      ? `answer-${questions[0]!.id.slice(-6)}-${sizeTag}.pdf`
      : `answers-${questions.length}q-${stamp}-${sizeTag}.pdf`;

  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!dir) throw new ApiError('Storage is not available on this device');
  const dest = `${dir}${filename.replace(/[^\w.\-]+/g, '_')}`;
  try {
    await FileSystem.copyAsync({ from: uri, to: dest });
  } catch {
    // Fall back to the temp print URI if rename/copy fails.
  }
  const shareUri = (await FileSystem.getInfoAsync(dest)).exists ? dest : uri;

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new ApiError(
      Platform.OS === 'web'
        ? 'Sharing is not available in this browser'
        : 'Sharing is not available on this device',
    );
  }
  await Sharing.shareAsync(shareUri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Save answer PDF',
    UTI: 'com.adobe.pdf',
  });
}
