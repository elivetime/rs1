# aiuniverse.rsvp on Railway: cutover runbook

Moves the site from Vercel (team `aiu2`, projects `rs1-mdc2` and the duplicate `rs1`)
to Railway, and its database from the Vercel Marketplace Supabase project (billed
through Vercel) to a project in the owned Supabase org **elivetime's Org**
(`bdlxnoovhpchibehpvlh`). Cloudflare already serves the apex
(nameservers `alexandra.ns.cloudflare.com` / `josh.ns.cloudflare.com`), so the
traffic switch is a DNS edit on Cloudflare and nothing else.

Application behaviour does not change. The app is a single Next 15 server with one
table, `public.meeting_requests`, and no crons, queues, storage buckets or edge
functions.

## What is in this repo for Railway

| File | Purpose |
|---|---|
| `next.config.mjs` | `output: 'standalone'` so the build is a self-contained server. Security headers unchanged. |
| `Dockerfile` | Multi-stage `node:22-alpine` image: `npm ci`, `next build`, then only `.next/standalone`, `.next/static` and `public` in the runtime stage. Runs as a non-root user, `HOSTNAME=0.0.0.0`, listens on `PORT` (Railway injects it). |
| `railway.json` | Dockerfile builder, health check on `/`, restart on failure (10 retries), 1 replica. |
| `.env.example` | Every variable the code reads, with notes on which ones the Vercel Marketplace integration injects today. |
| `.dockerignore` | Keeps `node_modules`, `.next`, `.git`, `.env*` and docs out of the build context. |

## Prerequisites

- Railway account with the GitHub app installed for `elivetime/rs1`.
- Supabase dashboard access to both the marketplace project (open it from Vercel:
  project `rs1-mdc2` → Storage → the Supabase store → "Open in Supabase") and to
  elivetime's Org.
- `psql`, `pg_dump` and `pg_restore` from a Postgres 17 client (`brew install
  libpq` on macOS, then add it to `PATH`). The client major version must be at
  least the server's.
- Cloudflare DNS edit rights for `aiuniverse.rsvp`.
- Vercel dashboard access to read the current env values (or `vercel env pull
  .env.vercel --environment production` from a linked checkout; delete that file
  when done).

## 0. Record the current state (nothing changes yet)

1. In Vercel → `rs1-mdc2` → Settings → Environment Variables, copy the values of:
   `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `SITE_URL`, `BOOKING_TIMEZONE`,
   `BOOKING_DAY_START`, `BOOKING_DAY_END`, `BOOKING_SLOT_MINUTES`,
   `BOOKING_DAYS_AHEAD`, `PITCH_VIDEO_URL`. The integration-store values
   (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_URL_NON_POOLING`) are
   readable there too. `RESEND_API_KEY`, `FROM_EMAIL` and `NOTIFY_EMAIL` are not set
   on Vercel, so production sends no email today. Keep it that way unless you also
   verify the Resend domain.
2. In Cloudflare → DNS, note the current records for `aiuniverse.rsvp` and `www`.
   They point at Vercel today (typically `A @ 76.76.21.21` and
   `CNAME www cname.vercel-dns.com`). These are the rollback values.
3. Row count baseline on the marketplace database:

   ```bash
   psql "$OLD_DB_URL" -c "select status, count(*) from public.meeting_requests group by 1 order by 1;"
   ```

   `OLD_DB_URL` is the `POSTGRES_URL_NON_POOLING` value from Vercel (direct,
   non-pooled connection). If your network has no IPv6, use the project's
   **Session pooler** string from the Supabase dashboard (Connect → Session pooler,
   port 5432, user `postgres.<ref>`) instead.

## 1. Create the new Supabase project (owned org)

1. Supabase dashboard → elivetime's Org → New project. Name `aiuniverse-rsvp`,
   same region as the marketplace project (check its Settings → General), a
   generated database password you save in the password manager.
2. Wait until it is healthy, then collect from Settings → API:
   - Project URL → becomes `SUPABASE_URL`
   - `service_role` key → becomes `SUPABASE_SERVICE_ROLE_KEY`

   and from Connect → Direct/Session pooler the connection string → `NEW_DB_URL`.
3. Apply the schema from this repo, exactly as the README says:
   paste `supabase/migrations/20261007000000_meeting_requests.sql` into the SQL
   editor of the new project and run it. It creates `pgcrypto`, the table, both
   indexes, enables RLS and revokes `anon`/`authenticated`. Nothing else is needed.

## 2. Copy the data (dump and restore)

The schema already exists on the new project (step 1.3), so the dump is data-only.
That avoids `pg_dump` dragging in Supabase-managed schemas and extension ownership.

