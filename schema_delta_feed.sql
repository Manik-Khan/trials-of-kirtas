-- schema_delta_feed.sql  (Phase 1 — the shared feed / game log)
-- An append-only event log: combat rolls + chronicle entries in one place,
-- streamed live. Designed to grow into the session/encounter replay archive
-- (loot, story, move-by-move) without schema changes — channel + kind carry it.
--
--   channel = 'combat'    -> rolls, attacks, init (the Combat tab)
--   channel = 'chronicle' -> typed narration, loot, images (the Chronicle tab)
--   hidden  = true        -> DM-only (players never SELECT it)
--
-- Supabase is the live source; the git-committed JSON archive stays the durable
-- backstop (export job is Phase 2). Idempotent and safe to re-run.

create table if not exists public.feed (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  session      int,                                          -- session number (set in Phase 2)
  encounter_id uuid references public.encounters(id) on delete set null,
  channel      text not null default 'combat'  check (channel in ('combat','chronicle')),
  kind         text not null default 'roll'    check (kind in ('roll','attack','message','event','loot','image')),
  actor_key    text,                                         -- roller's character source_key (null = DM/system)
  actor_name   text not null,                                -- display name in the feed
  formula      text,                                         -- dice expression, e.g. '2d20kh1+4'
  result       jsonb,                                        -- structured detail { total, dice, ... }
  body         text not null,                                -- rendered line for display
  hidden       boolean not null default false
);

create index if not exists feed_created   on public.feed (created_at desc);
create index if not exists feed_encounter on public.feed (encounter_id);

-- Realtime needs the full row on changes.
alter table public.feed replica identity full;

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.feed enable row level security;

-- Read: everyone sees public entries; staff also see hidden ones.
drop policy if exists feed_read on public.feed;
create policy feed_read on public.feed
  for select to authenticated
  using (not hidden or public.is_staff());

-- Insert: any authenticated user may post; only staff may post hidden.
drop policy if exists feed_insert on public.feed;
create policy feed_insert on public.feed
  for insert to authenticated
  with check (not hidden or public.is_staff());

-- Mutate: staff only — the log is immutable for players, which is what makes a
-- faithful replay/archive possible.
drop policy if exists feed_staff_update on public.feed;
create policy feed_staff_update on public.feed
  for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists feed_staff_delete on public.feed;
create policy feed_staff_delete on public.feed
  for delete to authenticated
  using (public.is_staff());

-- RLS gates; this grant just exposes the table to the API role (house style).
grant select, insert, update, delete on public.feed to authenticated;

-- Join the realtime publication so inserts stream to every client.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'feed'
  ) then
    alter publication supabase_realtime add table public.feed;
  end if;
end $$;
