const KEY = 'proassist.live.device';

/** Stable id for this browser. Each user may join a class from one device only (web or mobile). */
export function liveDeviceId(): string {
  if (typeof window === 'undefined') return 'web';
  const existing = window.localStorage.getItem(KEY);
  if (existing && existing.length >= 8) return existing;
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `web-${Date.now()}`;
  window.localStorage.setItem(KEY, id);
  return id;
}
