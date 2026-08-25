-- schema_delta_quest_authoring.sql — member quest creation + durable start receipt.
-- Prepared 2026-08-24. NOT YET APPLIED.
-- Apply after schema_delta_quests.sql and schema_delta_quest_reader_privileges.sql.
--
-- Every approved campaign member may create one party-visible active quest with
-- one current objective. The quest, objective, and append-only Quest Begun
-- receipt commit together through create_quest(); authenticated clients retain
-- SELECT-only table privileges. Chronicle and Journal prose stay in their own
-- records and are linked by identity rather than copied into the receipt.

-- A discovered quest may have no giver. Keep the pair honest when one exists.
alter table public.quests alter column giver_id drop not null;
alter table public.quests alter column giver_label drop not null;

do $$ begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.quests'::regclass
       and conname = 'quests_giver_pair'
  ) then
    alter table public.quests add constraint quests_giver_pair check (
      (giver_id is null and giver_label is null)
      or (btrim(giver_id) <> '' and btrim(giver_label) <> '')
    ) not valid;
  end if;
end $$;
alter table public.quests validate constraint quests_giver_pair;

create table if not exists public.quest_starts (
  id                    uuid primary key,
  quest_id              text not null unique references public.quests(id) on delete restrict,
  origin                text not null check (origin in ('chronicle','journal','hub')),
  occurred_at           timestamptz not null default now(),
  session_id            int,
  -- Typed historical identities deliberately have no cascading FK. Chronicle
  -- and Journal authors retain their existing delete rights; an unavailable
  -- source leaves an honest unresolved link instead of rewriting this receipt.
  feed_post_id          bigint,
  journal_page_id       uuid,
  started_by            uuid not null default auth.uid(),
  recorded_at           timestamptz not null default now(),
  constraint quest_starts_origin_source check (
    (origin = 'chronicle' and feed_post_id is not null)
    or (origin = 'journal' and journal_page_id is not null and feed_post_id is null)
    or (origin = 'hub' and feed_post_id is null and journal_page_id is null)
  )
);

create index if not exists quest_starts_story_time_idx
  on public.quest_starts (session_id, occurred_at, id);
create index if not exists quest_starts_feed_idx
  on public.quest_starts (feed_post_id) where feed_post_id is not null;
create index if not exists quest_starts_journal_idx
  on public.quest_starts (journal_page_id) where journal_page_id is not null;

-- Quest Begun is a historical receipt. Corrections create a later explicit
-- event; the original receipt is never silently rewritten or deleted.
create or replace function public.reject_quest_start_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'quest starts are append-only';
end $$;

drop trigger if exists quest_starts_append_only on public.quest_starts;
create trigger quest_starts_append_only
  before update or delete on public.quest_starts
  for each row execute function public.reject_quest_start_mutation();

alter table public.quest_starts enable row level security;

drop policy if exists quest_starts_select on public.quest_starts;
create policy quest_starts_select on public.quest_starts for select to authenticated
  using (exists (
    select 1 from public.quests q
     where q.id = quest_id
       and public.is_member()
       and (q.visibility = 'party' or public.is_staff())
  ));

-- Supabase default privileges vary by project. Clear them before restoring the
-- one capability the reader needs; create_quest() is the only member write seam.
revoke all privileges on table public.quest_starts from anon, authenticated;
grant select on table public.quest_starts to authenticated;

