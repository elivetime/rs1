import { notFound } from 'next/navigation';
import { db, type MeetingRequest } from '@/lib/db';
import { config } from '@/lib/config';
import { fmtWhen } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Status({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{36}$/.test(token)) notFound();
  const { data: r } = await db().from('meeting_requests').select('*').eq('token', token).maybeSingle<MeetingRequest>();
  if (!r) notFound();
  const tz = r.visitor_tz || config.tz;
  const when = fmtWhen(r.start_at, tz);

  return (
    <main className="wrap" style={{ maxWidth: 720 }}>
      <div className="bar"><a className="brand" href="/">AIUniverse.one</a><a className="btn" href="/pitch">Read the pitch</a></div>
      <section className="card">
        <span className={`pill ${r.status}`}>
          {r.status === 'pending' ? 'Awaiting approval' : r.status === 'approved' ? 'Confirmed' : r.status === 'declined' ? 'Not available' : 'Cancelled'}
        </span>
        {r.status === 'pending' && (
          <>
            <h1>Request received</h1>
            <p className="lede">
              Thank you, {r.name}. We are holding <b>{when}</b> for a {r.format === 'zoom' ? 'Zoom' : 'phone'} call.
              It is not confirmed yet. Management reviews each request, and we will email {r.email} as soon as it is approved.
            </p>
            <p className="muted small">Bookmark this page to check the status.</p>
          </>
        )}
        {r.status === 'approved' && (
          <>
            <h1>Your call is confirmed</h1>
            <p className="lede">{when} · {r.duration_min} minutes · {r.format === 'zoom' ? 'Zoom' : 'Phone call'}</p>
            {r.meeting_link && (
              /^https?:\/\//i.test(r.meeting_link)
                ? <p><a className="btn primary" href={r.meeting_link} target="_blank" rel="noopener noreferrer">Join the call</a></p>
                : <p className="summary">{r.meeting_link}</p>
            )}
            {!r.meeting_link && r.format === 'phone' && <p className="summary">We will call you at {r.phone}.</p>}
            {r.mgmt_note && <p className="summary">{r.mgmt_note}</p>}
            <p><a className="btn" href={`/api/ics/${r.token}`}>Add to calendar</a></p>
          </>
        )}
        {r.status === 'declined' && (
          <>
            <h1>That time doesn’t work</h1>
            <p className="lede">Management could not take a call at {when}.{r.mgmt_note ? ` ${r.mgmt_note}` : ''}</p>
            <p><a className="btn primary" href="/">Pick another time</a></p>
          </>
        )}
        {r.status === 'cancelled' && (
          <>
            <h1>This call was cancelled</h1>
            <p className="lede">{r.mgmt_note || 'Please pick a new time if you would still like to talk.'}</p>
            <p><a className="btn primary" href="/">Pick another time</a></p>
          </>
        )}
      </section>
    </main>
  );
}
