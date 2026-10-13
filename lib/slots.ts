import { config } from './config';

/** Offset in minutes between UTC and `tz` at the given instant (positive east of UTC). */
function tzOffsetMinutes(instant: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/** Wall-clock time in `tz` → UTC Date. */
export function zonedToUtc(y: number, m: number, d: number, h: number, min: number, tz: string): Date {
  const guess = new Date(Date.UTC(y, m - 1, d, h, min));
  const off1 = tzOffsetMinutes(guess, tz);
  const first = new Date(guess.getTime() - off1 * 60000);
  const off2 = tzOffsetMinutes(first, tz);
  return off1 === off2 ? first : new Date(guess.getTime() - off2 * 60000);
}

function zonedYmd(instant: Date, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { y: Number(get('year')), m: Number(get('month')), d: Number(get('day')), wd: get('weekday') };
}

/** All bookable slot start times (ISO, UTC), weekdays only, starting tomorrow in the booking timezone. */
export function allSlots(now = new Date()): string[] {
  const { tz, dayStart, dayEnd, slotMinutes, daysAhead } = config;
  const out: string[] = [];
  const today = zonedYmd(now, tz);
  for (let i = 1; i <= daysAhead; i++) {
    const noon = zonedToUtc(today.y, today.m, today.d, 12, 0, tz);
    const day = zonedYmd(new Date(noon.getTime() + i * 86400000), tz);
    if (day.wd === 'Sat' || day.wd === 'Sun') continue;
    for (let mins = dayStart * 60; mins + slotMinutes <= dayEnd * 60; mins += slotMinutes) {
      out.push(zonedToUtc(day.y, day.m, day.d, Math.floor(mins / 60), mins % 60, tz).toISOString());
    }
  }
  return out;
}

export function isBookable(iso: string, now = new Date()): boolean {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return allSlots(now).some((s) => new Date(s).getTime() === t);
}
