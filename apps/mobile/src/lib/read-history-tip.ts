import * as SecureStore from 'expo-secure-store';

const KEY = 'read_history_local_tip_v1';

let seenMemory: boolean | null = null;

export async function hasSeenReadHistoryTip(): Promise<boolean> {
  if (seenMemory === true) return true;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    seenMemory = raw === '1';
    return seenMemory;
  } catch {
    return false;
  }
}

export async function markReadHistoryTipSeen(): Promise<void> {
  seenMemory = true;
  try {
    await SecureStore.setItemAsync(KEY, '1');
  } catch {
    // Keep in-memory so this session still does not re-show.
  }
}
