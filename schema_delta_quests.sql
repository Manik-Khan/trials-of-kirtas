-- schema_delta_quests.sql — durable shared quests, ordered objectives,
-- campaign-moment evidence, destinations, completion, and rewards.
-- Prepared 2026-08-20. Apply after schema_delta_campaign_moments.sql.
--
-- This first production slice is read-only for authenticated clients. Staff
-- creation and transition RPCs arrive only after the guarded reader is proven.

create table if not exists public.quests (
  id                    text primary key,
  schema_version        smallint not null default 1 check (schema_version = 1),
  title                 text not null check (btrim(title) <> ''),
  summary               text not null default '',
  public_hint           text not null default '',
  status                text not null default 'offered'
                        check (status in ('offered','active','completed','failed','archived')),
  visibility            text not null default 'party'
                        check (visibility in ('party','staff')),
  giver_id              text not null check (btrim(giver_id) <> ''),
  giver_label           text not null check (btrim(giver_label) <> ''),
  destination_location_id text,
  destination_label     text,
  destination_precision text not null default 'unlocated'
                        check (destination_precision in ('unlocated','approximate','confirmed')),
  offered_at            timestamptz not null default now(),
  completed_at          timestamptz,
  recorded_by           uuid default auth.uid() references auth.users(id) on delete set null,
  recorded_at           timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint quests_destination_truth check (
    (destination_precision = 'unlocated' and destination_location_id is null)
    or (destination_precision <> 'unlocated' and destination_location_id is not null
        and btrim(coalesce(destination_label,'')) <> '')
  ),
  constraint quests_completion_time check (
    status <> 'completed' or completed_at is not null
  )
);

create table if not exists public.quest_secrets (
  quest_id              text primary key references public.quests(id) on delete cascade,
  staff_truth           text not null default '',
  exact_location_id     text,
  exact_location_label  text,
  exact_map_x           numeric check (exact_map_x is null or (exact_map_x >= 0 and exact_map_x <= 100)),
  exact_map_y           numeric check (exact_map_y is null or (exact_map_y >= 0 and exact_map_y <= 100)),
  completion_truth      text not null default '',
  reward_truth          text not null default '',
  recorded_by           uuid default auth.uid() references auth.users(id) on delete set null,
  recorded_at           timestamptz not null default now(),
  constraint quest_secrets_exact_pair check (
    (exact_map_x is null and exact_map_y is null)
    or (exact_map_x is not null and exact_map_y is not null)
  ),
  constraint quest_secrets_exact_label check (
    exact_location_id is null or btrim(coalesce(exact_location_label,'')) <> ''
  )
);

create table if not exists public.quest_objectives (
  id                    text primary key,
  quest_id              text not null references public.quests(id) on delete cascade,
  position              smallint not null check (position > 0),
  title                 text not null check (btrim(title) <> ''),
  public_hint           text not null default '',
  state                 text not null default 'locked'
                        check (state in ('locked','current','complete','failed')),
  completed_at          timestamptz,
  recorded_by           uuid default auth.uid() references auth.users(id) on delete set null,
  recorded_at           timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (quest_id, position),
  constraint quest_objectives_completion_time check (
    state <> 'complete' or completed_at is not null
  )
);

create table if not exists public.quest_objective_evidence (
  id                    text primary key,
  objective_id          text not null references public.quest_objectives(id) on delete cascade,
  moment_id             text not null references public.campaign_moments(id) on delete restrict,
  note                  text not null default '',
  attached_by           uuid default auth.uid() references auth.users(id) on delete set null,
  attached_at           timestamptz not null default now(),
  unique (objective_id, moment_id)
);

create table if not exists public.quest_rewards (
  id                    text primary key,
  quest_id              text not null references public.quests(id) on delete cascade,
  position              smallint not null check (position > 0),
  kind                  text not null default 'other'
                        check (kind in ('currency','item','favor','access','reputation','other')),
  label                 text not null check (btrim(label) <> ''),
  detail                text not null default '',
  state                 text not null default 'promised'
                        check (state in ('promised','hidden','awarded','forfeited')),
  visibility            text not null default 'party'
                        check (visibility in ('party','staff')),
  awarded_at            timestamptz,
  recorded_by           uuid default auth.uid() references auth.users(id) on delete set null,
  recorded_at           timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (quest_id, position),
  constraint quest_rewards_hidden_staff check (state <> 'hidden' or visibility = 'staff'),
  constraint quest_rewards_awarded_time check (state <> 'awarded' or awarded_at is not null)
);

create index if not exists quests_status_idx
  on public.quests (status, offered_at desc, id);
create index if not exists quests_destination_idx
  on public.quests (destination_location_id, status) where destination_location_id is not null;
create index if not exists quest_objectives_quest_idx
  on public.quest_objectives (quest_id, position);
create index if not exists quest_evidence_objective_idx
  on public.quest_objective_evidence (objective_id, attached_at);
create index if not exists quest_evidence_moment_idx
  on public.quest_objective_evidence (moment_id);
create index if not exists quest_rewards_quest_idx
  on public.quest_rewards (quest_id, position);

create or replace function public.touch_quest_record()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists quests_touch on public.quests;
create trigger quests_touch before update on public.quests
  for each row execute function public.touch_quest_record();
drop trigger if exists quest_objectives_touch on public.quest_objectives;
create trigger quest_objectives_touch before update on public.quest_objectives
  for each row execute function public.touch_quest_record();
drop trigger if exists quest_rewards_touch on public.quest_rewards;
create trigger quest_rewards_touch before update on public.quest_rewards
  for each row execute function public.touch_quest_record();

