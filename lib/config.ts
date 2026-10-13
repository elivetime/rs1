/** Integer env var within [min, max]; anything else (blank, NaN, 0, negative, out of range) falls back to the default. */
function num(v: string | undefined, d: number, min: number, max: number) {
  const n = Number(v);
  return v !== '' && v !== undefined && Number.isInteger(n) && n >= min && n <= max ? n : d;
}

const dayStart = num(process.env.BOOKING_DAY_START, 10, 0, 23);
const dayEnd = num(process.env.BOOKING_DAY_END, 17, 1, 24);

export const config = {
  siteUrl: (process.env.SITE_URL || 'https://aiuniverse.rsvp').replace(/\/$/, ''),
  tz: process.env.BOOKING_TIMEZONE || 'America/New_York',
  dayStart: dayEnd > dayStart ? dayStart : 10,
  dayEnd: dayEnd > dayStart ? dayEnd : 17,
  slotMinutes: num(process.env.BOOKING_SLOT_MINUTES, 30, 5, 240),
  daysAhead: num(process.env.BOOKING_DAYS_AHEAD, 21, 1, 90),
  videoUrl: process.env.PITCH_VIDEO_URL || 'https://myspace.livevideo.com',
};
