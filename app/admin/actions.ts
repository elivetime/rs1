'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { checkPassword, endSession, isAdmin, startSession } from '@/lib/auth';
import { db, type MeetingRequest } from '@/lib/db';
import { config } from '@/lib/config';
import { sendEmail } from '@/lib/email';
import { fmtWhen } from '@/lib/format';

export async function login(_prev: string | null, form: FormData): Promise<string | null> {
  const pw = String(form.get('password') ?? '');
  if (!checkPassword(pw)) {
    await new Promise((r) => setTimeout(r, 800));
    return 'That password is not right.';
  }
  await startSession();
  redirect('/admin');
}

export async function logout() {
  await endSession();
  redirect('/admin/login');
}

export async function decide(form: FormData) {
  if (!(await isAdmin())) redirect('/admin/login');
  const id = String(form.get('id') ?? '');
  const action = String(form.get('action') ?? '');
  const link = String(form.get('meeting_link') ?? '').trim().slice(0, 500);
  const note = String(form.get('mgmt_note') ?? '').trim().slice(0, 1000);
  const next = action === 'approve' ? 'approved' : action === 'decline' ? 'declined' : action === 'cancel' ? 'cancelled' : null;
  if (!id || !next) return;

  const allowedFrom = next === 'cancelled' ? ['approved', 'pending'] : ['pending'];
  const { data: r } = await db()
    .from('meeting_requests')
    .update({ status: next, meeting_link: link || null, mgmt_note: note || null, decided_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', allowedFrom)
    .select('*')
    .maybeSingle<MeetingRequest>();

  if (r) {
    const when = fmtWhen(r.start_at, r.visitor_tz || config.tz);
    const statusUrl = `${config.siteUrl}/r/${r.token}`;
    if (next === 'approved') {
      await sendEmail(r.email, `Confirmed: your call with AIUniverse.one, ${when}`, [
        `Hi ${r.name},`, '',
        `Your ${r.format === 'zoom' ? 'Zoom' : 'phone'} call with AIUniverse.one management is confirmed for ${when}.`,
        r.meeting_link ? `\n${/^https?:/i.test(r.meeting_link) ? 'Join' : 'Details'}: ${r.meeting_link}` : '',
        r.mgmt_note ? `\n${r.mgmt_note}` : '',
        `\nAdd it to your calendar: ${config.siteUrl}/api/ics/${r.token}`,
        `Details: ${statusUrl}`,
      ].filter(Boolean).join('\n'));
    } else {
      await sendEmail(r.email, next === 'declined' ? 'About your requested call with AIUniverse.one' : 'Your call with AIUniverse.one was cancelled', [
        `Hi ${r.name},`, '',
        next === 'declined'
          ? `Unfortunately management can't take a call at ${when}.`
          : `Your call scheduled for ${when} has been cancelled.`,
        r.mgmt_note ? `\n${r.mgmt_note}` : '',
        `\nPlease pick another time here: ${config.siteUrl}/`,
      ].filter(Boolean).join('\n'));
    }
  }
  revalidatePath('/admin');
}
