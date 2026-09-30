import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { getOrCreateDeviceId } from './device-id';
import { registerDeviceToken, unregisterDeviceToken } from './notifications-api';

type NotificationsModule = typeof import('expo-notifications');

/** Expo Go (SDK 53+) throws as soon as expo-notifications is loaded on Android, so it must never be imported there. */
const pushSupported = Platform.OS === 'android' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

let notifications: Promise<NotificationsModule> | null = null;

function loadNotifications(): Promise<NotificationsModule> {
  notifications ??= import('expo-notifications').then((Notifications) => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    return Notifications;
  });
  return notifications;
}

/**
 * Requests permission and registers this device's Expo push token with the API.
 * No-ops quietly (rather than throwing) whenever push isn't actually available —
 * Expo Go, no EAS project configured, permission denied, or running somewhere push tokens
 * can't be issued (e.g. certain emulators) — none of those should block app usage.
 */
export async function registerForPushNotifications(): Promise<void> {
  if (!pushSupported) return;

  try {
    const Notifications = await loadNotifications();
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const deviceId = await getOrCreateDeviceId();
    await registerDeviceToken(deviceId, tokenResponse.data);
  } catch {
    // Best-effort — a missing push registration just means this device won't get pushes.
  }
}

export async function unregisterPushNotifications(): Promise<void> {
  try {
    const deviceId = await getOrCreateDeviceId();
    await unregisterDeviceToken(deviceId);
  } catch {
    // Best-effort on logout — a stale token is harmless (server deactivates on next send failure).
  }
}
