-- schema_delta_item_provenance.sql — durable item identity/history tables; prepared 2026-08-14, NOT YET APPLIED.
-- Requires schema_v1.sql helpers plus schema_delta_members.sql (is_member).
-- This delta is deliberately inert: authenticated clients may read the public
-- item/history projection, staff may read secrets, and nobody may write these
-- tables directly. Narrow SECURITY DEFINER lifecycle RPCs arrive in later,
-- append-only deltas after the live characters authority has been captured.


-- ── Public current item state ─────────────────────────────────────────────

create table if not exists public.item_instances (
  id                    text primary key,
  schema_version        smallint not null default 1 check (schema_version = 1),
  definition_key        text,
  display_name          text not null check (btrim(display_name) <> ''),
  public_description    text not null default '',
  rarity                text check (rarity in ('Common','Uncommon','Rare','Very Rare','Legendary','Artifact')),
  identification        text not null default 'unidentified'
                        check (identification in ('unidentified','identified')),
  mechanics             jsonb not null default '{}'::jsonb
                        check (jsonb_typeof(mechanics) = 'object'),
  status                text not null default 'unplaced'
                        check (status in ('unplaced','recovered','held','lost','destroyed')),
  current_bearer_key    text,
  current_location_id   text,
  slot                  text,
  attuned               boolean not null default false,
  created_by            uuid default auth.uid() references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- Unknown means genuinely unrevealed: no true definition, rarity, or rules
  -- are allowed into the party-readable row before identification.
  constraint item_instances_identification_public_check check (
    identification = 'identified'
    or (definition_key is null and rarity is null and mechanics = '{}'::jsonb)
  ),

  -- Custody is canonical here. A held item has exactly one bearer and no map
  -- location; every other state has no bearer. The future transfer RPC owns
  -- this transition and clears bearer-specific equipment state.
  constraint item_instances_custody_check check (
    (status = 'held' and current_bearer_key is not null and current_location_id is null)
    or (status <> 'held' and current_bearer_key is null)
  ),
  constraint item_instances_equipment_check check (
    status = 'held' or (slot is null and attuned = false)
  )
);

create index if not exists item_instances_bearer_idx
  on public.item_instances (current_bearer_key) where current_bearer_key is not null;
create index if not exists item_instances_location_idx
  on public.item_instances (current_location_id) where current_location_id is not null;


-- ── Staff-only unrevealed truth ───────────────────────────────────────────

create table if not exists public.item_secrets (
  item_id                text primary key references public.item_instances(id) on delete cascade,
  schema_version         smallint not null default 1 check (schema_version = 1),
  true_name              text not null check (btrim(true_name) <> ''),
  definition_key         text,
  rarity                 text not null
                         check (rarity in ('Common','Uncommon','Rare','Very Rare','Legendary','Artifact')),
  public_description     text not null default '',
  mechanics              jsonb not null default '{}'::jsonb
                         check (jsonb_typeof(mechanics) = 'object'),
  lore                   text not null default '',
  created_by             uuid default auth.uid() references auth.users(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);


-- ── Append-only historical facts ─────────────────────────────────────────

create table if not exists public.item_events (
  sequence                bigint generated always as identity unique,
  id                      text primary key,
  schema_version          smallint not null default 1 check (schema_version = 1),
  item_id                 text not null references public.item_instances(id) on delete restrict,
  event_type              text not null
                          check (event_type in ('recovered','assigned','identified','renamed','transferred','transformed','lost','destroyed')),
  occurred_at             timestamptz not null default now(),
  recorded_at             timestamptz not null default now(),
  actor_character_key     text,
  actor_user_id           uuid default auth.uid() references auth.users(id) on delete set null,
  summary                 text not null default '',
  data                    jsonb not null default '{}'::jsonb
                          check (jsonb_typeof(data) = 'object'),
  session_id              text,
  location_id             text,
  moment_id               text,
  encounter_id            text,
  journal_page_id         text,
  feed_post_id            text,
  battle_map_id           text
);

create index if not exists item_events_item_sequence_idx
  on public.item_events (item_id, sequence);
create index if not exists item_events_story_time_idx
  on public.item_events (occurred_at, sequence);
create index if not exists item_events_location_idx
  on public.item_events (location_id) where location_id is not null;
create index if not exists item_events_session_idx
  on public.item_events (session_id) where session_id is not null;


-- Even a service-role or owner mistake must not rewrite campaign history.
create or replace function public.item_events_forbid_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'item history is append-only; event % cannot be changed', old.id;
end;
$$;

drop trigger if exists item_events_append_only on public.item_events;
create trigger item_events_append_only
  before update or delete on public.item_events
  for each row execute function public.item_events_forbid_mutation();


-- ── Read policy; lifecycle writes arrive through narrow RPCs ─────────────

alter table public.item_instances enable row level security;
alter table public.item_secrets   enable row level security;
alter table public.item_events    enable row level security;

drop policy if exists item_instances_select on public.item_instances;
create policy item_instances_select on public.item_instances
  for select to authenticated using (public.is_member());

drop policy if exists item_secrets_staff_select on public.item_secrets;
create policy item_secrets_staff_select on public.item_secrets
  for select to authenticated using (public.is_staff());

drop policy if exists item_events_select on public.item_events;
create policy item_events_select on public.item_events
  for select to authenticated using (public.is_member());

grant select on public.item_instances, public.item_events to authenticated;
grant select on public.item_secrets to authenticated;
revoke insert, update, delete on public.item_instances, public.item_secrets, public.item_events from authenticated;

-- Administrative seed/backfill remains possible, but history is still guarded
-- against UPDATE/DELETE by item_events_append_only.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update, delete on public.item_instances, public.item_secrets, public.item_events to service_role;
  end if;
end $$;

