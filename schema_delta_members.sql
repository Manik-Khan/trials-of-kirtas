-- ============================================================================
-- schema_delta_members.sql  —  Members & Access (in-site identity + onboarding)
-- ----------------------------------------------------------------------------
-- Builds on schema_v1.sql's profiles/RLS. Value-first per CONTEXT.md: role +
-- grants stay ON profiles for now; when a 2nd campaign appears they lift into a
-- (login, campaign) membership row (the schema_v1 header already plans this).
--
-- What this adds:
--   • profiles.username  — the account's own name (identity stops being "the
--     Cosmere player"). Overseer-assigned; never self-chosen as a privilege.
--   • profiles.grants    — opt-in extra powers on top of role (e.g. a trusted
--     player who may tidy combat tokens). INERT until a feature checks them.
--   • role 'pending'     — a self-provisioned, powerless account awaiting the
--     overseer's approval. is_staff()/is_overseer() already exclude it.
--   • is_member()        — "an approved member" (overseer/dm/player, NOT pending
--     and NOT a profile-less guest). Used to tighten player writes.
--   • request_access()   — the self-serve path: a new login writes ITS OWN
--     pending row. SECURITY DEFINER so it bypasses the overseer-only write
--     policy, but it can only ever insert role='pending' for auth.uid().
--   • set_membership()   — the overseer's write path (role/character/grants/
--     username), with character-release, last-overseer guard, and upsert so a
--     never-provisioned login can be approved in one click.
--   • profiles in realtime — so the admin page's pending queue streams live.
--
-- SECURITY NOTE (why is_member() exists — read before deploying):
--   schema_v1's combatants_player_update is `using (side='party')` — it grants
--   the UPDATE to role `authenticated`, i.e. ANY logged-in user, gated only by
--   the column guard. Because OTP login is open, a profile-less "Guest" can
--   ALREADY write party hp/conditions/x/y/initiative today. That's latent now;
--   self-serve signup would ADVERTISE it. This delta closes it by requiring
--   is_member(), so a pending/guest login can't touch combat state until you
--   approve them.  ⚠ The `characters` table's party-write policy has the SAME
--   shape (CONTEXT: characters_party_update `using(true)`) but its SQL is NOT
--   in the repo — it lives only on live. It needs the identical is_member()
--   tightening; paste its live definition (Supabase → characters → Policies)
--   or commit the characters delta and I'll patch it as deploy #1b.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────
-- 1. COLUMNS
-- ─────────────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists grants   text[] not null default '{}';

-- No two members share a display name (nulls allowed — backfill leaves them
-- null for you to set on the page; nav.js falls back to the email local-part).
create unique index if not exists profiles_username_unique
  on public.profiles (lower(username)) where username is not null;


-- ─────────────────────────────────────────────────────────────────────────
-- 2. ROLE: allow 'pending' (a row that exists but holds no power)
-- ─────────────────────────────────────────────────────────────────────────
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add  constraint profiles_role_check
  check (role in ('overseer','dm','player','pending'));


-- ─────────────────────────────────────────────────────────────────────────
-- 3. is_member() — an APPROVED member (excludes pending + profile-less guests)
--    SECURITY DEFINER, mirroring is_staff()/is_overseer() (avoids RLS recursion).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role in ('overseer','dm','player')
  );
$$;
grant execute on function public.is_member() to authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 4. TIGHTEN player writes on combatants: members only (see SECURITY NOTE)
--    Same column-set as before; the guard trigger is unchanged. This only
--    narrows WHO may update party rows: approved members, not any login.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists combatants_player_update on public.combatants;
create policy combatants_player_update on public.combatants
  for update to authenticated
  using      (side = 'party' and public.is_member())
  with check (side = 'party' and public.is_member());


-- ─────────────────────────────────────────────────────────────────────────
-- 5. request_access(username) — self-serve onboarding (THE only self-write)
--    A new login creates its own pending row. SECURITY DEFINER bypasses the
--    overseer-only write policy, but the body hard-pins user_id = auth.uid()
--    and role = 'pending' — the client cannot smuggle in a role or a grant.
--    Idempotent: a second call (or a returning member) is a no-op, never a
--    downgrade.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.request_access(p_username text)
returns text language plpgsql security definer set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_name text;
begin
  if v_uid is null then
    raise exception 'must be signed in';
  end if;
  v_name := nullif(btrim(coalesce(p_username, '')), '');
  if v_name is not null then v_name := left(v_name, 40); end if;

  insert into public.profiles (user_id, role, username, grants)
  values (v_uid, 'pending', v_name, '{}')
  on conflict (user_id) do nothing;   -- never overwrite an existing account

  return 'ok';
