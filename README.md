# aiuniverse.rsvp

Investor meeting site for AIUniverse.one.

| Path | What it is |
|---|---|
| `/` | Booking page. A visitor picks an open weekday slot (shown in their own time zone), chooses Zoom or phone, and submits. The slot is held as **pending**. Nothing is confirmed until management approves. |
| `/r/<token>` | The visitor's status page: awaiting approval, confirmed (join link + calendar invite), declined, or cancelled. |
| `/admin` | Management review. Password sign-in, then approve (with Zoom link or call details), decline, or cancel. |
| `/pitch` | The click-through pitch ("How would you like me to present my company to you?"), five tracks, live product screenshots, and the founder video on "Why I am asking you". |
| `/api/ics/<token>` | Calendar invite, served only after approval. |

## How approval works

1. Visitor requests a time → row in `meeting_requests` with `status = 'pending'`. A unique index stops anyone else requesting the same slot while it is pending or approved.
2. Management is emailed (if `NOTIFY_EMAIL` + Resend are set) and reviews at `/admin`.
3. **Approve** → status `approved`, visitor is emailed the link and an `.ics` invite. **Decline** → slot is released and the visitor is asked to pick another time.

## Setup

1. **Database.** Run `supabase/migrations/20261007000000_meeting_requests.sql` in the Supabase SQL editor of the project you want to use. RLS is on with no policies; only the server (service role key) can read or write.
2. **Vercel project.** Import this repo, framework Next.js, root directory `/`. Add the env vars from `.env.example`:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` (32+ random characters)
   - `SITE_URL=https://aiuniverse.rsvp`
   - Optional email: `RESEND_API_KEY`, `FROM_EMAIL`, `NOTIFY_EMAIL` (verify the sending domain in Resend first)
   - Optional hours: `BOOKING_TIMEZONE`, `BOOKING_DAY_START`, `BOOKING_DAY_END`, `BOOKING_SLOT_MINUTES`, `BOOKING_DAYS_AHEAD`
   - `PITCH_VIDEO_URL`: a direct `.mp4`/`.webm` URL plays inline. Any other URL is embedded in an iframe with a "Watch on LiveVideo" fallback link, which only works if that site allows embedding.
3. **Domain.** Add `aiuniverse.rsvp` (and `www`) to the Vercel project and point DNS at Vercel.

## Develop

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev
npm run typecheck && npm run build
```

## Editing the pitch

The pitch is a standalone page in `lib/pitch/body.ts` (copy lives in the `tracks` array). Screenshots are in `lib/pitch/images/*.ts` as base64 and served from `/pitch/img/<name>.jpg`. Figures come from AIU Five-Year Forecast v3 (Oct 2, 2026), Base case.
