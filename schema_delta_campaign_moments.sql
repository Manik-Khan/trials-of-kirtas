-- schema_delta_campaign_moments.sql — one shared fact projected across World,
-- Chronicle, item history, Journal, encounters, and battle maps.
-- Prepared 2026-08-19. Apply after item provenance, Living Codex, Journal,
-- scenes, feed, encounters, and Forge session tables exist.

create table if not exists public.campaign_moments (
  id                text primary key,
  schema_version    smallint not null default 1 check (schema_version = 1),
  kind              text not null check (kind in ('journey','discovery','battle','treasure','npc')),
  also              text[] not null default '{}',
  title             text not null check (btrim(title) <> ''),
  summary           text not null default '',
  occurred_at       timestamptz not null,
  session_id        int,
  location_id       text,
  map_precision     text not null default 'confirmed'
                    check (map_precision in ('confirmed','approximate')),
  party_present     boolean not null default false,
  visibility        text not null default 'party'
                    check (visibility in ('party','staff')),
  journal_page_id   uuid references public.journal_pages(id) on delete set null,
  feed_post_id      bigint references public.feed(id) on delete set null,
  encounter_id      uuid references public.encounters(id) on delete set null,
  scene_id          uuid references public.scenes(id) on delete set null,
  forge_session_id  uuid references public.forge_sessions(id) on delete set null,
  recorded_by       uuid default auth.uid() references auth.users(id) on delete set null,
  recorded_at       timestamptz not null default now(),

  -- A battle map is a typed database identity. Friendly names and legacy
  -- scenes.key values are presentation only and cannot enter this contract.
  constraint campaign_moments_one_battle_map check (
    num_nonnulls(scene_id, forge_session_id) <= 1
  ),
  constraint campaign_moments_also_known check (
    also <@ array['journey','discovery','battle','treasure','npc']::text[]
  )
);

create table if not exists public.campaign_moment_secrets (
  moment_id          text primary key references public.campaign_moments(id) on delete cascade,
  staff_summary      text not null default '',
  exact_location_id  text,
  exact_map_x        numeric check (exact_map_x is null or (exact_map_x >= 0 and exact_map_x <= 100)),
  exact_map_y        numeric check (exact_map_y is null or (exact_map_y >= 0 and exact_map_y <= 100)),
  recorded_by        uuid default auth.uid() references auth.users(id) on delete set null,
  recorded_at        timestamptz not null default now(),
  constraint campaign_moment_secret_exact_pair check (
    (exact_map_x is null and exact_map_y is null)
    or (exact_map_x is not null and exact_map_y is not null)
  )
);

create index if not exists campaign_moments_story_time_idx
  on public.campaign_moments (occurred_at, id);
create index if not exists campaign_moments_location_idx
  on public.campaign_moments (location_id, occurred_at) where location_id is not null;
create index if not exists campaign_moments_session_idx
  on public.campaign_moments (session_id, occurred_at) where session_id is not null;
create index if not exists campaign_moments_feed_idx
  on public.campaign_moments (feed_post_id) where feed_post_id is not null;
create index if not exists item_events_moment_idx
  on public.item_events (moment_id) where moment_id is not null;

alter table public.campaign_moments enable row level security;
alter table public.campaign_moment_secrets enable row level security;

drop policy if exists campaign_moments_select on public.campaign_moments;
create policy campaign_moments_select on public.campaign_moments
  for select to authenticated
  using (public.is_member() and (visibility = 'party' or public.is_staff()));

drop policy if exists campaign_moment_secrets_staff_select on public.campaign_moment_secrets;
create policy campaign_moment_secrets_staff_select on public.campaign_moment_secrets
  for select to authenticated using (public.is_staff());

grant select on public.campaign_moments, public.campaign_moment_secrets to authenticated;
revoke insert, update, delete on public.campaign_moments, public.campaign_moment_secrets from authenticated;

do $$ begin
  alter publication supabase_realtime add table public.campaign_moments;
exception when duplicate_object then null;
end $$;

-- First field records are inserted deliberately through the Supabase service
-- role/table editor after their real feed, encounter, scene/Forge, Journal,
-- item-event, and Living Codex identities have been checked. No sample IDs are
-- seeded here and no production page receives a write path in this slice.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update, delete on public.campaign_moments, public.campaign_moment_secrets to service_role;
  end if;
end $$;
