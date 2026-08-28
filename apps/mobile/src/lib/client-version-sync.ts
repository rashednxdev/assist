import * as SecureStore from 'expo-secure-store';
import { apiFetch } from './api';
import { APP_VERSION_LABEL } from './app-version';

const LAST_REPORTED_KEY = 'ibas_last_reported_client_version';

interface LastReported {
  userId: string;
  version: string;
}

async function readLastReported(): Promise<LastReported | null> {
  try {
    const raw = await SecureStore.getItemAsync(LAST_REPORTED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastReported;
    if (!parsed?.userId || !parsed?.version) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeLastReported(data: LastReported): Promise<void> {
  await SecureStore.setItemAsync(LAST_REPORTED_KEY, JSON.stringify(data));
}

async function postClientVersion(): Promise<void> {
  await apiFetch('/account/client-version', {
    method: 'POST',
    body: JSON.stringify({
      app_version: APP_VERSION_LABEL,
      client_platform: 'mobile',
    }),
  });
}

/** Report when the build or signed-in user changed (e.g. after an APK update). */
export async function syncClientVersionIfNeeded(userId: string): Promise<void> {
  const last = await readLastReported();
  if (last?.userId === userId && last.version === APP_VERSION_LABEL) return;

  try {
    await postClientVersion();
    await writeLastReported({ userId, version: APP_VERSION_LABEL });
  } catch {
    // Retry on next app open or foreground.
  }
}

export async function clearReportedClientVersion(): Promise<void> {
  await SecureStore.deleteItemAsync(LAST_REPORTED_KEY).catch(() => undefined);
}
