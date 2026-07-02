-- schema_delta_journal_org.sql  (the organization arc — Phase 3)
--
-- Four pieces:
--   journal_pages.sort_order : drag-reorder within a section. Nulls-last so
--                              existing rows need no backfill; the client
--                              writes contiguous 0..n on each reorder.
--   entity_aliases           : typo → canon map. After a merge, future typing
--                              of the old key resolves to the canonical
--                              entity instead of re-seeding the stub.
--   canonize_entity()        : the same-key resolve-flip. Marks the entity
--                              curated and repaints every chip it ever
--                              produced (journal docs + html caches + feed
--                              bodies) from dashed-unresolved to solid.
--   merge_entity()           : folds a stub into a canonical entity. Rewrites
--                              chip NODES in docs (never prose), the
--                              deterministic spans in html caches and
--                              journal_refs; feed bodies only when asked
--                              (chat is a record of what was said); leaves
--                              the old key as an alias; deletes the stub.
--
-- Both functions are SECURITY DEFINER (journal_pages updates are author-only
-- under RLS — repainting other authors' caches requires definer rights) and
-- self-gate on public.is_staff() — call them from the BROWSER with the
-- user's session token, never with the service key (service role has no
-- auth.uid(), so the gate would fail by design).
--
-- House rules honored: explicit GRANTs to authenticated; is_staff() gates;
-- no touch to the characters table; idempotent — safe to re-run.

-- ── sort_order ──────────────────────────────────────────────────────────────
alter table public.journal_pages
  add column if not exists sort_order int;

-- ── entity_aliases ──────────────────────────────────────────────────────────
create table if not exists public.entity_aliases (
  type         text not null check (type in ('npc','location')),
  alias_id     text not null,                     -- the retired slug
  canonical_id text not null,                     -- what it resolves to now
  created_at   timestamptz not null default now(),
  primary key (type, alias_id)
);

grant select, insert, update, delete on public.entity_aliases to authenticated;

alter table public.entity_aliases enable row level security;

drop policy if exists entity_aliases_select on public.entity_aliases;
create policy entity_aliases_select on public.entity_aliases
  for select to authenticated using (true);       -- the map is shared knowledge

-- writes happen inside merge_entity (definer); the policy is staff for hygiene
drop policy if exists entity_aliases_write on public.entity_aliases;
create policy entity_aliases_write on public.entity_aliases
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ── chip rewrite helpers (internal) ─────────────────────────────────────────
-- Walk a TipTap doc and rewrite tokMention nodes matching (type, old id):
-- new id, new label, resolved=true. Chip NODES only — prose is never touched.
create or replace function public.__journal_rewrite_mention(
  n jsonb, p_type text, p_old text, p_canon text, p_label text
) returns jsonb
language plpgsql immutable
set search_path = public
as $$
declare
  el  jsonb;
  arr jsonb := '[]'::jsonb;
begin
  if n is null then return n; end if;
  if jsonb_typeof(n) = 'array' then
    for el in select * from jsonb_array_elements(n) loop
      arr := arr || jsonb_build_array(
        public.__journal_rewrite_mention(el, p_type, p_old, p_canon, p_label));
    end loop;
    return arr;
  elsif jsonb_typeof(n) = 'object' then
    if n->>'type' = 'tokMention'
       and n->'attrs'->>'type' = p_type
       and n->'attrs'->>'id'   = p_old then
      n := jsonb_set(n, '{attrs,id}',       to_jsonb(p_canon));
      n := jsonb_set(n, '{attrs,label}',    to_jsonb(p_label));
      n := jsonb_set(n, '{attrs,resolved}', 'true'::jsonb);
    end if;
    if n ? 'content' then
      n := jsonb_set(n, '{content}',
        public.__journal_rewrite_mention(n->'content', p_type, p_old, p_canon, p_label));
    end if;
    return n;
  else
    return n;
  end if;
end $$;

-- Rewrite every chip SPAN for (type, old id) in an html cache / feed body to
-- the canonical resolved span (docToHTML shape — both the chronicle's
-- processEntryHTML and the journal CSS understand it). Attribute-order
-- independent: matches type-before-key and key-before-type emissions.
create or replace function public.__journal_rewrite_chip_html(
  h text, p_type text, p_old text, p_canon text, p_label text
) returns text
language plpgsql immutable
set search_path = public
as $$
declare
  esc_label text;
  repl      text;
  pat_tk    text;  -- type ... key
  pat_kt    text;  -- key ... type
