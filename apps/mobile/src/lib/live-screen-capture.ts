import { Platform } from 'react-native';

const LIVE_CAPTURE_KEY = 'live-guest';

let captureBlocked = false;

/** Admins may record or screenshot during live class review. */
export function canBypassLiveCaptureBlock(user: {
  is_super_admin?: boolean;
  user_type?: string;
} | null | undefined): boolean {
  if (!user) return false;
  return Boolean(
    user.is_super_admin || user.user_type === 'system_admin' || user.user_type === 'admin',
  );
}

/** Blocks screenshots / screen recording (Android FLAG_SECURE; iOS ScreenCapture API). */
export async function setLiveGuestCaptureBlocked(block: boolean): Promise<void> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
  if (block && captureBlocked) return;
  if (!block && !captureBlocked) return;
  try {
    const ScreenCapture = await import('expo-screen-capture');
    if (block) {
      await ScreenCapture.preventScreenCaptureAsync(LIVE_CAPTURE_KEY);
      captureBlocked = true;
    } else {
      await ScreenCapture.allowScreenCaptureAsync(LIVE_CAPTURE_KEY);
      captureBlocked = false;
    }
  } catch {
    captureBlocked = false;
  }
}
