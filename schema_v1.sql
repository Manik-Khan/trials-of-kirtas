-- ============================================================================
-- Trials of Kirtas — combat schema v1  (profiles · encounters · combatants)
-- Target: Supabase project cfthwspwpcfamgbfqzuq  (plain Postgres)
-- Model: single campaign, GLOBAL roles (overseer / dm / player).
-- ============================================================================
-- Paste into the Supabase SQL editor and run as one script. Re-runnable
-- (idempotent): policies/triggers are dropped-if-exists first; tables use
-- IF NOT EXISTS. Running it twice is safe.
--
-- ROLES (global, on the profile — single-campaign model):
--   overseer : top authority (site owner). Full DB visibility, manages roles.
--   dm       : runs combat. Sees the DM view (all combatants, all fog).
--   player   : plays one character. Sees only non-hidden tokens + their own.
--
-- Two privileged roles (overseer, dm) both see everything — overseer so it can
-- fix things when something breaks, dm so it can run the fight. The DM/player
-- "view-as" switch is a CLIENT-SIDE lens, not a permission, so it needs no
-- schema: in a player lens the client simply doesn't fetch hidden rows.
--
-- WHO CAN DO WHAT (enforced below):
--   • assign/change roles ............ overseer only  (admin task)
--   • create/edit encounters ......... overseer or dm
--   • add/remove/hide combatants ..... overseer or dm
--   • move own token / set own hp+conditions ... that token's player
--
-- The table shape IS the security model: hidden / side / owner are data and
-- access-control at once; players and staff see different views of the same
-- rows purely through RLS row-filtering.
--
-- Combat-render fields (x, y, map_ref, active_combatant_id) are present now but
-- kept loose/nullable until the map layer wires them up.
--
-- MULTI-CAMPAIGN (deferred): when a 2nd campaign appears, role + character_key
-- move off profiles into a (login, campaign) membership row, encounters gain a
-- campaign_id, and the helpers below become campaign-scoped. Bounded migration,
-- not a rewrite (tiny data). Single-campaign now per decision 2026-05-31.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────
-- 1. TABLES
-- ─────────────────────────────────────────────────────────────────────────

-- profiles — identity layer. One row per auth login. "Who is this person."
create table if not exists public.profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references auth.users(id) on delete cascade,
  role          text not null default 'player' check (role in ('overseer','dm','player')),
  character_key text check (character_key in ('cosmere','caim','liadan','vesperian')),
  created_at    timestamptz not null default now()
);

-- One person per character (rows with null character_key — e.g. a DM who isn't
-- also playing — are excluded).
create unique index if not exists profiles_one_per_character
  on public.profiles (character_key) where character_key is not null;


-- encounters — the fight container. Staff-owned. "The fight."
create table if not exists public.encounters (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  status              text not null default 'active' check (status in ('active','ended')),
  round               int  not null default 1,
  active_combatant_id uuid,                                 -- loose: combat layer sets it
  map_ref             text,                                 -- filename in maps/ (nullable for now)
  revealed_cells      jsonb not null default '[]'::jsonb,   -- fog: JSON array of [x,y] coords
  created_at          timestamptz not null default now()
);

-- Only ONE active encounter at a time. Mark the old one 'ended' before
-- starting a new one, or the insert/update is rejected by this index.
create unique index if not exists encounters_one_active
  on public.encounters (status) where status = 'active';


-- combatants — one row per token, party AND enemies (same fields, same realtime
-- logic, distinguished by `side`). "Every token in the fight."
create table if not exists public.combatants (
  id           uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  owner        uuid references public.profiles(id) on delete set null,  -- null = enemy/neutral
  name         text,                                                    -- display label (enemies need it)
  side         text not null default 'enemy' check (side in ('party','enemy','neutral')),
  hidden       boolean not null default false,
  hp           int,
  max_hp       int,
  initiative   int,                                                    -- null while a participant hasn't rolled yet
  in_combat    boolean not null default false,                          -- #1: participant in the active encounter's order (staff-seated). in_combat + null initiative = in the fight, hasn't rolled
  conditions   jsonb not null default '[]'::jsonb,
  x            int,                                                      -- loose until map layer
  y            int,
  -- reconciled from earlier deltas (were live-only; folded in here so a fresh
  -- install matches the running DB):
  source_key   text,                                                    -- party binding (character key); null for enemies
  size         text default 'medium',                                   -- token footprint: tiny|small|medium|large|huge|gargantuan
  -- added by schema_delta_enemies.sql (#3 Phase A):
  ac           int,                                                      -- armour class (denormalised for board/HUD)
  statblock    jsonb,                                                    -- snapshot of the 5etools monster JSON (enemies)
  -- added by schema_delta_disposition.sql (#2a): friend/foe axis, orthogonal
  -- to `side`. Drives ring + strip colour and (later) target logic. `side`
  -- stays the permission/control axis; a token can be side='party'
  -- (player-controlled) yet disposition='hostile', or staff-run yet 'friendly'.
  disposition  text not null default 'hostile'                           -- friendly | neutral | hostile (visual + targeting)
                 check (disposition in ('friendly','neutral','hostile')),
  created_at   timestamptz not null default now()
);

create index if not exists combatants_encounter_idx on public.combatants (encounter_id);
create index if not exists combatants_owner_idx     on public.combatants (owner);


-- ─────────────────────────────────────────────────────────────────────────
-- 2. HELPER FUNCTIONS
-- SECURITY DEFINER so their internal reads bypass RLS — this is what prevents
-- infinite recursion when a policy on `profiles` calls one of them.
-- ─────────────────────────────────────────────────────────────────────────

-- True if the current login is the overseer (admin / role-assigner).
create or replace function public.is_overseer()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'overseer'
  );
$$;

-- True for the privileged "sees everything" roles (overseer or dm).
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role in ('overseer','dm')
  );
