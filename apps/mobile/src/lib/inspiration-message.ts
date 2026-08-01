const MESSAGES = [
  '✨ Keep going!',
  '✨ You can do it!',
  '✨ Stay focused!',
  '✨ One step closer!',
  '✨ Believe in yourself!',
  '✨ Small steps count!',
  '✨ Practice pays off!',
  "✨ You've got this!",
];

function isWithinInspirationWindow(now: Date): boolean {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const morning = minutes >= 8 * 60 && minutes < 11 * 60; // 8:00 AM – 11:00 AM
  const evening = minutes >= 21 * 60 && minutes <= 23 * 60 + 59; // 9:00 PM – 11:59 PM
  return morning || evening;
}

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000);
}

/**
 * A short inspirational message for a home-screen module tile, shown only during two daily
 * windows (8–11 AM and 9–11:59 PM). Rotates once per day, varied per tile via `seed` so two
 * tiles showing a badge on the same day don't show the exact same line.
 */
export function getInspirationMessage(seed: string): string | undefined {
  const now = new Date();
  if (!isWithinInspirationWindow(now)) return undefined;
  const index = (dayOfYear(now) + seed.length) % MESSAGES.length;
  return MESSAGES[index];
}
