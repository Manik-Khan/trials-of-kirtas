-- ── schema_delta_scenes.sql ──────────────────────────────────────────────────
-- SCENES-V1: maps/manifest.json moves into the database.
--
-- What this is: one row per map "scene" — the Cloudinary publicId plus grid
-- calibration (cols/rows/cellPx/origin) and grid display defaults. Exactly the
-- data the git manifest held; the heavy image stays in Cloudinary.
--
-- What this is NOT (yet — deferred by decision 2026-06-11):
--   * no encounters.scene_id / campaign.active_scene_id pointers — the
--     encounter's existing map_ref TEXT column now matches scenes.key, so the
--     DM's dashboard flow is unchanged;
--   * no per-scene fog (revealed_cells stays on encounters until phase S2);
--   * no walls / trigger-region tables (S3/S4 hang off scenes.id later).
--
-- New-map flow after this ships: upload to Cloudinary → insert a scenes row in
-- the Supabase table editor → point encounters.map_ref at its key. No git.
--
-- Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.scenes (
  id         uuid primary key default gen_random_uuid(),
  key        text not null unique,             -- human handle; encounters.map_ref matches this
  name       text not null default '',         -- display name (unused by combat.html v1; for the future Scenes pane)
  public_id  text not null,                    -- Cloudinary publicId of the full-res map image
  cols       int  not null check (cols  > 0),  -- grid columns  (cols*cell_px = native image width)
  rows       int  not null check (rows  > 0),  -- grid rows     (rows*cell_px = native image height)
  cell_px    int  not null check (cell_px > 0),-- native pixels per 5-ft cell
  origin_x   int  not null default 0,          -- grid origin offset, native px
  origin_y   int  not null default 0,
  grid       jsonb not null default '{}'::jsonb, -- display defaults: {style,color,opacity}
  created_at timestamptz not null default now()
);

-- Realtime needs the full row on changes (house checklist; combat.html does
-- not subscribe yet — this is for the future Scenes pane / live calibration).
alter table public.scenes replica identity full;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.scenes enable row level security;

-- Read: any logged-in user (players need the active map's calibration to
-- render the board — same posture as encounters).
drop policy if exists scenes_read on public.scenes;
create policy scenes_read on public.scenes
  for select to authenticated
  using (true);

-- Write: staff only.
drop policy if exists scenes_staff_write on public.scenes;
create policy scenes_staff_write on public.scenes
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- RLS does the gating; the grant just exposes the table to the API role.
grant select, insert, update, delete on public.scenes to authenticated;

-- Join the realtime publication (idempotent).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scenes'
  ) then
    alter publication supabase_realtime add table public.scenes;
  end if;
end $$;

-- ── Seed: migrate the one live manifest entry verbatim ──────────────────────
insert into public.scenes (key, name, public_id, cols, rows, cell_px, origin_x, origin_y, grid)
values (
  'G_BridgeTown_Original_Day',
  'Bridge Town — Day',
  'kirtas/maps/G_BridgeTown_Original_Day',
  39, 56, 140, 0, 0,
  '{"style":"lines","color":"#ffffff","opacity":0.32}'::jsonb
)
on conflict (key) do nothing;

-- Verify after running:
--   select key, public_id, cols, rows, cell_px from public.scenes;
-- should return the BridgeTown row, and the live encounter's map_ref should
-- equal its key.
