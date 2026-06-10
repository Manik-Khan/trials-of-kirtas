-- schema_delta_chronicle_unify.sql  (Phase 2 — chronicle unification)
-- Makes the feed table chronicle-capable and adds the one-row campaign config.
--
--   feed.author_id : auth-bound ownership (actor_key is display-only text and
--                    cannot gate RLS). Defaults to auth.uid() on insert.
--   feed.tags      : the chronicle's #hashtags ([@mention keys])
--   feed.meta      : display baggage (character, color, location, sessionTitle,
--                    legacy_id / legacy_author for migrated rows)
--   feed.edited_at : set when an author edits their entry
--
--   campaign       : one-row config (current_session) shared by every page —
--                    replaces chronicle.json's config block as live truth.
--
-- RLS change (locked with M): authors may edit/delete their OWN chronicle-
-- channel rows; staff may mutate anything; combat rolls stay immutable for
-- players (replay integrity). Idempotent and safe to re-run.

-- ── feed columns ────────────────────────────────────────────────────────────
alter table public.feed add column if not exists author_id uuid default auth.uid();
alter table public.feed add column if not exists tags      text[];
alter table public.feed add column if not exists meta      jsonb;
alter table public.feed add column if not exists edited_at timestamptz;

create index if not exists feed_channel on public.feed (channel, created_at desc);

-- ── feed RLS: replace the staff-only mutate policies ────────────────────────
-- Insert: hidden stays staff-only; players cannot spoof another author_id
-- (null is allowed — such a row is simply staff-only editable thereafter).
drop policy if exists feed_insert on public.feed;
create policy feed_insert on public.feed
  for insert to authenticated
  with check (
    (not hidden or public.is_staff())
    and (author_id is null or author_id = auth.uid() or public.is_staff())
  );

-- Update: staff anything; authors their own chronicle rows (never hidden ones,
-- and they cannot flip a row hidden — hidden remains staff-only end to end).
drop policy if exists feed_staff_update on public.feed;
drop policy if exists feed_update on public.feed;
create policy feed_update on public.feed
  for update to authenticated
  using  (public.is_staff() or (author_id = auth.uid() and channel = 'chronicle' and not hidden))
  with check (public.is_staff() or (author_id = auth.uid() and channel = 'chronicle' and not hidden));

-- Delete: same shape.
drop policy if exists feed_staff_delete on public.feed;
drop policy if exists feed_delete on public.feed;
create policy feed_delete on public.feed
  for delete to authenticated
  using (public.is_staff() or (author_id = auth.uid() and channel = 'chronicle' and not hidden));

-- ── campaign — one-row config ("which session are we on") ──────────────────
create table if not exists public.campaign (
  id              smallint primary key default 1 check (id = 1),
  current_session int not null default 0,
  updated_at      timestamptz not null default now()
);

insert into public.campaign (id) values (1) on conflict (id) do nothing;

alter table public.campaign replica identity full;
alter table public.campaign enable row level security;

drop policy if exists campaign_read on public.campaign;
create policy campaign_read on public.campaign
  for select to authenticated using (true);

drop policy if exists campaign_staff_update on public.campaign;
create policy campaign_staff_update on public.campaign
  for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- RLS gates; the grant just exposes the table to the API role (house style).
grant select, update on public.campaign to authenticated;

-- Join the realtime publication so a session bump propagates live.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'campaign'
  ) then
    alter publication supabase_realtime add table public.campaign;
  end if;
end $$;