begin
  if h is null or h = '' then return h; end if;
  -- html-escape the label, then escape regexp_replace's specials (\ then &)
  esc_label := replace(replace(replace(replace(p_label,
                 '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;');
  repl := '<span data-mention-type="' || p_type
       || '" data-mention-key="' || p_canon
       || '" class="tok-mention '
       || case p_type when 'npc' then 'npc-link' else 'location-link' end
       || '">@' || esc_label || '</span>';
  -- Postgres regexp_replace replacement escapes: \1..\9 backrefs, \& whole
  -- match; bare & is LITERAL (unlike Oracle). Only backslashes need doubling.
  repl := replace(repl, '\', '\\');
  pat_tk := '<span[^>]*data-mention-type="' || p_type
         || '(-unresolved)?"[^>]*data-mention-key="' || p_old
         || '"[^>]*>[^<]*</span>';
  pat_kt := '<span[^>]*data-mention-key="' || p_old
         || '"[^>]*data-mention-type="' || p_type
         || '(-unresolved)?"[^>]*>[^<]*</span>';
  h := regexp_replace(h, pat_tk, repl, 'g');
  h := regexp_replace(h, pat_kt, repl, 'g');
  return h;
end $$;

-- ── canonize_entity: the same-key resolve-flip ──────────────────────────────
-- "Okay, this @" — marks the entity curated and lights up every dashed chip
-- it ever produced, everywhere (docs, html caches, feed bodies). Label
-- repaints to the entity's current name (the stub's name IS the typed label
-- unless staff edited it first — which is a deliberate act).
create or replace function public.canonize_entity(p_type text, p_id text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_name  text;
  n_pages int := 0;
  n_feed  int := 0;
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;
  if p_id !~ '^[a-z0-9-]+$' or p_type not in ('npc','location') then
    raise exception 'bad entity key';
  end if;

  select name into v_name from public.entities
    where type = p_type and id = p_id;
  if v_name is null then
    raise exception 'no such entity %:%', p_type, p_id;
  end if;

  update public.entities set curated = true
    where type = p_type and id = p_id;

  update public.journal_pages
     set doc  = public.__journal_rewrite_mention(doc, p_type, p_id, p_id, v_name),
         html = public.__journal_rewrite_chip_html(html, p_type, p_id, p_id, v_name)
   where (doc is not null and doc::text like '%"' || p_id || '"%')
      or (html is not null and html like '%data-mention-key="' || p_id || '"%');
  get diagnostics n_pages = row_count;

  update public.feed
     set body = public.__journal_rewrite_chip_html(body, p_type, p_id, p_id, v_name)
   where body like '%data-mention-key="' || p_id || '"%';
  get diagnostics n_feed = row_count;

  return jsonb_build_object('pages', n_pages, 'feed', n_feed);
end $$;

grant execute on function public.canonize_entity(text, text) to authenticated;

-- ── merge_entity: fold a stub into canon ────────────────────────────────────
-- p_canon_label: the canonical display name. Required because the merge
-- target may live only in tooltips.js canon (no entities row to read a name
-- from) — the curation UI always knows it.
-- p_fix_feed: chat is a record of what was said — feed bodies rewrite only
-- when explicitly asked. The alias covers future typing either way.
create or replace function public.merge_entity(
  p_type text, p_old text, p_canon text, p_canon_label text,
  p_fix_feed boolean default false
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  n_pages int := 0;
  n_refs  int := 0;
  n_feed  int := 0;
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;
  if p_old !~ '^[a-z0-9-]+$' or p_canon !~ '^[a-z0-9-]+$'
     or p_type not in ('npc','location') then
    raise exception 'bad entity key';
  end if;
  if p_old = p_canon then
    raise exception 'same key — use canonize_entity for the resolve-flip';
  end if;
  if coalesce(trim(p_canon_label), '') = '' then
    raise exception 'canonical label required';
  end if;

  -- docs + html caches: chip nodes / deterministic spans only
  update public.journal_pages
     set doc  = public.__journal_rewrite_mention(doc, p_type, p_old, p_canon, p_canon_label),
         html = public.__journal_rewrite_chip_html(html, p_type, p_old, p_canon, p_canon_label)
   where (doc is not null and doc::text like '%"' || p_old || '"%')
      or (html is not null and html like '%data-mention-key="' || p_old || '"%');
  get diagnostics n_pages = row_count;

  -- the graph: drop rows that would collide with an existing canon ref on the
  -- same page (pk page_id/kind/ref_id), then repoint the rest
  delete from public.journal_refs r
   where r.kind = 'entity' and r.ref_type = p_type and r.ref_id = p_old
     and exists (select 1 from public.journal_refs c
                  where c.page_id = r.page_id and c.kind = 'entity'
                    and c.ref_id = p_canon);
  update public.journal_refs
     set ref_id = p_canon, label = p_canon_label
   where kind = 'entity' and ref_type = p_type and ref_id = p_old;
  get diagnostics n_refs = row_count;

  -- feed bodies: only on request
  if p_fix_feed then
    update public.feed
       set body = public.__journal_rewrite_chip_html(body, p_type, p_old, p_canon, p_canon_label)
     where body like '%data-mention-key="' || p_old || '"%';
    get diagnostics n_feed = row_count;
  end if;

  -- the alias: future typing of the typo matches canon
  insert into public.entity_aliases (type, alias_id, canonical_id)
  values (p_type, p_old, p_canon)
  on conflict (type, alias_id) do update set canonical_id = excluded.canonical_id;

  -- retire the stub
  delete from public.entities where type = p_type and id = p_old;

  return jsonb_build_object('pages', n_pages, 'refs', n_refs, 'feed', n_feed);
end $$;

grant execute on function public.merge_entity(text, text, text, text, boolean) to authenticated;