$$;

-- The current login's profile id (null if none).
create or replace function public.my_profile_id()
returns uuid language sql stable security definer set search_path = public
as $$
  select id from public.profiles where user_id = auth.uid();
$$;

grant execute on function public.is_overseer()   to authenticated;
grant execute on function public.is_staff()      to authenticated;
grant execute on function public.my_profile_id() to authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 3. ENABLE RLS
-- ─────────────────────────────────────────────────────────────────────────

alter table public.profiles   enable row level security;
alter table public.encounters enable row level security;
alter table public.combatants enable row level security;


-- ─────────────────────────────────────────────────────────────────────────
-- 4. POLICIES
-- ─────────────────────────────────────────────────────────────────────────

-- profiles ------------------------------------------------------------------
-- Read: all logged-in users. The combat view resolves a token's owner ->
-- character_key via profiles to pick its portrait, and profiles hold no
-- secrets (role + character_key). Lock-down alternative: denormalize
-- character_key onto the combatant row and restrict this to own-profile only.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select to authenticated
  using (true);

-- Write: OVERSEER ONLY. Assigning roles is an admin task — a DM cannot hand
-- out privileges.
drop policy if exists profiles_overseer_write on public.profiles;
create policy profiles_overseer_write on public.profiles
  for all to authenticated
  using (public.is_overseer())
  with check (public.is_overseer());


-- encounters ----------------------------------------------------------------
-- Read: all logged-in users (players need the active encounter's map_ref,
-- round, and revealed_cells to draw the board + fog). Not security-bearing.
drop policy if exists encounters_read on public.encounters;
create policy encounters_read on public.encounters
  for select to authenticated
  using (true);

-- Write: staff (overseer or dm).
drop policy if exists encounters_staff_write on public.encounters;
create policy encounters_staff_write on public.encounters
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());


-- combatants ----------------------------------------------------------------
-- Staff (overseer or dm): everything. Overseer can fix; dm can run the fight.
drop policy if exists combatants_staff_all on public.combatants;
create policy combatants_staff_all on public.combatants
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Player read: visible (not hidden) tokens, plus their own (even if hidden).
drop policy if exists combatants_player_select on public.combatants;
create policy combatants_player_select on public.combatants
  for select to authenticated
  using (hidden = false or owner = public.my_profile_id());

-- Player update: ANY party row (shared HUD — players co-manage characters at
-- the table, e.g. covering for an absent player). Enemies stay staff-only since
-- they are not side='party'. WHICH COLUMNS a player may change is still enforced
-- by the trigger below (hp/conditions/x/y only), so opening the row set does NOT
-- let players touch owner, side, max_hp, or any other structural field.
drop policy if exists combatants_player_update on public.combatants;
create policy combatants_player_update on public.combatants
  for update to authenticated
  using (side = 'party')
  with check (side = 'party');

-- (No player INSERT or DELETE policy — only staff can add/remove tokens.)


-- ─────────────────────────────────────────────────────────────────────────
-- 5. COLUMN GUARD (player writes)
-- A player may change only the "live" columns on their own row: hp,
-- conditions, x, y. Any attempt to change a protected column is silently
-- coerced back to its old value (friendlier for the HUD than raising).
-- Staff (overseer / dm) bypass the guard entirely.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.combatants_guard_columns()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if public.is_staff() then
    return new;                       -- overseer / dm: no restriction
  end if;
  -- Player: pin protected columns to their old values.
  new.encounter_id := old.encounter_id;
  new.owner        := old.owner;
  new.name         := old.name;
  new.side         := old.side;
  new.hidden       := old.hidden;
  new.max_hp       := old.max_hp;
  new.disposition  := old.disposition;   -- friend/foe is a staff call, not a player's
  new.in_combat    := old.in_combat;      -- staff seats participants; players still write their own initiative
  -- Allowed to change: hp, conditions, x, y, initiative
  return new;
