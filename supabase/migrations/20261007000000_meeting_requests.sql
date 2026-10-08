-- Meeting requests for aiuniverse.rsvp.
-- Visitors request a time; nothing is confirmed until management approves it.
-- All access goes through the Next.js server with the service role key, so RLS is
-- enabled with no policies: anon/authenticated clients can read or write nothing.

create extension if not exists pgcrypto;

create table if not exists public.meeting_requests (
  id            uuid primary key default gen_random_uuid(),
  token         text not null unique default encode(gen_random_bytes(18), 'hex'),
  name          text not null check (char_length(name) between 1 and 120),
  email         text not null check (char_length(email) between 3 and 200),
  company       text check (char_length(company) <= 160),
  role          text check (char_length(role) <= 120),
  phone         text check (char_length(phone) <= 40),
  format        text not null check (format in ('zoom', 'phone')),
  start_at      timestamptz not null,
  duration_min  int not null default 30 check (duration_min between 15 and 120),
  visitor_tz    text check (char_length(visitor_tz) <= 64),
  notes         text check (char_length(notes) <= 2000),
  status        text not null default 'pending'
                check (status in ('pending', 'approved', 'declined', 'cancelled')),
  meeting_link  text check (char_length(meeting_link) <= 500),
  mgmt_note     text check (char_length(mgmt_note) <= 1000),
  created_at    timestamptz not null default now(),
  decided_at    timestamptz
);

-- One live request per slot: a pending request holds the slot until it is declined.
create unique index if not exists meeting_requests_one_live_per_slot
  on public.meeting_requests (start_at)
  where status in ('pending', 'approved');

create index if not exists meeting_requests_status_start
  on public.meeting_requests (status, start_at);

alter table public.meeting_requests enable row level security;
revoke all on public.meeting_requests from anon, authenticated;