end;
$$;
grant execute on function public.request_access(text) to authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 6. set_membership(...) — the overseer's write path
--    Self-gates on is_overseer() (a DM cannot hand out privileges). Releases a
--    character from any prior holder before assigning it (respects the
--    profiles_one_per_character partial-unique). Refuses to strip the LAST
--    overseer (you can't lock yourself out). Upserts, so a login that has an
--    auth.users row but no profile can be provisioned in one click.
--    grants are free-form labels: each is INERT until a feature checks it, so a
--    grant string can never over-permission on its own.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.set_membership(
  p_user_id      uuid,
  p_role         text,
  p_character_key text  default null,
  p_grants       text[] default '{}',
  p_username     text   default null
) returns void language plpgsql security definer set search_path = public
as $$
declare
  v_cur_role  text;
  v_overseers int;
begin
  if not public.is_overseer() then
    raise exception 'overseer only';
  end if;
  if p_role not in ('overseer','dm','player','pending') then
    raise exception 'invalid role: %', p_role;
  end if;
  if p_character_key is not null
     and p_character_key not in ('cosmere','caim','liadan','vesperian') then
    raise exception 'invalid character_key: %', p_character_key;
  end if;

  select role into v_cur_role from public.profiles where user_id = p_user_id;

  -- last-overseer guard
  if v_cur_role = 'overseer' and p_role <> 'overseer' then
    select count(*) into v_overseers from public.profiles where role = 'overseer';
    if v_overseers <= 1 then
      raise exception 'cannot remove the last overseer';
    end if;
  end if;

  -- release the character from whoever else holds it
  if p_character_key is not null then
    update public.profiles
       set character_key = null
     where character_key = p_character_key and user_id <> p_user_id;
  end if;

  insert into public.profiles (user_id, role, character_key, grants, username)
  values (p_user_id, p_role, p_character_key, coalesce(p_grants, '{}'), p_username)
  on conflict (user_id) do update set
    role          = excluded.role,
    character_key = excluded.character_key,
    grants        = excluded.grants,
    username      = coalesce(excluded.username, profiles.username);
end;
$$;
grant execute on function public.set_membership(uuid, text, text, text[], text) to authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 7. GRANTS (defensive / idempotent) — RLS still does the row gating
-- ─────────────────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.profiles to authenticated;
-- service_role (admin Netlify function) — matches the live grant_service_role fix
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update, delete on public.profiles to service_role;
  end if;
end $$;


-- ─────────────────────────────────────────────────────────────────────────
-- 8. REALTIME — stream profiles so the admin pending queue is live
--    (schema_v1 deliberately kept profiles OUT of realtime; the admin page
--    flips that. Full replica identity so updates carry the old row too.)
-- ─────────────────────────────────────────────────────────────────────────
alter table public.profiles replica identity full;
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
     ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;


-- ============================================================================
-- 9. BACKFILL — run-once, idempotent. Names the existing five accounts by
--    EMAIL (uid-agnostic, duplicate-safe: picks the most-recent sign-in), so it
--    ALSO fixes the DM-as-Guest problem and rebinds Cosmere correctly — no
--    access to anyone's computer, just your own SQL editor.
--    Usernames are LEFT NULL on purpose; set them on the page.
-- ============================================================================

-- release the four character seats before reassigning (one_per_character)
update public.profiles set character_key = null
 where character_key in ('cosmere','caim','liadan','vesperian');

with want(email, role, character_key) as (values
  ('thebraveruby@gmail.com',  'overseer', 'vesperian'),
  ('hagakuredisc@gmail.com',  'dm',       null),
  ('ianakira@gmail.com',      'player',   'cosmere'),
  ('jayvanmidde@gmail.com',   'player',   'caim'),
  ('nazanroseaktas@gmail.com','player',   'liadan')
),
pick as (
  select distinct on (lower(u.email))
         u.id as user_id,
         w.role,
         w.character_key::text as character_key
    from want w
    join auth.users u on lower(u.email) = lower(w.email)
   order by lower(u.email), u.last_sign_in_at desc nulls last
)
insert into public.profiles (user_id, role, character_key)
select user_id, role, character_key from pick
on conflict (user_id) do update set
  role          = excluded.role,
  character_key = excluded.character_key;

-- After running: verify the five rows look right —
--   select p.username, p.role, p.character_key, u.email
--   from public.profiles p join auth.users u on u.id = p.user_id
--   order by p.role, u.email;