create or replace function public.create_quest(
  p_request_id             uuid,
  p_title                  text,
  p_description            text,
  p_objective              text,
  p_giver_id               text   default null,
  p_giver_label            text   default null,
  p_location_id            text   default null,
  p_location_label         text   default null,
  p_origin                 text   default 'hub',
  p_source_feed_post_id    bigint default null,
  p_source_journal_page_id uuid   default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid                uuid := auth.uid();
  v_now                timestamptz := now();
  v_title              text;
  v_description        text;
  v_objective_title    text;
  v_giver_id           text;
  v_giver_label        text;
  v_location_id        text;
  v_location_label     text;
  v_origin             text;
  v_session_id         int;
  v_feed_meta          jsonb;
  v_quest_id           text;
  v_objective_id       text;
  v_quest              public.quests%rowtype;
  v_objective          public.quest_objectives%rowtype;
  v_start              public.quest_starts%rowtype;
begin
  if v_uid is null then
    raise exception 'You must be signed in to create a quest.';
  end if;
  if not public.is_member() then
    raise exception 'Only an approved campaign member may create a quest.';
  end if;
  if p_request_id is null then
    raise exception 'A quest request id is required.';
  end if;

  v_title := nullif(btrim(coalesce(p_title, '')), '');
  v_description := nullif(btrim(coalesce(p_description, '')), '');
  v_objective_title := nullif(btrim(coalesce(p_objective, '')), '');
  v_giver_id := nullif(btrim(coalesce(p_giver_id, '')), '');
  v_giver_label := nullif(btrim(coalesce(p_giver_label, '')), '');
  v_location_id := nullif(btrim(coalesce(p_location_id, '')), '');
  v_location_label := nullif(btrim(coalesce(p_location_label, '')), '');
  v_origin := lower(coalesce(nullif(btrim(p_origin), ''), 'hub'));

  if v_title is null then raise exception 'A quest name is required.'; end if;
  if v_description is null then raise exception 'A quest description is required.'; end if;
  if v_objective_title is null then raise exception 'One clear objective is required.'; end if;
  if length(v_title) > 160 then raise exception 'Keep the quest name under 160 characters.'; end if;
  if length(v_description) > 5000 then raise exception 'Keep the quest description under 5000 characters.'; end if;
  if length(v_objective_title) > 500 then raise exception 'Keep the first objective under 500 characters.'; end if;
  if num_nonnulls(v_giver_id, v_giver_label) = 1 then
    raise exception 'Choose both the quest giver identity and name, or leave both blank.';
  end if;
  if num_nonnulls(v_location_id, v_location_label) = 1 then
    raise exception 'Choose both the location identity and name, or leave both blank.';
  end if;
  if greatest(
    length(coalesce(v_giver_id, '')), length(coalesce(v_giver_label, '')),
    length(coalesce(v_location_id, '')), length(coalesce(v_location_label, ''))
  ) > 200 then
    raise exception 'Quest giver and location references must stay under 200 characters.';
  end if;
  if v_origin not in ('chronicle','journal','hub') then
    raise exception 'Quest origin must be Chronicle, Journal, or Quest Hub.';
  end if;
  if v_origin = 'chronicle' and p_source_feed_post_id is null then
    raise exception 'A Chronicle quest must link its source entry.';
  end if;
  if v_origin = 'journal' and (p_source_journal_page_id is null or p_source_feed_post_id is not null) then
    raise exception 'A Journal quest must link one Journal page, not a Chronicle entry.';
  end if;
  if v_origin = 'hub' and (p_source_feed_post_id is not null or p_source_journal_page_id is not null) then
    raise exception 'A Quest Hub quest begins without an invented Chronicle or Journal source.';
  end if;

  -- The request id is also the start-receipt identity. Serializing retries lets
  -- a client safely repeat the exact call after a lost response.
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  v_quest_id := 'quest-' || p_request_id::text;
  v_objective_id := 'quest-objective-' || p_request_id::text;

  select * into v_start from public.quest_starts where id = p_request_id;
  if found then
    select * into v_quest from public.quests where id = v_start.quest_id;
    select * into v_objective from public.quest_objectives
     where quest_id = v_start.quest_id and position = 1;
    if v_start.started_by is distinct from v_uid then
      raise exception 'That quest request id is already in use.';
    end if;
    if v_quest.title is distinct from v_title
       or v_quest.summary is distinct from v_description
       or v_quest.giver_id is distinct from v_giver_id
       or v_quest.giver_label is distinct from v_giver_label
       or v_quest.destination_location_id is distinct from v_location_id
       or v_quest.destination_label is distinct from v_location_label
       or v_objective.title is distinct from v_objective_title
       or v_start.origin is distinct from v_origin
       or v_start.feed_post_id is distinct from p_source_feed_post_id
       or v_start.journal_page_id is distinct from p_source_journal_page_id then
      raise exception 'That quest request id was already used for different details.';
    end if;
    return jsonb_build_object(
      'ok', true, 'retried', true,
      'quest', to_jsonb(v_quest),
      'objective', to_jsonb(v_objective),
      'start', to_jsonb(v_start)
    );
  end if;

  if v_origin = 'chronicle' then
    select f.session, f.meta
      into v_session_id, v_feed_meta
      from public.feed f
     where f.id = p_source_feed_post_id
       and f.channel = 'chronicle'
       and not f.hidden;
    if not found then
      raise exception 'The Chronicle source entry is unavailable or private.';
    end if;
    if p_source_journal_page_id is not null then
      perform 1 from public.journal_pages p where p.id = p_source_journal_page_id;
      if not found then raise exception 'The linked Journal page does not exist.'; end if;
      if nullif(v_feed_meta ->> 'journal_page_id', '') is null
         or v_feed_meta ->> 'journal_page_id' <> p_source_journal_page_id::text then
        raise exception 'The Chronicle entry does not point to that Journal page.';
      end if;
    end if;
  elsif v_origin = 'journal' then
    select p.session into v_session_id
      from public.journal_pages p
     where p.id = p_source_journal_page_id;
    if not found then raise exception 'The linked Journal page does not exist.'; end if;
  end if;

  if v_session_id is null then
    select c.current_session into v_session_id from public.campaign c where c.id = 1;
  end if;

  insert into public.quests (
    id, title, summary, public_hint, status, visibility,
    giver_id, giver_label, destination_location_id, destination_label,
    destination_precision, offered_at, recorded_by, recorded_at, updated_at
  ) values (
    v_quest_id, v_title, v_description, '', 'active', 'party',
    v_giver_id, v_giver_label, v_location_id, v_location_label,
    case when v_location_id is null then 'unlocated' else 'confirmed' end,
    v_now, v_uid, v_now, v_now
  ) returning * into v_quest;

  insert into public.quest_objectives (
    id, quest_id, position, title, public_hint, state,
    recorded_by, recorded_at, updated_at
  ) values (
    v_objective_id, v_quest_id, 1, v_objective_title, '', 'current',
    v_uid, v_now, v_now
  ) returning * into v_objective;

  insert into public.quest_starts (
    id, quest_id, origin, occurred_at, session_id,
    feed_post_id, journal_page_id, started_by, recorded_at
  ) values (
    p_request_id, v_quest_id, v_origin, v_now, v_session_id,
    p_source_feed_post_id, p_source_journal_page_id, v_uid, v_now
  ) returning * into v_start;

  return jsonb_build_object(
    'ok', true, 'retried', false,
    'quest', to_jsonb(v_quest),
    'objective', to_jsonb(v_objective),
    'start', to_jsonb(v_start)
  );
end;
$$;

revoke all on function public.create_quest(
  uuid, text, text, text, text, text, text, text, text, bigint, uuid
) from public, anon;
grant execute on function public.create_quest(
  uuid, text, text, text, text, text, text, text, text, bigint, uuid
) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.quest_starts;
exception when duplicate_object then null;
end $$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert on public.quest_starts to service_role;
  end if;
end $$;
