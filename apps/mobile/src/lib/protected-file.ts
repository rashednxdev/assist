import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { ApiError, getApiAccessToken } from '@/lib/api';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

/**
 * Downloads a file that needs the signed-in user's token (e.g. `/schedule/events/:id/attachments/:fileId`)
 * and opens the system sheet so the user can view it in a PDF app or save it.
 */
export async function openProtectedFile(path: string, filename: string, mimeType = 'application/pdf'): Promise<void> {
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!dir) throw new ApiError('Storage is not available on this device');
  const safe = filename.replace(/[^\w.\-]+/g, '_').slice(0, 80) || 'document.pdf';
  const dest = `${dir}${Date.now()}-${safe}`;
  const token = getApiAccessToken();
  const res = await FileSystem.downloadAsync(`${API_URL}${path}`, dest, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status < 200 || res.status >= 300) {
    await FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => undefined);
    throw new ApiError(res.status === 404 ? 'File not found' : `Could not open file (${res.status})`, res.status);
  }
  if (!(await Sharing.isAvailableAsync())) throw new ApiError('Opening files is not available on this device');
  await Sharing.shareAsync(res.uri, { mimeType, dialogTitle: filename, UTI: mimeType === 'application/pdf' ? 'com.adobe.pdf' : undefined });
}