```bash
# dump only the rows of the one application table
pg_dump "$OLD_DB_URL" \
  --data-only --table=public.meeting_requests \
  --no-owner --no-privileges \
  --format=custom --file=meeting_requests.dump

# restore into the new project
pg_restore --dbname "$NEW_DB_URL" --data-only --no-owner --no-privileges meeting_requests.dump

# compare
psql "$OLD_DB_URL" -c "select count(*), max(created_at) from public.meeting_requests;"
psql "$NEW_DB_URL" -c "select count(*), max(created_at) from public.meeting_requests;"
```

The counts and `max(created_at)` must match. There are no sequences to reset (ids
are UUIDs, tokens are random hex).

You will run this copy twice: once now so Railway can be tested against real data,
and once more at the moment of cutover (step 5) to pick up any requests made in
between. The second run must start from an empty table:

```bash
psql "$NEW_DB_URL" -c "truncate public.meeting_requests;"
```

then repeat the restore and the comparison.

## 3. Create the Railway service

1. Railway → New Project → Deploy from GitHub repo → `elivetime/rs1`, branch
   `main`, root directory `/`. Railway finds the `Dockerfile` and `railway.json`
   automatically.
2. Before the first build finishes, open the service → Variables and add, as raw
   values (not references), using the values recorded in step 0 and the new
   Supabase values from step 1:

   | Variable | Value | Required |
   |---|---|---|
   | `SUPABASE_URL` | new project URL | yes |
   | `SUPABASE_SERVICE_ROLE_KEY` | new project service_role key | yes |
   | `ADMIN_PASSWORD` | same as Vercel | yes |
   | `ADMIN_SESSION_SECRET` | same as Vercel (32+ chars) | yes |
   | `SITE_URL` | `https://aiuniverse.rsvp` | yes |
   | `BOOKING_TIMEZONE` | `America/New_York` | optional, default identical |
   | `BOOKING_DAY_START` | `10` | optional, default identical |
   | `BOOKING_DAY_END` | `17` | optional, default identical |
   | `BOOKING_SLOT_MINUTES` | `30` | optional, default identical |
   | `BOOKING_DAYS_AHEAD` | `21` | optional, default identical |
   | `PITCH_VIDEO_URL` | `https://myspace.livevideo.com` | optional, default identical; read at build time |
   | `RESEND_API_KEY`, `FROM_EMAIL`, `NOTIFY_EMAIL` | leave unset unless Resend is verified | no |

   Do **not** set `PORT` or `HOSTNAME`; Railway and the Dockerfile handle them.
   Do not copy any of the `POSTGRES_*`, `NEXT_PUBLIC_*`, `SUPABASE_ANON_KEY`,
   `SUPABASE_JWT_SECRET`, `SUPABASE_SECRET_KEY` or `SUPABASE_PUBLISHABLE_KEY` keys
   that the Vercel integration injected: the code never reads them.
3. Trigger a redeploy so the build sees the variables. Wait for the deploy to show
   healthy (the health check hits `/`).
4. Settings → Networking → Generate Domain. Note the hostname, e.g.
   `rs1-production-xxxx.up.railway.app`. This is the origin Cloudflare will point
   at.
5. Settings → Networking → Custom Domain: add `aiuniverse.rsvp` and
   `www.aiuniverse.rsvp`. For each domain Railway shows a **CNAME and a TXT**
   record. Both are required: with only the CNAME in place the domain stays
   unverified and returns 404, even when the CNAME resolves. Note both records for
   step 5. Leave the Cloudflare side alone for now.

## 4. Verify on the Railway hostname before touching DNS

With `R=https://<railway-hostname>`:

```bash
curl -sI "$R/" | grep -iE "HTTP/|x-frame-options|x-content-type-options|referrer-policy"
curl -s "$R/api/slots" | head -c 300
curl -sI "$R/pitch" | grep -i "HTTP/"
curl -s "$R/pitch/img/streamerclips-feed.jpg" -o /dev/null -w "%{http_code} %{content_type}\n"
curl -sI "$R/admin" | grep -iE "HTTP/|location|x-robots-tag"
```

Expected: `200` with the three security headers on `/`; JSON with `tz`,
`slotMinutes` and a `slots` array; `200` on `/pitch`; `200 image/jpeg`; a `307` to
`/admin/login` carrying `X-Robots-Tag: noindex, nofollow`.

Then in a browser on the Railway hostname:

1. **Admin login**: `/admin/login`, sign in with `ADMIN_PASSWORD`. You should land
   on `/admin` and see the existing pending and confirmed requests copied in
   step 2. The cookie is `Secure`, so this only works over HTTPS, which Railway
   provides.
