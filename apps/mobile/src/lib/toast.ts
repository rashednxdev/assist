import { Platform, ToastAndroid } from 'react-native';

/** Short toast — Android native; no-op elsewhere (release APK is Android). */
export function showToast(message: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  }
}

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

/** True when the device can reach the API host (any HTTP response counts as online). */
export async function isDeviceOnline(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    await fetch(`${API_URL}/papers/types`, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);
    return true;
  } catch {
    return false;
  }
}
