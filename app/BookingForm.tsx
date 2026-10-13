'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type SlotsResponse = { tz: string; slotMinutes: number; slots: string[]; error?: string };

export default function BookingForm() {
  const router = useRouter();
  const [data, setData] = useState<SlotsResponse | null>(null);
  const [loadError, setLoadError] = useState('');
  const [day, setDay] = useState('');
  const [slot, setSlot] = useState('');
  const [format, setFormat] = useState<'zoom' | 'phone'>('zoom');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);

  async function load() {
    setLoadError('');
    try {
      const res = await fetch('/api/slots', { cache: 'no-store' });
      const json: SlotsResponse | null = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error || 'Could not load open times. Please try again shortly.');
      setData(json);
    } catch (e) {
      setLoadError(e instanceof Error && !/json|fetch/i.test(e.message) ? e.message : 'Could not load open times. Please try again shortly.');
    }
  }
  useEffect(() => { load(); }, []);

  const dayKey = (iso: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));

  const byDay = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of data?.slots ?? []) {
      const k = dayKey(s);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(s);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, tz]);

  useEffect(() => {
    if (!day && byDay.size) setDay([...byDay.keys()][0]);
  }, [byDay, day]);

  const fmtTime = (iso: string) => new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  const fmtFull = (iso: string) =>
    new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(iso));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!slot) { setError('Please pick a time first.'); return; }
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: f.get('name'), email: f.get('email'), company: f.get('company'), role: f.get('role'),
          phone: f.get('phone'), notes: f.get('notes'), website: f.get('website'),
          format, startAt: slot, visitorTz: tz,
        }),
      });
      const json = await res.json().catch(() => ({ error: 'Something went wrong. Please try again.' }));
      if (!res.ok) {
        setError(json.error || 'Something went wrong. Please try again.');
        if (res.status === 409 || res.status === 400) { setSlot(''); load(); }
        setBusy(false);
        return;
      }
      router.push(`/r/${json.token}`);
    } catch {
      setError('We could not reach the server. Please try again.');
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={onSubmit} noValidate>
      <div className="bar">
        <h2>1. Pick a time</h2>
        <span className="muted small">Times in {tz.replace(/_/g, ' ')} · {data?.slotMinutes ?? 30} minutes</span>
      </div>

      {loadError && (
        <div className="alert err" role="alert">
          {loadError} <button type="button" className="btn" onClick={load} style={{ marginLeft: 8 }}>Try again</button>
        </div>
      )}
      {!data && !loadError && <p className="muted">Loading open times…</p>}
      {data && byDay.size === 0 && <p className="muted">No open times in the next few weeks. Please check back soon.</p>}

      {byDay.size > 0 && (
        <>
          <div className="days" role="group" aria-label="Day">
            {[...byDay.keys()].map((k) => {
              const d = new Date(byDay.get(k)![0]);
              return (
                <button type="button" key={k} className="chip" aria-pressed={day === k} onClick={() => { setDay(k); setSlot(''); }}>
                  <small>{new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(d)}</small>
                  {new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short', day: 'numeric' }).format(d)}
                </button>
              );
            })}
          </div>
          <div className="times" role="group" aria-label="Time">
            {(byDay.get(day) ?? []).map((s) => (
              <button type="button" key={s} className="chip" aria-pressed={slot === s} onClick={() => setSlot(s)}>{fmtTime(s)}</button>
            ))}
          </div>
        </>
      )}

      {slot && <div className="summary">Requested: <b>{fmtFull(slot)}</b></div>}

      <h2>2. Your details</h2>
      <div className="field">
        <span style={{ fontSize: 14, fontWeight: 600 }}>How should we meet?</span>
        <div className="seg" role="group" aria-label="Call format">
          <button type="button" className="chip" aria-pressed={format === 'zoom'} onClick={() => setFormat('zoom')}>Zoom</button>
          <button type="button" className="chip" aria-pressed={format === 'phone'} onClick={() => setFormat('phone')}>Phone call</button>
        </div>
      </div>
      <div className="grid2">
        <div className="field"><label htmlFor="name">Full name</label><input id="name" name="name" autoComplete="name" required maxLength={120} /></div>
        <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={200} /></div>
        <div className="field"><label htmlFor="company">Firm or company</label><input id="company" name="company" autoComplete="organization" maxLength={160} /></div>
        <div className="field"><label htmlFor="role">Title</label><input id="role" name="role" autoComplete="organization-title" maxLength={120} /></div>
        <div className="field">
          <label htmlFor="phone">Phone{format === 'phone' ? '' : ' (optional)'}</label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={40} required={format === 'phone'} />
        </div>
      </div>
      <div className="field"><label htmlFor="notes">Anything you would like us to cover? (optional)</label><textarea id="notes" name="notes" maxLength={2000} /></div>
      <div className="hp" aria-hidden="true"><label htmlFor="website">Website</label><input id="website" name="website" tabIndex={-1} autoComplete="off" /></div>

      {error && <div className="alert err" role="alert">{error}</div>}
      <div className="bar">
        <span className="muted small">Not confirmed until management approves. We will email you either way.</span>
        <button className="btn primary" type="submit" disabled={busy || !slot}>{busy ? 'Sending…' : 'Request this time'}</button>
      </div>
    </form>
  );
}
