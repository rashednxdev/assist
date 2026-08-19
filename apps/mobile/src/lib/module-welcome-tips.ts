import * as SecureStore from 'expo-secure-store';

const KEY = 'module_welcome_tips_pending_v1';

let pendingMemory: boolean | null = null;

export async function markModuleWelcomeTipsPending(): Promise<void> {
  pendingMemory = true;
  try {
    await SecureStore.setItemAsync(KEY, '1');
  } catch {
    // In-memory is enough for this session.
  }
}

export async function isModuleWelcomeTipsPending(): Promise<boolean> {
  if (pendingMemory === true) return true;
  if (pendingMemory === false) return false;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    pendingMemory = raw === '1';
    return pendingMemory;
  } catch {
    return false;
  }
}

export async function clearModuleWelcomeTipsPending(): Promise<void> {
  pendingMemory = false;
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Keep in-memory cleared.
  }
}
