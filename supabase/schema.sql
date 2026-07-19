-- ============================================================
-- Driver Rewards — Supabase schema, security rules, and seed.
-- Run this once in the Supabase SQL editor (paste + Run).
-- Safe to re-run: creates are idempotent, seed skips existing rows.
-- ============================================================

-- ---------- tables ----------

create table if not exists public.challenges (
  id text primary key,
  title text not null default '',
  descr text not null default '',            -- "desc" is reserved in SQL
  zone text not null default 'Prenzlauer Berg',
  tier text not null default 'EASY' check (tier in ('EASY','MEDIUM','EPIC')),
  unit text not null default 'STOPS',
  goal int not null default 5 check (goal >= 1),
  days int not null default 3 check (days >= 1),
  value numeric not null default 4 check (value >= 0),
  xp int not null default 100 check (xp >= 0),
  boost boolean not null default false,
  status text not null default 'DRAFT' check (status in ('DRAFT','SCHEDULED','LIVE')),
  addr text,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.settings (
  id int primary key check (id = 1),         -- single row
  mode text not null default 'euro' check (mode in ('euro','points')),
  weekend_on boolean not null default true,
  weekend_mult numeric not null default 1.5,
  s3 numeric not null default 2.2,
  s7 numeric not null default 3.5,
  s14 numeric not null default 5,
  cash_min numeric not null default 25,
  daily_cap numeric not null default 15,
  auto_conf int not null default 90,
  photo_tier text not null default 'EPIC' check (photo_tier in ('NONE','EPIC','MEDIUM','ALL')),
  budget numeric not null default 1800,
  spent numeric not null default 642,
  updated_at timestamptz not null default now()
);

-- keep updated_at fresh
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists challenges_touch on public.challenges;
create trigger challenges_touch before update on public.challenges
  for each row execute function public.touch_updated_at();

drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- ---------- row level security ----------
-- Drivers (anon key, no login): read LIVE challenges + settings only.
-- Planners (logged-in users): read and write everything.

alter table public.challenges enable row level security;
alter table public.settings enable row level security;

drop policy if exists "anon reads live challenges" on public.challenges;
create policy "anon reads live challenges" on public.challenges
  for select to anon using (status = 'LIVE');

drop policy if exists "planners read all challenges" on public.challenges;
create policy "planners read all challenges" on public.challenges
  for select to authenticated using (true);

drop policy if exists "planners insert challenges" on public.challenges;
create policy "planners insert challenges" on public.challenges
  for insert to authenticated with check (true);

drop policy if exists "planners update challenges" on public.challenges;
create policy "planners update challenges" on public.challenges
  for update to authenticated using (true) with check (true);

drop policy if exists "planners delete challenges" on public.challenges;
create policy "planners delete challenges" on public.challenges
  for delete to authenticated using (true);

drop policy if exists "everyone reads settings" on public.settings;
create policy "everyone reads settings" on public.settings
  for select to anon, authenticated using (true);

drop policy if exists "planners update settings" on public.settings;
create policy "planners update settings" on public.settings
  for update to authenticated using (true) with check (true);

-- ---------- seed ----------

insert into public.settings (id) values (1)
on conflict (id) do nothing;

insert into public.challenges (id, title, descr, zone, tier, unit, goal, days, value, xp, boost, status, addr, lat, lng) values
  ('c1', 'Mystery Stop Hunter', 'Refresh field notes at five unverified stops on tomorrow''s route.', 'Prenzlauer Berg', 'MEDIUM', 'STOPS', 5, 3, 8.5, 180, true, 'LIVE', 'Rykestraße 21', 52.53688, 13.420892),
  ('c2', 'Access Code Collector', 'Confirm door codes at eight buildings around Rosenthaler Platz.', 'Mitte', 'MEDIUM', 'CODES', 8, 5, 5.2, 120, true, 'LIVE', 'Rosenthaler Str. 40', 52.524001, 13.402501),
  ('c3', 'New Zone Scout', 'First rides in Weißensee — map access where the system is blind.', 'Weißensee', 'EPIC', 'RIDES', 6, 6, 12, 240, true, 'LIVE', 'Berliner Allee 250', 52.559737, 13.46724),
  ('c4', 'Voice Note Sprint', 'Speak ten hands-free approach notes for the next driver.', 'Your route', 'EASY', 'NOTES', 10, 2, 3.8, 90, false, 'LIVE', 'Route DE-1184', 52.550859, 13.413536),
  ('c5', 'Safe Drop Scout', 'Photograph agreed safe-drop points at six stops missing one.', 'Pankow', 'EASY', 'PHOTOS', 6, 4, 4.6, 110, false, 'SCHEDULED', 'Breite Str. 5', 52.571484, 13.410986),
  ('c6', 'Loading Dock Mapper', 'Chart dock access and waiting rules at four retail stops.', 'Gesundbrunnen', 'MEDIUM', 'DOCKS', 4, 7, 9, 200, true, 'LIVE', 'Badstraße 20', 52.55178, 13.383148),
  ('c0', 'District Master: Prenzlauer Berg', 'Own your home zone this weekend — leave every stop verified, coded and noted. Top payout of the week, and the whole hub sees it.', 'Prenzlauer Berg', 'EPIC', 'STOPS', 12, 2, 15, 400, true, 'DRAFT', 'Prenzlauer Berg', 52.53688, 13.420892)
on conflict (id) do nothing;
