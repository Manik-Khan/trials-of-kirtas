-- schema_delta_session_titles.sql  (canonical session titles — the shelf fix)
--
-- session_titles: ONE canonical title per session, staff-curated. Before
-- this, the book's chapter title was "the first meta.sessionTitle any feed
-- row in the session happened to carry" — whichever poster filled the
-- drawer's title field named the whole spine, with no way to correct it
-- short of hunting down and editing that row. This table overrides; row
-- meta remains the FALLBACK for sessions with no canonical row (delete the
-- row to fall back — the adapter's empty-title path does exactly that).
--
-- House rules honored: explicit GRANTs to authenticated (raw-SQL tables get
-- nothing by default); reads open to the party, writes gated on
-- public.is_staff(); no touch to the feed table or bookModel's contract.
-- Idempotent — safe to re-run.

create table if not exists public.session_titles (
  session     integer not null,
  title       text    not null,
  updated_by  uuid    default auth.uid(),
  updated_at  timestamptz not null default now(),
  primary key (session),
  constraint session_titles_title_sane check (length(btrim(title)) between 1 and 200)
);

alter table public.session_titles enable row level security;

-- the party reads the shelf; everyone sees the same canon
drop policy if exists session_titles_select on public.session_titles;
create policy session_titles_select on public.session_titles
  for select to authenticated using (true);

-- staff name the volumes (insert / update / delete — delete = fall back)
drop policy if exists session_titles_write on public.session_titles;
create policy session_titles_write on public.session_titles
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- raw-SQL tables get no grants by default (lesson: 42501 permission denied)
grant select, insert, update, delete on public.session_titles to authenticated;
grant select on public.session_titles to service_role;
