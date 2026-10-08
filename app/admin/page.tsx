import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import { db, type MeetingRequest } from '@/lib/db';
import { config } from '@/lib/config';
import { fmtWhen } from '@/lib/format';
import { decide, logout } from './actions';

export const dynamic = 'force-dynamic';

function Req({ r }: { r: MeetingRequest }) {
  const mgmtWhen = fmtWhen(r.start_at, config.tz);
  const theirWhen = r.visitor_tz && r.visitor_tz !== config.tz ? fmtWhen(r.start_at, r.visitor_tz) : null;
  return (
    <article className="req">
      <div className="row">
        <h3>{r.name}{r.company ? ` · ${r.company}` : ''}</h3>
        <span className={`pill ${r.status}`}>{r.status}</span>
      </div>
      <dl>
        <dt>When</dt><dd><b>{mgmtWhen}</b>{theirWhen ? <span className="muted"> · theirs: {theirWhen}</span> : null}</dd>
        <dt>Format</dt><dd>{r.format === 'zoom' ? 'Zoom' : 'Phone'} · {r.duration_min} min</dd>
        <dt>Email</dt><dd><a href={`mailto:${r.email}`}>{r.email}</a></dd>
        {r.phone && (<><dt>Phone</dt><dd>{r.phone}</dd></>)}
        {r.role && (<><dt>Title</dt><dd>{r.role}</dd></>)}
        {r.notes && (<><dt>Notes</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{r.notes}</dd></>)}
        {r.meeting_link && (<><dt>Link</dt><dd>{r.meeting_link}</dd></>)}
        {r.mgmt_note && (<><dt>Note</dt><dd>{r.mgmt_note}</dd></>)}
        <dt>Requested</dt><dd className="muted">{fmtWhen(r.created_at, config.tz)}</dd>
      </dl>
      {r.status === 'pending' && (
        <form action={decide} className="actions">
          <input type="hidden" name="id" value={r.id} />
          <div className="field">
            <label htmlFor={`link-${r.id}`}>{r.format === 'zoom' ? 'Zoom link' : 'Dial-in or who calls whom'}</label>
            <input id={`link-${r.id}`} name="meeting_link" placeholder={r.format === 'zoom' ? 'https://zoom.us/j/…' : `We will call ${r.phone ?? 'you'}`} />
          </div>
          <div className="field">
            <label htmlFor={`note-${r.id}`}>Note to the visitor (optional)</label>
            <input id={`note-${r.id}`} name="mgmt_note" />
          </div>
          <button className="btn primary" name="action" value="approve">Approve</button>
          <button className="btn danger" name="action" value="decline">Decline</button>
        </form>
      )}
      {r.status === 'approved' && (
        <form action={decide} className="actions">
          <input type="hidden" name="id" value={r.id} />
          <input type="hidden" name="meeting_link" value={r.meeting_link ?? ''} />
          <div className="field">
            <label htmlFor={`cnote-${r.id}`}>Reason, if cancelling (optional)</label>
            <input id={`cnote-${r.id}`} name="mgmt_note" />
          </div>
          <button className="btn danger" name="action" value="cancel">Cancel call</button>
        </form>
      )}
    </article>
  );
}

export default async function Admin() {
  if (!(await isAdmin())) redirect('/admin/login');
  const nowIso = new Date().toISOString();
  const [pending, upcoming, recent] = await Promise.all([
    db().from('meeting_requests').select('*').eq('status', 'pending').order('start_at').returns<MeetingRequest[]>(),
    db().from('meeting_requests').select('*').eq('status', 'approved').gte('start_at', nowIso).order('start_at').returns<MeetingRequest[]>(),
    db().from('meeting_requests').select('*').in('status', ['declined', 'cancelled']).order('decided_at', { ascending: false }).limit(10).returns<MeetingRequest[]>(),
  ]);

  return (
    <main className="wrap">
      <div className="bar">
        <a className="brand" href="/">AIUniverse.one · Management</a>
        <form action={logout}><button className="btn" type="submit">Sign out</button></form>
      </div>
      <section className="card">
        <div className="bar"><h2>Waiting for approval</h2><span className="pill pending">{pending.data?.length ?? 0}</span></div>
        <p className="muted small" style={{ margin: 0 }}>Times shown in {config.tz.replace(/_/g, ' ')}. A pending request holds its slot until you decline it.</p>
        <div className="reqs">
          {(pending.data ?? []).length === 0 && <p className="muted">No requests waiting.</p>}
          {(pending.data ?? []).map((r) => <Req key={r.id} r={r} />)}
        </div>
      </section>
      <section className="card">
        <div className="bar"><h2>Confirmed calls</h2><span className="pill approved">{upcoming.data?.length ?? 0}</span></div>
        <div className="reqs">
          {(upcoming.data ?? []).length === 0 && <p className="muted">No confirmed calls coming up.</p>}
          {(upcoming.data ?? []).map((r) => <Req key={r.id} r={r} />)}
        </div>
      </section>
      <section className="card">
        <h2>Recently declined or cancelled</h2>
        <div className="reqs">
          {(recent.data ?? []).length === 0 && <p className="muted">None.</p>}
          {(recent.data ?? []).map((r) => <Req key={r.id} r={r} />)}
        </div>
      </section>
    </main>
  );
}
