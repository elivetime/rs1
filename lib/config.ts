function num(v: string | undefined, d: number) {
  const n = Number(v);
  return Number.isFinite(n) && v !== '' && v !== undefined ? n : d;
}

export const config = {
  siteUrl: (process.env.SITE_URL || 'https://aiuniverse.rsvp').replace(/\/$/, ''),
  tz: process.env.BOOKING_TIMEZONE || 'America/New_York',
  dayStart: num(process.env.BOOKING_DAY_START, 10),
  dayEnd: num(process.env.BOOKING_DAY_END, 17),
  slotMinutes: num(process.env.BOOKING_SLOT_MINUTES, 30),
  daysAhead: num(process.env.BOOKING_DAYS_AHEAD, 21),
  videoUrl: process.env.PITCH_VIDEO_URL || 'https://myspace.livevideo.com',
};
