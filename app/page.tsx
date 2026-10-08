import BookingForm from './BookingForm';

export default function Home() {
  return (
    <main className="wrap">
      <div className="bar">
        <a className="brand" href="/">AIUniverse.one</a>
        <a className="btn" href="/pitch">See the pitch first</a>
      </div>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="eyebrow">Investor calls · $10M round</div>
        <h1>Book a call with AIUniverse.one management</h1>
        <p className="lede">
          Choose a time for a Zoom or phone call with the AIUniverse.one management team.
          Your time is held while management reviews it, and it is confirmed only once they approve.
        </p>
      </header>
      <ol className="steps">
        <li><span className="n">STEP 1</span><b>Request a time</b><span className="muted small">Pick an open slot below. Times show in your time zone.</span></li>
        <li><span className="n">STEP 2</span><b>Management reviews</b><span className="muted small">We hold the slot so no one else can take it.</span></li>
        <li><span className="n">STEP 3</span><b>Confirmed by email</b><span className="muted small">You get the Zoom link or call details and a calendar invite.</span></li>
      </ol>
      <BookingForm />
      <p className="foot">Confidential. Nothing on this site is an offer to sell securities.</p>
    </main>
  );
}
