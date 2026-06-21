-- schema_delta_appearance.sql
-- ---------------------------------------------------------------------------
-- Per-player Appearance: each player saves their own background + effects look,
-- read back on every themed page. Stored as a jsonb blob on their profile.
--
-- Writes to `profiles` are OVERSEER-ONLY by design (schema_v1 profiles_overseer_write
-- — a player must not be able to change their own role/grants). So we DO NOT add a
-- self-update policy here. Instead a SECURITY DEFINER function, hard-pinned to
-- auth.uid(), lets a player update ONLY the appearance column and nothing else —
-- the same pattern used elsewhere for safe self-writes. Reads use the existing
-- profiles_read policy (all authenticated may select).
--
-- Idempotent. Safe to re-run.
-- ---------------------------------------------------------------------------

-- 1) the column
alter table public.profiles add column if not exists appearance jsonb;

-- 2) self-save RPC — updates only the caller's own appearance, nothing else
create or replace function public.set_my_appearance(p_appearance jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set appearance = p_appearance
   where id = auth.uid();
end;
$$;

-- 3) lock execution to signed-in users (the function itself enforces own-row only)
revoke all on function public.set_my_appearance(jsonb) from public;
revoke all on function public.set_my_appearance(jsonb) from anon;
grant execute on function public.set_my_appearance(jsonb) to authenticated;
