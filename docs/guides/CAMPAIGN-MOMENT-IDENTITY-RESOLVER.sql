-- CAMPAIGN-MOMENT-IDENTITY-RESOLVER.sql — READ ONLY. Run only after
-- CAMPAIGN-MOMENT-PREFLIGHT.sql reports ready_to_apply or
-- installed_review_security. It returns recent real identity candidates in
-- one JSON cell; it does not choose or link a campaign fact.

with
recent_feed as (
  select id, session, encounter_id, channel, kind, actor_name, body, created_at
    from public.feed
   order by created_at desc, id desc
   limit 40
),
shared_journal as (
  select id, character_key, title, slug, session, shared_feed_id, created_at
    from public.journal_pages
   where shared_feed_id is not null
   order by created_at desc, id
   limit 40
),
encounter_scenes as (
  select e.id as encounter_id, e.name as encounter_name, e.status,
         e.map_ref, s.id as scene_id, s.key as scene_key, s.name as scene_name,
         e.created_at
    from public.encounters e
    left join public.scenes s on s.key = e.map_ref
   order by e.created_at desc, e.id
   limit 40
),
forge_candidates as (
  select id, status, created_at
    from public.forge_sessions
   order by created_at desc, id
   limit 20
),
living_locations as (
  select id, name, status, curated, parent_id, map_x, map_y,
         map_category, map_shape, map_state, created_at
    from public.entities
   where type = 'location'
   order by created_at desc, id
   limit 80
),
recent_item_events as (
  select e.id, e.item_id, i.display_name, e.event_type, e.summary,
         e.occurred_at, e.session_id, e.location_id, e.moment_id,
         e.encounter_id, e.journal_page_id, e.feed_post_id, e.battle_map_id
    from public.item_events e
    join public.item_instances i on i.id = e.item_id
   order by e.occurred_at desc, e.sequence desc
   limit 80
)
select jsonb_pretty(jsonb_build_object(
  'recent_feed', coalesce(
    (select jsonb_agg(to_jsonb(r) order by r.created_at desc, r.id desc) from recent_feed r),
    '[]'::jsonb
  ),
  'shared_journal', coalesce(
    (select jsonb_agg(to_jsonb(r) order by r.created_at desc, r.id) from shared_journal r),
    '[]'::jsonb
  ),
  'encounter_scenes', coalesce(
    (select jsonb_agg(to_jsonb(r) order by r.created_at desc, r.encounter_id) from encounter_scenes r),
    '[]'::jsonb
  ),
  'forge_sessions', coalesce(
    (select jsonb_agg(to_jsonb(r) order by r.created_at desc, r.id) from forge_candidates r),
    '[]'::jsonb
  ),
  'living_codex_locations', coalesce(
    (select jsonb_agg(to_jsonb(r) order by r.created_at desc, r.id) from living_locations r),
    '[]'::jsonb
  ),
  'recent_item_events', coalesce(
    (select jsonb_agg(to_jsonb(r) order by r.occurred_at desc, r.id) from recent_item_events r),
    '[]'::jsonb
  ),
  'warning', 'item_events are append-only: choose an event whose moment_id already matches, or stop and record a new real event through an approved path; never update an old event to manufacture the link'
)) as campaign_moment_identity_candidates;
