import { getAccessToken } from './auth';
import { parseJsonResponse } from './parse-json-response';

/**
 * Opens a file that needs the bearer token (a plain link cannot send it). The tab is opened
 * synchronously so popup blockers allow it, then pointed at the downloaded blob.
 */
export async function openProtectedFile(apiPath: string): Promise<void> {
  const tab = window.open('', '_blank');
  try {
    const token = getAccessToken();
    const res = await fetch(`/api/proxy/v1${apiPath}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });
    if (!res.ok) {
      const json = await parseJsonResponse<{ error?: { message?: string } }>(res).catch(() => ({}) as { error?: { message?: string } });
      throw new Error(json.error?.message ?? 'Could not open the file');
    }
    const url = URL.createObjectURL(await res.blob());
    if (tab) tab.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    tab?.close();
    throw err;
  }
}
