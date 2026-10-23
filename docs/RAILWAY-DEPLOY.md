# Railway deploy — aiuniverse.rsvp (`elivetime/rs1`)

Next.js **15** at the **repository root**. Production today is Vercel (`rs1-mdc2`; duplicate project `rs1` — delete duplicate after Nobel approves portfolio register §5.6).

## First-time Railway setup

1. Create a Railway project and a **web service** connected to `elivetime/rs1` (`main`).
2. **Root Directory:** `/` (repo root).
3. **Config-as-code:** `railway.toml` at repo root.
4. **Node:** 22 (Nixpacks detects from lockfile; local dev uses Node 22).
5. Copy env vars from Vercel **Production** (see `.env.example`). Minimum:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`
   - `SITE_URL` (use Railway hostname until cutover, then `https://aiuniverse.rsvp`)

### Marketplace Supabase blocker (Phase I)

This app currently uses **Vercel Marketplace Supabase** (billing tied to Vercel). Leaving Vercel requires **dump/restore** into a Supabase project in the owned org, then pointing `SUPABASE_*` at the new project. Until that migration completes, Railway can run against the existing endpoint only if those credentials are copied manually — agents cannot export the marketplace DB without Nobel credentials. See portfolio register `vercel-to-railway-register.md` § aiuniverse.rsvp.

## Staging URL (committed)

After the first successful deploy:

```bash
set -a && source scripts/railway-staging-url.env && set +a
curl -sS -o /dev/null -w "%{http_code}\n" "$STAGING_URL/"
```

Replace the placeholder in `scripts/railway-staging-url.env` with the service’s `*.up.railway.app` hostname from Railway → **Networking**.

Optional: set GitHub secret `STAGING_URL` to the same value so CI smokes do not depend on a merged URL commit.

## GitHub Actions

Workflow: [`.github/workflows/railway-deploy.yml`](../.github/workflows/railway-deploy.yml)

| Secret | Purpose |
| --- | --- |
| `RAILWAY_TOKEN` | Project deploy token |
| `RAILWAY_PROJECT_ID` | Railway project UUID |
| `RAILWAY_SERVICE_ID` | Next.js web service UUID |
| `VERCEL_TOKEN` | Optional — one-time bootstrap of Railway variables from Vercel production |
| `VERCEL_PROJECT_ID` | Vercel project id for production (`rs1-mdc2`) |
| `VERCEL_PROJECT_NAME` | Optional; defaults to `rs1-mdc2` for `vercel link` |
| `VERCEL_ORG_ID` | Optional; defaults to `team_JkGZoOPYOANaDwHjcm97F8R1` |
| `DEPLOY_BASE_URL` | After Cloudflare cutover: `https://aiuniverse.rsvp` |
| `STAGING_URL` | Optional override for post-deploy HTTP probe |

Each run: `npm ci` → typecheck → build → `railway up` → wait → HTTP 200 on `/`.
For the one-time env bootstrap, manually run the workflow with **Bootstrap Railway env from Vercel production** enabled. Do not enable it for routine deployments: it overwrites matching Railway variables with Vercel values.
The bootstrap skips `SITE_URL` and all `SUPABASE_*` variables so Railway's staging URL and database configuration remain authoritative.

## Crons

There is **no** `vercel.json` and **no** `/api/cron/*` routes in this repo. Do **not** add dense Railway or GHA cron schedules. If you add background jobs later, use the StreamerClips pattern (`cron-manifest.yaml` + GHA HTTP scheduler), not Vercel cron headers.

## DNS cutover (Nobel)

Zone **aiuniverse.rsvp** is already on **Cloudflare**. Change **origin** to the Railway hostname (or custom domain in Railway); do **not** delegate nameservers to Railway ([portfolio nobel-dns doc](https://github.com/elivetime/ai-stream-clips/blob/main/docs/RAILWAY-STAGING.md) pattern applies).

## Local gates

```bash
npm ci
npm run typecheck
npm run build
```
