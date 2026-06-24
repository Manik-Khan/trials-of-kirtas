-- schema_delta_roster_layout.sql
-- ───────────────────────────────────────────────────────────────────────────
-- Shared folder layout for the Characters roster (the rail's Characters tab).
--
-- A single-row JSONB document describing how the roster is organised:
--   { "folders": [ {"id":"f_ab12","name":"Party Members"}, ... ],
--     "order":   ["f_ab12","f_cd34"],            // folder display order
--     "members": { "cosmere":"f_ab12", ... } }    // character key -> folder id
-- Characters absent from `members` (or pointing at a deleted folder) fall into
-- the built-in "Unfiled" group.
--
-- It's shared campaign-wide (everyone sees the same folders), so it lives in a
-- table with party read/write — not localStorage. The singleton row is seeded
-- here so clients only ever SELECT / UPDATE it (no insert path needed).
-- Run once in Supabase.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.roster_layout (
  id         int primary key default 1 check (id = 1),
  layout     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.roster_layout (id, layout)
values (1, '{}'::jsonb)
on conflict (id) do nothing;

alter table public.roster_layout enable row level security;

drop policy if exists roster_layout_read on public.roster_layout;
create policy roster_layout_read  on public.roster_layout
  for select to authenticated using (true);

drop policy if exists roster_layout_write on public.roster_layout;
create policy roster_layout_write on public.roster_layout
  for update to authenticated using (true) with check (true);

grant select, update on public.roster_layout to authenticated;
