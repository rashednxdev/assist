import { NativeModules, Platform } from 'react-native';

type LiveAudioSessionNative = {
  start: () => void;
  stop: () => void;
};

const native = NativeModules.LiveAudioSession as LiveAudioSessionNative | undefined;

/** Android: route live class audio to loudspeaker and raise volume. No-op on iOS. */
export function startLiveAudioSession(): void {
  if (Platform.OS !== 'android') return;
  try {
    native?.start?.();
  } catch {
    // ignore — live class still works without native boost
  }
}

export function stopLiveAudioSession(): void {
  if (Platform.OS !== 'android') return;
  try {
    native?.stop?.();
  } catch {
    // ignore
  }
}
