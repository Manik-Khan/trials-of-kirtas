-- schema_delta_living_codex.sql — Chronicle discoveries become shared codex rows.
-- Append-only. Run once after deploying the cache-stamped client files.

alter table public.entities add column if not exists role text;
alter table public.entities add column if not exists parent_id text;
alter table public.entities add column if not exists map_x numeric;
alter table public.entities add column if not exists map_y numeric;
alter table public.entities add column if not exists map_category text;
alter table public.entities add column if not exists map_shape text;
alter table public.entities add column if not exists map_state text;

alter table public.entities drop constraint if exists entities_map_x_check;
alter table public.entities add constraint entities_map_x_check
  check (map_x is null or (map_x >= 0 and map_x <= 100));
alter table public.entities drop constraint if exists entities_map_y_check;
alter table public.entities add constraint entities_map_y_check
  check (map_y is null or (map_y >= 0 and map_y <= 100));
alter table public.entities drop constraint if exists entities_map_state_check;
alter table public.entities add constraint entities_map_state_check
  check (map_state is null or map_state in ('nested','unmapped','placed'));

create index if not exists entities_parent_idx on public.entities (type, parent_id);
create index if not exists entities_curation_idx on public.entities (curated, type, created_at);

-- The NPC and World pages repaint when staff confirms or places a discovery.
do $$ begin
  alter publication supabase_realtime add table public.entities;
exception when duplicate_object then null;
end $$;

-- Walk a TipTap document and turn an old unresolved-NPC chip into a player-
-- character reference. Player characters never become `entities` rows.
create or replace function public.__living_rewrite_character_doc(
  n jsonb, p_old text, p_key text, p_label text
) returns jsonb
language plpgsql immutable
set search_path = public
as $$
declare el jsonb; arr jsonb := '[]'::jsonb;
begin
  if n is null then return n; end if;
  if jsonb_typeof(n) = 'array' then
    for el in select * from jsonb_array_elements(n) loop
      arr := arr || jsonb_build_array(public.__living_rewrite_character_doc(el, p_old, p_key, p_label));
    end loop;
    return arr;
  elsif jsonb_typeof(n) = 'object' then
    if n->>'type' = 'tokMention'
       and n->'attrs'->>'type' = 'npc'
       and n->'attrs'->>'id' = p_old then
      n := jsonb_set(n, '{attrs,id}', to_jsonb(p_key));
      n := jsonb_set(n, '{attrs,type}', '"character"'::jsonb);
      n := jsonb_set(n, '{attrs,label}', to_jsonb(p_label));
      n := jsonb_set(n, '{attrs,resolved}', 'true'::jsonb);
    end if;
    if n ? 'content' then
      n := jsonb_set(n, '{content}', public.__living_rewrite_character_doc(n->'content', p_old, p_key, p_label));
    end if;
    return n;
  end if;
  return n;
end $$;

create or replace function public.__living_rewrite_character_html(
  h text, p_old text, p_key text, p_label text
) returns text
language plpgsql immutable
set search_path = public
as $$
declare
  esc_label text;
  repl text;
  pat_tk text;
  pat_kt text;
begin
  if h is null or h = '' then return h; end if;
  esc_label := replace(replace(replace(replace(p_label,
    '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;');
  repl := '<span data-mention-type="character" data-mention-key="' || p_key
    || '" class="tok-mention character-link">@' || esc_label || '</span>';
  repl := replace(repl, '\', '\\');
  pat_tk := '<span[^>]*data-mention-type="npc(-unresolved)?"[^>]*data-mention-key="'
    || p_old || '"[^>]*>[^<]*</span>';
  pat_kt := '<span[^>]*data-mention-key="' || p_old
    || '"[^>]*data-mention-type="npc(-unresolved)?"[^>]*>[^<]*</span>';
  h := regexp_replace(h, pat_tk, repl, 'g');
  h := regexp_replace(h, pat_kt, repl, 'g');
  return h;
end $$;

-- One-time repair: names that were recorded as unresolved NPCs but already
-- exist in `characters` become character references automatically. This is
-- what repairs @Chonkalius without an overseer approval step.
do $$
declare
  c record;
  old_id text;
  ids text[];
begin
  for c in
    select key, coalesce(nullif(structural->>'name',''), key) as name
    from public.characters
    where not coalesce(delete_marked, false)
  loop
    ids := array[
      c.key,
      trim(both '-' from regexp_replace(lower(c.name), '[^a-z0-9]+', '-', 'g')),
      split_part(trim(both '-' from regexp_replace(lower(c.name), '[^a-z0-9]+', '-', 'g')), '-', 1),
      regexp_replace(c.key, '-[a-z0-9]{4}$', '')
    ];
    foreach old_id in array ids loop
      if coalesce(old_id, '') = '' then continue; end if;
      update public.journal_pages
         set doc = public.__living_rewrite_character_doc(doc, old_id, c.key, c.name),
             html = public.__living_rewrite_character_html(html, old_id, c.key, c.name)
       where (doc is not null and doc::text like '%"' || old_id || '"%')
          or (html is not null and html like '%data-mention-key="' || old_id || '"%');
      update public.feed
         set body = public.__living_rewrite_character_html(body, old_id, c.key, c.name)
       where body like '%data-mention-key="' || old_id || '"%';
      delete from public.journal_refs r
       where r.kind = 'entity' and r.ref_type = 'npc' and r.ref_id = old_id
         and exists (select 1 from public.journal_refs x
                      where x.page_id = r.page_id and x.kind = 'entity' and x.ref_id = c.key);
      update public.journal_refs
         set ref_type = 'character', ref_id = c.key, label = c.name
       where kind = 'entity' and ref_type = 'npc' and ref_id = old_id;
      delete from public.entities where type = 'npc' and id = old_id;
    end loop;
  end loop;
end $$;
