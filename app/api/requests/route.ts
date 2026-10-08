import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isBookable } from '@/lib/slots';
import { config } from '@/lib/config';
import { sendEmail } from '@/lib/email';
import { fmtWhen } from '@/lib/format';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  // Honeypot: real visitors never fill this hidden field.
  if (clip(body.website, 200)) return NextResponse.json({ token: 'ok' });

  const name = clip(body.name, 120);
  const email = clip(body.email, 200).toLowerCase();
  const company = clip(body.company, 160);
  const role = clip(body.role, 120);
  const phone = clip(body.phone, 40);
  const notes = clip(body.notes, 2000);
  const visitorTz = clip(body.visitorTz, 64);
  const format = body.format === 'phone' ? 'phone' : 'zoom';
  const startAt = clip(body.startAt, 40);

  if (!name) return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  if (format === 'phone' && phone.replace(/\D/g, '').length < 7)
    return NextResponse.json({ error: 'Please enter a phone number we can call.' }, { status: 400 });
  if (!isBookable(startAt))
    return NextResponse.json({ error: 'That time is no longer available. Please pick another.' }, { status: 400 });

  const { data, error } = await db()
    .from('meeting_requests')
    .insert({
      name, email, company: company || null, role: role || null, phone: phone || null, notes: notes || null,
      visitor_tz: visitorTz || null, format, start_at: new Date(startAt).toISOString(), duration_min: config.slotMinutes,
    })
    .select('token, start_at')
    .single();

  if (error) {
    if (error.code === '23505')
      return NextResponse.json({ error: 'Someone just requested that time. Please pick another.' }, { status: 409 });
    return NextResponse.json({ error: 'We could not save your request. Please try again.' }, { status: 500 });
  }

  const statusUrl = `${config.siteUrl}/r/${data.token}`;
  const whenMgmt = fmtWhen(data.start_at, config.tz);
  const notify = process.env.NOTIFY_EMAIL;
  await Promise.all([
    notify
      ? sendEmail(
          notify,
          `New call request: ${name}${company ? ` (${company})` : ''} · ${whenMgmt}`,
          [
            `${name}${role ? `, ${role}` : ''}${company ? ` at ${company}` : ''} requested a ${format === 'zoom' ? 'Zoom' : 'phone'} call.`,
            `When: ${whenMgmt}`,
            `Email: ${email}`,
            phone ? `Phone: ${phone}` : '',
            notes ? `\nNotes:\n${notes}` : '',
            `\nApprove or decline: ${config.siteUrl}/admin`,
          ].filter(Boolean).join('\n'),
        )
      : Promise.resolve(false),
    sendEmail(
      email,
      'We received your request for a call with AIUniverse.one',
      [
        `Hi ${name},`,
        '',
        `Thanks for requesting a ${format === 'zoom' ? 'Zoom' : 'phone'} call with AIUniverse.one management for ${fmtWhen(data.start_at, visitorTz || config.tz)}.`,
        'This time is not confirmed yet. Management reviews each request and we will email you as soon as it is approved.',
        '',
        `Check the status any time: ${statusUrl}`,
      ].join('\n'),
    ),
  ]);

  return NextResponse.json({ token: data.token });
}