end;
$$;

drop trigger if exists combatants_guard on public.combatants;
create trigger combatants_guard
  before update on public.combatants
  for each row execute function public.combatants_guard_columns();


-- ─────────────────────────────────────────────────────────────────────────
-- 6. TABLE GRANTS
-- RLS does the gating; these grants just expose the tables to the API role.
-- Anonymous visitors get nothing — the whole site is behind login.
-- ─────────────────────────────────────────────────────────────────────────

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles   to authenticated;
grant select, insert, update, delete on public.encounters to authenticated;
grant select, insert, update, delete on public.combatants to authenticated;

revoke all on public.profiles   from anon;
revoke all on public.encounters from anon;
revoke all on public.combatants from anon;


-- ─────────────────────────────────────────────────────────────────────────
-- 7. REALTIME
-- Live tables join the realtime publication so staff writes stream to players.
-- profiles is static identity data — not in realtime.
-- ─────────────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'encounters'
  ) then
    alter publication supabase_realtime add table public.encounters;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'combatants'
  ) then
    alter publication supabase_realtime add table public.combatants;
  end if;
end $$;


-- ─────────────────────────────────────────────────────────────────────────
-- 8. SEED IDENTITIES  (run AFTER the auth users exist — commented out)
-- profiles can't be created until the matching auth.users rows exist, so this
-- is separate from the structural migration above.
-- ─────────────────────────────────────────────────────────────────────────

-- Overseer (already added to Auth per CONTEXT):
-- insert into public.profiles (user_id, role)
--   select id, 'overseer' from auth.users where email = 'thebraveruby@gmail.com'
--   on conflict (user_id) do update set role = 'overseer';

-- Players (after Authentication -> Users -> Add user for each). If you'd rather
-- players self-claim their character on first login, omit character_key here
-- and have the client set it on the player's own profile row instead.
-- insert into public.profiles (user_id, role, character_key)
--   select id, 'player', 'cosmere'   from auth.users where email = 'PLAYER_COSMERE@example.com'
--   on conflict (user_id) do update set role = 'player', character_key = 'cosmere';
-- insert into public.profiles (user_id, role, character_key)
--   select id, 'player', 'caim'      from auth.users where email = 'PLAYER_CAIM@example.com'
--   on conflict (user_id) do update set role = 'player', character_key = 'caim';
-- insert into public.profiles (user_id, role, character_key)
--   select id, 'player', 'liadan'    from auth.users where email = 'PLAYER_LIADAN@example.com'
--   on conflict (user_id) do update set role = 'player', character_key = 'liadan';
-- insert into public.profiles (user_id, role, character_key)
--   select id, 'player', 'vesperian' from auth.users where email = 'PLAYER_VESPERIAN@example.com'
--   on conflict (user_id) do update set role = 'player', character_key = 'vesperian';

-- ============================================================================

-- ============================================================================
-- feed — the shared game log (Phase 1). Append-only: combat rolls + chronicle.
-- See schema_delta_feed.sql for the runnable migration + full notes.
-- ============================================================================
create table if not exists public.feed (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  session      int,
  encounter_id uuid references public.encounters(id) on delete set null,
  channel      text not null default 'combat'  check (channel in ('combat','chronicle')),
  kind         text not null default 'roll'    check (kind in ('roll','attack','message','event','loot','image')),
  actor_key    text,
  actor_name   text not null,
  formula      text,
  result       jsonb,
  body         text not null,
  hidden       boolean not null default false
);
create index if not exists feed_created   on public.feed (created_at desc);
create index if not exists feed_encounter on public.feed (encounter_id);
alter table public.feed replica identity full;

alter table public.feed enable row level security;
drop policy if exists feed_read on public.feed;
create policy feed_read on public.feed for select to authenticated
  using (not hidden or public.is_staff());
drop policy if exists feed_insert on public.feed;
create policy feed_insert on public.feed for insert to authenticated
  with check (not hidden or public.is_staff());
drop policy if exists feed_staff_update on public.feed;
create policy feed_staff_update on public.feed for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
drop policy if exists feed_staff_delete on public.feed;
create policy feed_staff_delete on public.feed for delete to authenticated
  using (public.is_staff());

grant select, insert, update, delete on public.feed to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'feed'
  ) then
    alter publication supabase_realtime add table public.feed;
  end if;
end $$;
