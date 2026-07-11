-- schema_delta_forge_board.sql — FORGE_BOARD.md §3: players claim their own
-- unit. forge_sessions_overseer_write stays overseer-only; this RPC is the one
-- narrow door. Also: members must SEE forming fights to claim into them —
-- the old select policy required already-being-in-controllers (chicken/egg).
-- Idempotent and safe to re-run. Append-only: never edit schema_delta_forge.sql.
-- requires schema_delta_members.sql applied first (is_member).

-- 1. visibility: any approved member sees sessions (this Supabase is the
--    campaign's members only; events stay gated by their own policy)
drop policy if exists forge_sessions_select on public.forge_sessions;
create policy forge_sessions_select on public.forge_sessions
  for select to authenticated using (public.is_member());

-- 2. the claim door. SECURITY DEFINER: bypasses forge_sessions_overseer_write
--    for exactly this shape of write and nothing else.
create or replace function public.forge_claim_unit(p_session uuid, p_unit text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.forge_sessions;
  uid text := auth.uid()::text;
  in_roster boolean;
  claimed_by text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'why', 'not signed in'); end if;
  if not public.is_member() then return jsonb_build_object('ok', false, 'why', 'not a member'); end if;
  select * into s from public.forge_sessions where id = p_session for update;
  if not found then return jsonb_build_object('ok', false, 'why', 'no such fight'); end if;
  if s.status = 'ended' then return jsonb_build_object('ok', false, 'why', 'fight is over'); end if;
  select exists (select 1 from jsonb_array_elements(s.roster) r
                 where r->>'unit' = p_unit and coalesce(r->>'kind','pc') = 'pc') into in_roster;
  if not in_roster then return jsonb_build_object('ok', false, 'why', 'not a claimable character in this fight'); end if;
  -- jsonb ? on an array matches string elements — same idiom as the forge_events_insert gate (schema_delta_forge.sql).
  select k into claimed_by from jsonb_each(s.controllers) as e(k, v)
    where v ? p_unit limit 1;
  if claimed_by is not null and claimed_by <> uid then
    return jsonb_build_object('ok', false, 'why', 'already claimed');
  end if;
  update public.forge_sessions
     set controllers = jsonb_set(controllers, array[uid],
                        coalesce(controllers->uid, '[]'::jsonb) ||
                        case when coalesce(controllers->uid, '[]'::jsonb) ? p_unit
                             then '[]'::jsonb else to_jsonb(array[p_unit]) end)
   where id = p_session;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.forge_claim_unit(uuid, text) to authenticated;
