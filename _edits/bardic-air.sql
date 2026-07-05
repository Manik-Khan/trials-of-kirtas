-- ============================================================
-- bardic-air.sql — the broadcast heartbeat row (wave B.6, July 5)
-- Run BEFORE deploying the B.6 files (SQL first, per convention).
--
-- WHY A TABLE: the rail's on-air awareness rode a Realtime presence
-- socket, and iOS freezes sockets in background tabs without telling
-- the page — the phone's rail went permanently blind until refresh
-- (July 5 field reports, three in a row). A heartbeat ROW has no
-- socket to freeze: the engine writes it every 10s while on air,
-- and the rail simply reads it on load / wake / a 15s poll.
-- radio.html keeps Realtime (it needs live anchors anyway).
-- ============================================================

create table if not exists public.bardic_air (
  id             int primary key default 1 check (id = 1),   -- singleton row
  on_air         boolean not null default false,
  engine_name    text,
  listener_count int not null default 0,
  updated_at     timestamptz not null default now()
);

insert into public.bardic_air (id) values (1) on conflict (id) do nothing;

alter table public.bardic_air enable row level security;

-- every member may read; every member may write (same trust model as the
-- rest of the campaign tables — the DM's engine is just another member)
drop policy if exists bardic_air_read  on public.bardic_air;
drop policy if exists bardic_air_write on public.bardic_air;
create policy bardic_air_read  on public.bardic_air for select to authenticated using (true);
create policy bardic_air_write on public.bardic_air for update to authenticated using (true) with check (id = 1);
