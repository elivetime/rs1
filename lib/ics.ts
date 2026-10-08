import type { MeetingRequest } from './db';

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const escapeIcs = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => '\\' + c);

export function buildIcs(r: MeetingRequest, siteUrl: string): string {
  const start = new Date(r.start_at);
  const end = new Date(start.getTime() + r.duration_min * 60000);
  const where = r.format === 'zoom' ? r.meeting_link || 'Zoom (link to follow)' : r.meeting_link || `Phone: ${r.phone ?? ''}`;
  const desc = [`Call with AIUniverse.one management.`, r.meeting_link ? `Join: ${r.meeting_link}` : '', `Details: ${siteUrl}/r/${r.token}`]
    .filter(Boolean).join('\n');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AIUniverse.one//RSVP//EN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${r.id}@aiuniverse.rsvp`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escapeIcs('AIUniverse.one × ' + r.name)}`,
    `LOCATION:${escapeIcs(where)}`,
    `DESCRIPTION:${escapeIcs(desc)}`,
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
}
