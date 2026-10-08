import { NextResponse } from 'next/server';
import { allSlots } from '@/lib/slots';
import { config } from '@/lib/config';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const slots = allSlots();
  if (slots.length === 0) return NextResponse.json({ tz: config.tz, slotMinutes: config.slotMinutes, slots: [] });
  const { data, error } = await db()
    .from('meeting_requests')
    .select('start_at')
    .in('status', ['pending', 'approved'])
    .gte('start_at', slots[0])
    .lte('start_at', slots[slots.length - 1]);
  if (error) return NextResponse.json({ error: 'Could not load availability. Please try again shortly.' }, { status: 503 });
  const taken = new Set((data ?? []).map((r) => new Date(r.start_at).getTime()));
  return NextResponse.json(
    { tz: config.tz, slotMinutes: config.slotMinutes, slots: slots.filter((s) => !taken.has(new Date(s).getTime())) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