-- A completed objective must have at least one durable campaign moment as
-- evidence. The deferred check permits the objective and its evidence link to
-- be created in either order inside one service transaction.
create or replace function public.enforce_quest_objective_evidence()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.state <> 'complete' and exists (
    select 1 from public.quests q where q.id = new.quest_id and q.status = 'completed'
  ) then
    raise exception 'a completed quest cannot contain an incomplete objective';
  end if;
  if new.state = 'complete' and not exists (
    select 1 from public.quest_objective_evidence e where e.objective_id = new.id
  ) then
    raise exception 'a completed quest objective requires campaign-moment evidence';
  end if;
  return new;
end $$;

drop trigger if exists quest_objective_evidence_required on public.quest_objectives;
create constraint trigger quest_objective_evidence_required
  after insert or update of state on public.quest_objectives
  deferrable initially deferred
  for each row execute function public.enforce_quest_objective_evidence();

-- A completed quest must contain objectives and every objective must already
-- be complete. Reward state remains independent so interim rewards are valid.
create or replace function public.enforce_quest_completion()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'completed' and (
    not exists (select 1 from public.quest_objectives o where o.quest_id = new.id)
    or exists (select 1 from public.quest_objectives o where o.quest_id = new.id and o.state <> 'complete')
  ) then
    raise exception 'a completed quest requires every objective to be complete';
  end if;
  return new;
end $$;

drop trigger if exists quest_completion_required on public.quests;
create constraint trigger quest_completion_required
  after insert or update of status on public.quests
  deferrable initially deferred
  for each row execute function public.enforce_quest_completion();

-- Keep that same invariant when objectives are inserted, moved, or removed
-- after their parent quest has already reached completed state.
create or replace function public.enforce_completed_quest_objective_set()
returns trigger language plpgsql set search_path = public as $$
declare
  parent_id text;
begin
  for parent_id in
    select distinct affected.quest_id
      from (values
        (case when tg_op <> 'DELETE' then new.quest_id end),
        (case when tg_op <> 'INSERT' then old.quest_id end)
      ) as affected(quest_id)
     where affected.quest_id is not null
  loop
    if exists (
      select 1
        from public.quests q
       where q.id = parent_id
         and q.status = 'completed'
         and (
           not exists (select 1 from public.quest_objectives o where o.quest_id = parent_id)
           or exists (
             select 1 from public.quest_objectives o
              where o.quest_id = parent_id and o.state <> 'complete'
           )
         )
    ) then
      raise exception 'a completed quest requires every objective to be complete';
    end if;
  end loop;
  return coalesce(new, old);
end $$;

drop trigger if exists completed_quest_objective_set on public.quest_objectives;
create constraint trigger completed_quest_objective_set
  after insert or update or delete on public.quest_objectives
  deferrable initially deferred
  for each row execute function public.enforce_completed_quest_objective_set();

-- Objective evidence is historical association. Corrections append a new
-- campaign moment; an attached evidence link is never silently rewritten.
create or replace function public.reject_quest_evidence_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'quest objective evidence is append-only';
end $$;

drop trigger if exists quest_evidence_append_only on public.quest_objective_evidence;
create trigger quest_evidence_append_only
  before update or delete on public.quest_objective_evidence
  for each row execute function public.reject_quest_evidence_mutation();

alter table public.quests enable row level security;
alter table public.quest_secrets enable row level security;
alter table public.quest_objectives enable row level security;
alter table public.quest_objective_evidence enable row level security;
alter table public.quest_rewards enable row level security;

drop policy if exists quests_select on public.quests;
create policy quests_select on public.quests for select to authenticated
  using (public.is_member() and (visibility = 'party' or public.is_staff()));

drop policy if exists quest_secrets_staff_select on public.quest_secrets;
create policy quest_secrets_staff_select on public.quest_secrets for select to authenticated
  using (public.is_staff());

drop policy if exists quest_objectives_select on public.quest_objectives;
create policy quest_objectives_select on public.quest_objectives for select to authenticated
  using (exists (
    select 1 from public.quests q where q.id = quest_id
      and public.is_member() and (q.visibility = 'party' or public.is_staff())
  ));

drop policy if exists quest_evidence_select on public.quest_objective_evidence;
create policy quest_evidence_select on public.quest_objective_evidence for select to authenticated
  using (exists (
    select 1
      from public.quest_objectives o
      join public.quests q on q.id = o.quest_id
      join public.campaign_moments m on m.id = moment_id
     where o.id = objective_id
       and public.is_member()
       and (q.visibility = 'party' or public.is_staff())
       and (m.visibility = 'party' or public.is_staff())
  ));

drop policy if exists quest_rewards_select on public.quest_rewards;
create policy quest_rewards_select on public.quest_rewards for select to authenticated
  using (exists (
    select 1 from public.quests q where q.id = quest_id
      and public.is_member()
      and (q.visibility = 'party' or public.is_staff())
      and (quest_rewards.visibility = 'party' or public.is_staff())
  ));

grant select on public.quests, public.quest_secrets, public.quest_objectives,
  public.quest_objective_evidence, public.quest_rewards to authenticated;
revoke insert, update, delete on public.quests, public.quest_secrets,
  public.quest_objectives, public.quest_objective_evidence, public.quest_rewards
  from authenticated;

do $$ begin
  alter publication supabase_realtime add table public.quests;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.quest_objectives;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.quest_objective_evidence;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.quest_rewards;
exception when duplicate_object then null;
end $$;

-- No illustrative quest IDs are seeded. The first field row is inserted only
-- after M reviews its real giver, destination, objective, evidence, and reward
-- identities. Authenticated clients remain readers until narrow staff RPCs are
-- separately approved.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update, delete on public.quests, public.quest_secrets,
      public.quest_objectives, public.quest_objective_evidence,
      public.quest_rewards to service_role;
  end if;
end $$;
