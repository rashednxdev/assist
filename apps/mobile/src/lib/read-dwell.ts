export const READ_DWELL_SECONDS = 5;
export const READ_DWELL_MS = READ_DWELL_SECONDS * 1000;

type DwellState = { id: string; endsAt: number } | null;

let dwell: DwellState = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function startTicker() {
  if (tickTimer) return;
  tickTimer = setInterval(() => {
    if (!dwell) {
      stopTicker();
      return;
    }
    notify();
  }, 200);
}

function stopTicker() {
  if (!tickTimer) return;
  clearInterval(tickTimer);
  tickTimer = null;
}

export function subscribeReadDwell(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function startReadDwell(id: string) {
  dwell = { id, endsAt: Date.now() + READ_DWELL_MS };
  startTicker();
  notify();
}

export function stopReadDwell(id?: string) {
  if (!dwell) return;
  if (id && dwell.id !== id) return;
  dwell = null;
  stopTicker();
  notify();
}

/** Remaining whole seconds for this question, or null if it is not counting down. */
export function getReadDwellSecondsLeft(questionId?: string): number | null {
  if (!dwell || !questionId || dwell.id !== questionId) return null;
  return Math.max(0, Math.ceil((dwell.endsAt - Date.now()) / 1000));
}
