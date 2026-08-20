-- schema_delta_campaign_moment_item_links.sql — additive legacy item-event
-- associations plus the first two reviewed campaign moments.
-- Prepared 2026-08-20. Apply once after schema_delta_campaign_moments.sql.
-- This delta never updates public.item_events; their append-only source rows
-- remain unchanged.

begin;

create table if not exists public.campaign_moment_item_events (
  id             text primary key,
  moment_id      text not null references public.campaign_moments(id) on delete cascade,
  item_event_id  text not null references public.item_events(id) on delete restrict,
  recorded_by    uuid default auth.uid() references auth.users(id) on delete set null,
  recorded_at    timestamptz not null default now(),
  constraint campaign_moment_item_events_pair unique (moment_id, item_event_id),
  constraint campaign_moment_item_events_one_moment_per_event unique (item_event_id)
);

create index if not exists campaign_moment_item_events_moment_idx
  on public.campaign_moment_item_events (moment_id);

alter table public.campaign_moment_item_events enable row level security;

drop policy if exists campaign_moment_item_events_select on public.campaign_moment_item_events;
create policy campaign_moment_item_events_select on public.campaign_moment_item_events
  for select to authenticated
  using (
    public.is_member()
    and exists (
      select 1
        from public.campaign_moments m
       where m.id = moment_id
         and (m.visibility = 'party' or public.is_staff())
    )
  );

grant select on public.campaign_moment_item_events to authenticated;
revoke insert, update, delete on public.campaign_moment_item_events from authenticated;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update, delete on public.campaign_moment_item_events to service_role;
  end if;
end $$;

-- Fail closed if any reviewed identity has moved or no longer says what the
-- resolver proved. A failed assertion rolls back the entire delta.
do $$ begin
  if not exists (
    select 1 from public.feed
     where id = 449
       and session = 8
       and encounter_id = '84b36678-21b3-4a64-baf5-96a3d1c3475f'::uuid
       and created_at = '2026-08-12T04:56:40.189698+00:00'::timestamptz
  ) then
    raise exception 'feed 449 no longer matches the reviewed unopened-satchel fact';
  end if;

  if not exists (
    select 1 from public.encounters e
    join public.scenes s on s.key = e.map_ref
     where e.id = '84b36678-21b3-4a64-baf5-96a3d1c3475f'::uuid
       and s.id = 'ce811962-031d-431d-bc2d-ebcdb83693d1'::uuid
  ) then
    raise exception 'the reviewed encounter-to-scene identity no longer matches';
  end if;

  if not exists (
    select 1 from public.entities
     where id = 'veren-s-watch' and type = 'location'
  ) then
    raise exception 'Living Codex location veren-s-watch is unavailable';
  end if;

  if not exists (
    select 1 from public.item_events
     where id = 'itemev_4b983df8-a75c-4601-aefe-73849ec8d759'
       and item_id = 'item_876939c0-74c5-4cd2-9c45-35308cec409b'
       and event_type = 'recovered'
       and session_id = '8'
       and location_id = 'veren-s-watch'
       and moment_id is null
  ) then
    raise exception 'the reviewed Skyblinder recovery event no longer matches';
  end if;
end $$;

insert into public.campaign_moments (
  id, kind, also, title, summary, occurred_at, session_id, location_id,
  map_precision, party_present, visibility, feed_post_id, encounter_id, scene_id
) values (
  'moment-s8-unopened-satchel',
  'treasure',
  array['battle']::text[],
  'The chieftain''s unopened satchel was recovered',
  'The party took an unopened satchel from the bugbear chieftain. Its contents remain unknown.',
  '2026-08-12T04:56:40.189698+00:00'::timestamptz,
  8,
  'veren-s-watch',
  'confirmed',
  true,
  'party',
  449,
  '84b36678-21b3-4a64-baf5-96a3d1c3475f'::uuid,
  'ce811962-031d-431d-bc2d-ebcdb83693d1'::uuid
) on conflict (id) do nothing;

insert into public.campaign_moments (
  id, kind, also, title, summary, occurred_at, session_id, location_id,
  map_precision, party_present, visibility
) values (
  'moment-s8-skyblinder-recovered',
  'treasure',
  '{}'::text[],
  'Skyblinder Staff was recovered',
  'Skyblinder Staff was recovered at Veren''s Watch. It was not inside the unopened satchel.',
  '2026-08-17T17:06:50.305971+00:00'::timestamptz,
  8,
  'veren-s-watch',
  'confirmed',
  true,
  'party'
) on conflict (id) do nothing;

insert into public.campaign_moment_item_events (id, moment_id, item_event_id)
values (
  'momentitemlink-s8-skyblinder-recovered',
  'moment-s8-skyblinder-recovered',
  'itemev_4b983df8-a75c-4601-aefe-73849ec8d759'
) on conflict (id) do nothing;

-- Refuse to accept a prior partial run or a conflicting row with one of these
-- durable identities.
do $$ begin
  if not exists (
    select 1 from public.campaign_moments
     where id = 'moment-s8-unopened-satchel'
       and feed_post_id = 449
       and encounter_id = '84b36678-21b3-4a64-baf5-96a3d1c3475f'::uuid
       and scene_id = 'ce811962-031d-431d-bc2d-ebcdb83693d1'::uuid
       and location_id = 'veren-s-watch'
       and journal_page_id is null
  ) then
    raise exception 'unopened-satchel moment conflicts with the reviewed fact';
  end if;

  if not exists (
    select 1 from public.campaign_moments
     where id = 'moment-s8-skyblinder-recovered'
       and location_id = 'veren-s-watch'
       and feed_post_id is null
       and journal_page_id is null
       and encounter_id is null
       and scene_id is null
       and forge_session_id is null
  ) then
    raise exception 'Skyblinder moment contains an unreviewed cross-section link';
  end if;

  if not exists (
    select 1 from public.campaign_moment_item_events
     where id = 'momentitemlink-s8-skyblinder-recovered'
       and moment_id = 'moment-s8-skyblinder-recovered'
       and item_event_id = 'itemev_4b983df8-a75c-4601-aefe-73849ec8d759'
  ) then
    raise exception 'Skyblinder legacy association conflicts with the reviewed identities';
  end if;
end $$;

commit;

select jsonb_pretty(jsonb_build_object(
  'status', 'installed_review_two_facts',
  'moments', (
    select jsonb_agg(to_jsonb(m) order by m.occurred_at, m.id)
      from public.campaign_moments m
     where m.id in ('moment-s8-unopened-satchel', 'moment-s8-skyblinder-recovered')
  ),
  'item_event_links', (
    select jsonb_agg(to_jsonb(l) order by l.id)
      from public.campaign_moment_item_events l
     where l.id = 'momentitemlink-s8-skyblinder-recovered'
  ),
  'source_item_event', (
    select to_jsonb(e)
      from public.item_events e
     where e.id = 'itemev_4b983df8-a75c-4601-aefe-73849ec8d759'
  )
)) as campaign_moment_item_link_evidence;
