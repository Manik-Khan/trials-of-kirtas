-- schema_delta_journal_comments.sql  (the comments arc — Phase 4)
--
-- journal_comments: quote-anchored comments ABOUT a page — never writes TO it.
-- The row keeps the commenter's ORIGINAL words forever (the history promise):
--   • accept / dismiss only flip `status` (page owner's call)
--   • edit-then-accept edits what lands on the PAGE (the attribution chip in
--     the owner's doc), never this row
--   • a trigger enforces it: only the comment's author may change its words
--
-- Anchor model: quote + prefix/suffix context captured at write time.
-- Render-time matching is strict (exact context → unique quote → ORPHAN);
-- matching lives client-side — the table just stores the anchor.
--
-- RLS mirrors journal_pages' spirit: party-readable, and the write policies
-- encode exactly who may do what. Idempotent — safe to re-run.

create table if not exists public.journal_comments (
  id         uuid primary key default gen_random_uuid(),
  page_id    uuid not null references public.journal_pages(id) on delete cascade,
  author_id  uuid not null,                 -- auth uid of the commenter
  seat       text,                          -- commenter's character_key at write time (null = Narrator/staff)
  body_html  text not null,
  quote      text not null,
  prefix     text not null default '',
  suffix     text not null default '',
  status     text not null default 'open' check (status in ('open','accepted','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists journal_comments_page on public.journal_comments (page_id, status);

grant select, insert, update, delete on public.journal_comments to authenticated;

alter table public.journal_comments enable row level security;

-- read: the party reads pages, the party reads their comments
drop policy if exists journal_comments_select on public.journal_comments;
create policy journal_comments_select on public.journal_comments
  for select to authenticated using (public.is_member());

-- write: any member may comment, as themselves
drop policy if exists journal_comments_insert on public.journal_comments;
create policy journal_comments_insert on public.journal_comments
  for insert to authenticated
  with check (public.is_member() and author_id = auth.uid());

-- update: the commenter (their words) OR the page owner (status flips).
-- WHICH columns each may touch is the trigger's job below — RLS is row-level.
drop policy if exists journal_comments_update on public.journal_comments;
create policy journal_comments_update on public.journal_comments
  for update to authenticated
  using (
    author_id = auth.uid()
    or exists (select 1 from public.journal_pages p
                where p.id = page_id and p.author_id = auth.uid())
  )
  with check (
    author_id = auth.uid()
    or exists (select 1 from public.journal_pages p
                where p.id = page_id and p.author_id = auth.uid())
  );

-- delete: the commenter may withdraw; staff may moderate
drop policy if exists journal_comments_delete on public.journal_comments;
create policy journal_comments_delete on public.journal_comments
  for delete to authenticated
  using (author_id = auth.uid() or public.is_staff());

-- ── the history guard ───────────────────────────────────────────────────────
-- Only the comment's author may change its WORDS or ANCHOR; everyone the RLS
-- admits (i.e. the page owner) may still flip status. This is what makes
-- "the row keeps the original forever" true rather than polite.
create or replace function public.journal_comments_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is distinct from old.author_id then
    if new.body_html is distinct from old.body_html
       or new.quote  is distinct from old.quote
       or new.prefix is distinct from old.prefix
       or new.suffix is distinct from old.suffix
       or new.seat   is distinct from old.seat
       or new.author_id is distinct from old.author_id
       or new.page_id   is distinct from old.page_id then
      raise exception 'only the comment''s author may edit its words';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists journal_comments_guard on public.journal_comments;
create trigger journal_comments_guard
  before update on public.journal_comments
  for each row execute function public.journal_comments_guard();
