-- ============================================================
-- Places tagged from the People Mobile app (phone GPS).
-- Run once in the Supabase SQL editor (paste + Run), after schema.sql.
-- Safe to re-run.
-- ============================================================

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Unnamed place',
  note text,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,        -- GPS accuracy in metres at save time
  created_at timestamptz not null default now()
);

alter table public.places enable row level security;

-- The people app has no user accounts in the pilot, so tagging is open to
-- the anon key by design. Reads are open too (the map shows shared places).
drop policy if exists "anyone reads places" on public.places;
create policy "anyone reads places" on public.places
  for select to anon, authenticated using (true);

drop policy if exists "anyone adds places" on public.places;
create policy "anyone adds places" on public.places
  for insert to anon, authenticated with check (true);

-- Tags stay editable from the app: the tag inspector can rename and
-- delete saved places.
drop policy if exists "anyone updates places" on public.places;
create policy "anyone updates places" on public.places
  for update to anon, authenticated using (true) with check (true);

drop policy if exists "anyone deletes places" on public.places;
create policy "anyone deletes places" on public.places
  for delete to anon, authenticated using (true);
