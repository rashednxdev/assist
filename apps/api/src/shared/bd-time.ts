/**
 * Fixed Bangladesh Standard Time (UTC+6, no DST) "wall clock" helpers for publish-time gating
 * (Question of the Day, Exams of the Week). Deliberately NOT based on the server process's own
 * OS timezone — this app is deployed on cloud hosts (e.g. Render) that default to UTC, while
 * admins enter publish times from a browser in Bangladesh. Using the server's ambient local time
 * would silently shift every publish time by the difference between the two (up to 6 hours),
 * hiding content an admin already believed was live. Computing "now" in a hardcoded BDT offset
 * keeps the gating correct regardless of which timezone the server itself happens to run in.
 */

const BDT_OFFSET_MS = 6 * 60 * 60 * 1000;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function bdtShifted(base: Date = new Date()): Date {
  return new Date(base.getTime() + BDT_OFFSET_MS);
}

function dateToStr(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Today's calendar date in Bangladesh time, as YYYY-MM-DD. */
export function bdToday(): string {
  return dateToStr(bdtShifted());
}

/** The calendar date `days` before today, in Bangladesh time, as YYYY-MM-DD. */
export function bdCutoff(days: number): string {
  const d = bdtShifted();
  d.setUTCDate(d.getUTCDate() - days);
  return dateToStr(d);
}

/** Current time of day in Bangladesh time, as HH:mm. */
export function bdNowTime(): string {
  const d = bdtShifted();
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
