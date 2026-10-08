import { db, type MeetingRequest } from '@/lib/db';
import { buildIcs } from '@/lib/ics';
import { config } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{36}$/.test(token)) return new Response('Not found', { status: 404 });
  const { data } = await db().from('meeting_requests').select('*').eq('token', token).maybeSingle<MeetingRequest>();
  if (!data || data.status !== 'approved') return new Response('This call is not confirmed yet.', { status: 404 });
  return new Response(buildIcs(data, config.siteUrl), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="aiuniverse-call.ics"',
      'Cache-Control': 'no-store',
    },
  });
}
