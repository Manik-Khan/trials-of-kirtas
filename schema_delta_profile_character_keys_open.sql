-- schema_delta_profile_character_keys_open.sql
-- ───────────────────────────────────────────────────────────────────────────
-- Follow-up to the July character-source audit.
--
-- characters.key was opened for Forge-generated keys, but profiles.character_key
-- and set_membership() still accepted only the four original aliases. That made
-- audited Cosmere (cosmererunestar-ae1a) impossible to attach from Admin.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.profiles drop constraint if exists profiles_character_key_check;

create or replace function public.set_membership(
  p_user_id       uuid,
  p_role          text,
  p_character_key text   default null,
  p_grants        text[] default '{}',
  p_username      text   default null
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
  if p_character_key is not null and not exists (
    select 1
      from public.characters c
     where c.key = p_character_key
       and not coalesce(c.delete_marked, false)
  ) then
    raise exception 'invalid character_key: %', p_character_key;
  end if;

  select role into v_cur_role from public.profiles where user_id = p_user_id;

  if v_cur_role = 'overseer' and p_role <> 'overseer' then
    select count(*) into v_overseers from public.profiles where role = 'overseer';
    if v_overseers <= 1 then
      raise exception 'cannot remove the last overseer';
    end if;
  end if;

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

-- Repair Cosmere's seat by account, preserving the account's existing role,
-- grants, and username. Idempotent; it quietly does nothing if either live row
-- has not been created yet.
do $$
declare
  v_user_id uuid;
begin
  select u.id into v_user_id
    from auth.users u
   where lower(u.email) = 'ianakira@gmail.com'
   order by u.last_sign_in_at desc nulls last
   limit 1;

  if v_user_id is not null and exists (
    select 1 from public.characters c
     where c.key = 'cosmererunestar-ae1a'
       and not coalesce(c.delete_marked, false)
  ) then
    update public.profiles
       set character_key = null
     where character_key = 'cosmererunestar-ae1a'
       and user_id <> v_user_id;

    insert into public.profiles (user_id, role, character_key)
    values (v_user_id, 'player', 'cosmererunestar-ae1a')
    on conflict (user_id) do update set
      character_key = excluded.character_key;
  end if;
end
$$;
