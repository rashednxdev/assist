import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';
import { ApiError } from '@/lib/api';
import type { ReaderChapterFull } from '@/types/books';
import {
  bookPdfPagePoints,
  buildBookPdfHtml,
  type BookPdfOrientation,
} from '@/lib/book-pdf-html';

export type { BookPdfOrientation };

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

/** Build an A4 book PDF (portrait or landscape) and open the share sheet. */
export async function downloadAndShareBookPdf(params: {
  bookId: string;
  bookName: string;
  shortName?: string;
  edition?: string;
  language?: string;
  chapters: ReaderChapterFull[];
  orientation?: BookPdfOrientation;
}): Promise<void> {
  if (!params.chapters.length) {
    throw new ApiError('This book has no chapters to download yet.');
  }

  const orientation = params.orientation ?? 'portrait';
  const fontBase64 = await loadKalpurushBase64();
  const html = buildBookPdfHtml({
    bookName: params.bookName,
    shortName: params.shortName,
    edition: params.edition,
    language: params.language,
    chapters: params.chapters,
    fontBase64,
    orientation,
  });

  const page = bookPdfPagePoints(orientation);
  const { uri } = await Print.printToFileAsync({
    html,
    width: page.width,
    height: page.height,
  });

  const safe = params.bookName.replace(/[^\w.\-]+/g, '_').slice(0, 40) || params.bookId.slice(-6);
  const filename = `book-${safe}-${orientation}.pdf`;
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!dir) throw new ApiError('Storage is not available on this device');
  const dest = `${dir}${filename}`;
  try {
    await FileSystem.copyAsync({ from: uri, to: dest });
  } catch {
    /* use temp uri */
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
    dialogTitle: 'Save book PDF',
    UTI: 'com.adobe.pdf',
  });
}
