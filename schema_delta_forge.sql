-- schema_delta_forge.sql — Battle Forge event protocol (FORGE_PROTOCOL.md §1)
-- Append-only event log: state is derived by replay; rows are never updated
-- or deleted. RLS gate = identity + actor pinning + the privileged-kind guard:
-- session active AND (overseer OR (unit ∈ controllers[actor] AND kind is not
-- overseer-only)). Twin of the gate() in forge/forge-bus.js: keep them in step.
-- Idempotent and safe to re-run.

create table if not exists public.forge_sessions (
  id          uuid primary key default gen_random_uuid(),
  overseer    uuid not null,
  map         jsonb not null,                     -- {seed, theme, sliders}
  roster      jsonb not null,                     -- [{unit, kind, sheet_ref|bestiary_ref}]
  controllers jsonb not null default '{}'::jsonb, -- {auth_uid: [unit,...]}
  status      text not null default 'staging'
              check (status in ('staging','active','ended')),
  created_at  timestamptz not null default now()
);

-- id is bigint identity: insert order IS seq (rev 2). Rejected inserts (RLS
-- denial, constraint failure) can still consume an id, so ids may have gaps —
-- order-equivalent to the JS bus's seq, not gap-equivalent.
create table if not exists public.forge_events (
  id          bigint generated always as identity primary key,
  session_id  uuid not null references public.forge_sessions(id),
  unit        text not null,
  actor       uuid not null default auth.uid(),
  kind        text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists forge_events_session on public.forge_events (session_id, id);

alter table public.forge_sessions enable row level security;
alter table public.forge_events  enable row level security;

-- ── RLS ────────────────────────────────────────────────────────────────────

-- session members: the overseer or anyone in controllers
drop policy if exists forge_sessions_select on public.forge_sessions;
create policy forge_sessions_select on public.forge_sessions
  for select to authenticated
  using (overseer = auth.uid() or controllers ? auth.uid()::text);

drop policy if exists forge_sessions_overseer_write on public.forge_sessions;
create policy forge_sessions_overseer_write on public.forge_sessions
  for all to authenticated
  using (overseer = auth.uid())
  with check (overseer = auth.uid());

drop policy if exists forge_events_select on public.forge_events;
create policy forge_events_select on public.forge_events
  for select to authenticated
  using (
    exists (select 1 from public.forge_sessions s where s.id = session_id
            and (s.overseer = auth.uid() or s.controllers ? auth.uid()::text))
  );

-- THE identity gate (spec §1): actor pinned to auth.uid() AND live session AND
-- (overseer, who may write anything, OR you control the unit AND the kind is
-- not one of the six privileged/overseer-only kinds). No update/delete
-- policies exist: the log is append-only by construction.
drop policy if exists forge_events_insert on public.forge_events;
create policy forge_events_insert on public.forge_events
  for insert to authenticated
  with check (
    forge_events.actor = auth.uid()
    and exists (select 1 from public.forge_sessions s where s.id = session_id
            and s.status = 'active'
            and (s.overseer = auth.uid()
                 or (forge_events.kind not in
                       ('session_started','initiative_set','session_ended','override','restore','edit')
                     and s.controllers -> auth.uid()::text ? forge_events.unit)))
  );

-- RLS gates; this grant just exposes the tables to the API role (house style).
grant select, insert, update on public.forge_sessions to authenticated;
grant select, insert on public.forge_events to authenticated;

-- Join the realtime publication so inserts stream to every client.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'forge_events'
  ) then
    alter publication supabase_realtime add table public.forge_events;
  end if;
end $$;