2. **Booking flow**: open `/`, pick a slot, submit a request with a test name. You
   are redirected to `/r/<token>` showing "Request received". Back in `/admin`
   the request appears under "Waiting for approval". Approve it with a dummy Zoom
   link; `/r/<token>` now shows "Your call is confirmed" and
   `/api/ics/<token>` downloads an `.ics`. Cancel it afterwards so the slot is
   released. These test rows live in the new database only; delete them in the
   Supabase table editor before the final data copy, or they will be wiped by the
   `truncate` in step 5 anyway.

## 5. Cutover

Pick a quiet moment; the write-sensitive window is the few minutes between the
final data copy and the DNS change.

1. Final data copy: `truncate` on the new project, then the dump/restore and
   count comparison from step 2.
2. Cloudflare → DNS for `aiuniverse.rsvp`:
   - Edit the apex record to `CNAME @ <railway-hostname>` (Cloudflare flattens
     CNAME at the apex). If the record was an `A` record, delete it and add the
     CNAME.
   - Edit `www` to `CNAME www <railway-hostname>`.
   - Add the **TXT** verification record Railway shows for each domain (section 3, item 5).
     Railway does not verify a domain from the CNAME alone.
   - Keep both **Proxied** (orange cloud).
   - SSL/TLS → Overview must be **Full**, not Full (strict). Railway's docs say
     Full (Strict) does not work as intended with its origin. Railway issues its
     own certificate for the custom domain once the CNAME and TXT records resolve.
3. Wait for Railway → Custom Domains to show both domains as verified with a
   certificate (usually a minute or two behind Cloudflare).
4. Re-run the step 4 `curl` checks against `https://aiuniverse.rsvp` and
   `https://www.aiuniverse.rsvp`. Confirm the `server` header is no longer
   `Vercel` and that `cf-cache-status` is present. Repeat the admin login and one
   booking round-trip on the live domain.
5. Straggler check: any booking made between the final copy and the DNS switch
   landed in the old database. Compare again:

   ```bash
   psql "$OLD_DB_URL" -c "select id, token, name, email, start_at, status from public.meeting_requests where created_at > now() - interval '1 hour' order by created_at;"
   ```

   Copy any such rows across with a one-off `pg_dump --data-only
   --table=public.meeting_requests` filtered by hand, or re-enter them from
   `/admin`. The unique index on `start_at` protects against double booking.

Cloudflare's "Cache Everything" style rules, if any are applied on this zone, keep
working unchanged; the origin hostname is the only thing that moved.

## 6. Rollback

Everything on Vercel stays in place until step 7, so rollback is one DNS edit:

1. Cloudflare → DNS: put the records from step 0.2 back (`A @ 76.76.21.21`,
   `CNAME www cname.vercel-dns.com`, or whatever you recorded). Proxied as before.
2. Vercel serves the site again within a minute. It still reads the marketplace
   database, which has every row up to the final copy plus any stragglers.
3. If bookings were made on Railway after the switch, copy those rows back the
   other way (same `pg_dump --data-only` command with the URLs swapped, after
   checking `created_at`), or re-enter them from `/admin`.

## 7. Decommission (only after 48 hours stable)

1. Vercel → `rs1-mdc2` → Storage: remove the Supabase integration store, then
   delete the marketplace Supabase project from the Supabase dashboard. This is
   what stops the Vercel billing for the database.
2. Delete the duplicate Vercel project `rs1` (it has no custom domain), then
   `rs1-mdc2`. Remove `aiuniverse.rsvp` and `www` from the project first so
   Vercel does not keep the domain claim.
3. Keep the `meeting_requests.dump` file for 30 days, then delete it; it contains
   visitor names, emails and phone numbers.

## Notes

- `/pitch` and `/pitch/img/*` are static routes, so `PITCH_VIDEO_URL` and
  `SITE_URL` are read during `next build`. The Dockerfile declares them as `ARG`s
  and Railway passes service variables to Docker builds as build args, so a
  changed value needs a redeploy, exactly as on Vercel. Their in-code defaults
  equal production today.
- `GET /api/slots` and `POST /api/requests` are `force-dynamic` and talk to
  Supabase per request; `/api/ics/<token>`, `/r/<token>` and `/admin` likewise.
  Nothing is cached at the origin.
- Vercel ran this on Node 24; the image uses Node 22 LTS, which Next 15.5 fully
  supports. `npm run typecheck && npm run build` behave the same.
- The repo carries no Vercel platform configuration file and no platform-level
  header rules; the security headers in `next.config.mjs` are emitted by Next
  itself, so they are identical on Railway.
