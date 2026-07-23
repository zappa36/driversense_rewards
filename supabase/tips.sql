-- ============================================================
-- Voice tips collected through the Otto debrief (OpenAI-transcribed).
-- Run once in the Supabase SQL editor (paste + Run), after schema.sql.
-- Safe to re-run.
-- ============================================================

create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  place text,                       -- place name shown when the tip was recorded
  transcript text not null,         -- what was actually said
  title text,                       -- structured summary ("Elevator broken — take the stairs")
  category text,                    -- ACCESS / CLOSURE / HAZARD / ENTRANCE / HOURS / INFO
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

alter table public.tips enable row level security;

-- Same pilot model as places: the people app has no accounts, so tips are
-- open to the anon key by design.
drop policy if exists "anyone reads tips" on public.tips;
create policy "anyone reads tips" on public.tips
  for select to anon, authenticated using (true);

drop policy if exists "anyone adds tips" on public.tips;
create policy "anyone adds tips" on public.tips
  for insert to anon, authenticated with check (true);
