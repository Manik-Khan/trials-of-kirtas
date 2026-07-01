-- schema_delta_journal.sql  (the journal walled corner — Phase 2 persistence)
--
-- Three tables:
--   entities      : play-created NPCs/locations (canon stays in tooltips.js;
--                   these merge in at load — the "New to the world" queue).
--   journal_pages : a character's vault — pages in sections. doc (TipTap
--                   JSON) is the source of truth; html is a render cache.
--                   Carries BOTH identities: author_id (player, RLS truth)
--                   and character_key (seat at time of writing, display).
--                   session + created_at enable "share later, placed at the
--                   proper time" in the chronicle.
--   journal_refs  : the queryable graph, rebuilt on save. kind='entity'
--                   rows point at NPCs/locations (shared world graph);
--                   kind='page' rows point at other pages (private graph).
--
-- Visibility (locked with M, July 1): journals are PARTY-READABLE — any
-- member can read any journal — but a page is editable ONLY by its author
-- (not even staff edit another player's words; staff keep delete for
-- moderation). "Share to Chronicle" inserts a feed row (channel=
-- 'chronicle') under the already-deployed chronicle-unify RLS — no feed
-- changes needed here.
--
-- House rules honored: explicit GRANTs to authenticated (raw-SQL tables get
-- nothing by default); writes gated on public.is_member(), not bare
-- authenticated; no touch to the characters table or its live-only policy.
-- Idempotent — safe to re-run.

-- ── entities ────────────────────────────────────────────────────────────────
create table if not exists public.entities (
  id          text not null,                       -- slug ('ser-bellamy')
  type        text not null check (type in ('npc','location')),
  name        text not null,
  descr       text,
  status      text,
  curated     boolean not null default false,      -- placed on npcs.html / pinned
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  primary key (type, id)
);

grant select, insert, update, delete on public.entities to authenticated;

alter table public.entities enable row level security;

drop policy if exists entities_select on public.entities;
create policy entities_select on public.entities
  for select to authenticated using (true);        -- the world is shared knowledge

drop policy if exists entities_insert on public.entities;
create policy entities_insert on public.entities
  for insert to authenticated with check (public.is_member());

-- curation (rename, describe, mark curated, delete) is a staff act
drop policy if exists entities_update on public.entities;
create policy entities_update on public.entities
  for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists entities_delete on public.entities;
create policy entities_delete on public.entities
  for delete to authenticated using (public.is_staff());

-- ── journal_pages ───────────────────────────────────────────────────────────
create table if not exists public.journal_pages (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null default auth.uid(),  -- the player (RLS truth)
  character_key text,                              -- the seat (null = Narrator)
  folder        text not null default 'Unsorted',
  title         text not null,
  slug          text not null,                     -- [[wikilink]] target, stable
  doc           jsonb,                             -- TipTap JSON — source of truth
  html          text,                              -- render cache
  session       int,                               -- session at time of writing
  shared_feed_id bigint,                           -- feed.id once shared (null = private)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (author_id, character_key, slug)
);

create index if not exists journal_pages_owner
  on public.journal_pages (author_id, character_key, folder);

grant select, insert, update, delete on public.journal_pages to authenticated;

alter table public.journal_pages enable row level security;

drop policy if exists journal_pages_select on public.journal_pages;
create policy journal_pages_select on public.journal_pages
  for select to authenticated
  using (public.is_member());              -- party-readable

drop policy if exists journal_pages_insert on public.journal_pages;
create policy journal_pages_insert on public.journal_pages
  for insert to authenticated
  with check (author_id = auth.uid() and public.is_member());

drop policy if exists journal_pages_update on public.journal_pages;
create policy journal_pages_update on public.journal_pages
  for update to authenticated
  using (author_id = auth.uid())           -- your words are yours alone
  with check (author_id = auth.uid());

drop policy if exists journal_pages_delete on public.journal_pages;
create policy journal_pages_delete on public.journal_pages
  for delete to authenticated
  using (author_id = auth.uid() or public.is_staff());

-- keep updated_at honest
create or replace function public.touch_journal_page()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists journal_pages_touch on public.journal_pages;
create trigger journal_pages_touch
  before update on public.journal_pages
  for each row execute function public.touch_journal_page();

-- ── journal_refs ────────────────────────────────────────────────────────────
create table if not exists public.journal_refs (
  page_id   uuid not null references public.journal_pages(id) on delete cascade,
  kind      text not null check (kind in ('entity','page')),
  ref_type  text,                                  -- 'npc'|'location' when kind='entity'
  ref_id    text not null,                         -- entity slug OR target page slug
  label     text,
  primary key (page_id, kind, ref_id)
);

create index if not exists journal_refs_target on public.journal_refs (kind, ref_id);

grant select, insert, update, delete on public.journal_refs to authenticated;

alter table public.journal_refs enable row level security;

-- journals are party-readable, so the graph is one shared graph
drop policy if exists journal_refs_select on public.journal_refs;
create policy journal_refs_select on public.journal_refs
  for select to authenticated
  using (public.is_member());

drop policy if exists journal_refs_write on public.journal_refs;
create policy journal_refs_write on public.journal_refs
  for all to authenticated
  using (exists (
    select 1 from public.journal_pages p
    where p.id = page_id and p.author_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.journal_pages p
    where p.id = page_id and p.author_id = auth.uid()
  ));
