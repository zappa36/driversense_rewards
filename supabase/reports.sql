-- ============================================================
-- Challenge reports: voice evidence filed through Otto when someone
-- is physically at an investigation challenge's location.
-- A challenge's payout releases once REPORTS from 2 different devices
-- agree (consensus, so a single person can't cheat).
-- Run once in the Supabase SQL editor (paste + Run). Safe to re-run.
-- ============================================================

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  challenge_id text not null,       -- challenges.id this report solves
  device text not null,             -- per-device id (pilot has no accounts)
  transcript text not null,         -- what was actually said
  title text,                       -- structured summary from OpenAI
  category text,                    -- ACCESS / CLOSURE / HAZARD / ENTRANCE / HOURS / INFO
  lat double precision,
  lng double precision,
  accuracy double precision,
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

-- Reports are evidence: anyone can file and read them, nobody can
-- rewrite or remove them from the app (no update/delete policies).
drop policy if exists "anyone reads reports" on public.reports;
create policy "anyone reads reports" on public.reports
  for select to anon, authenticated using (true);

drop policy if exists "anyone adds reports" on public.reports;
create policy "anyone adds reports" on public.reports
  for insert to anon, authenticated with check (true);
