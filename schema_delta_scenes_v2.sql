-- ── schema_delta_scenes_v2.sql ───────────────────────────────────────────────
-- SCENES-V2: calibration support.
--
-- 1) cell_px / origin_x / origin_y become DOUBLE PRECISION — the calibration
--    tool divides a drawn span by N squares, and rounding the result back to
--    an int reintroduces exactly the grid drift the tool exists to remove.
--    (double precision, NOT numeric: PostgREST serializes numeric as a JSON
--    string, and every consumer here wants a number.)
-- 2) native_w / native_h: the image's true pixel size. The board's coordinate
--    space is now the IMAGE, with the grid (origin + cell + count) living
--    inside it — the old cols*cell_px == width identity no longer holds once
--    grids are calibrated. Fetched automatically from Cloudinary fl_getinfo
--    at registration; backfilled here for the seed row (which satisfied the
--    old identity exactly).
--
-- Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.scenes
  alter column cell_px  type double precision using cell_px::double precision,
  alter column origin_x type double precision using origin_x::double precision,
  alter column origin_y type double precision using origin_y::double precision;

alter table public.scenes add column if not exists native_w int;
alter table public.scenes add column if not exists native_h int;

-- Backfill the seed row (39*140 × 56*140).
update public.scenes
   set native_w = cols * cell_px,
       native_h = rows * cell_px
 where native_w is null;

-- Verify after running:
--   select key, cell_px, origin_x, origin_y, native_w, native_h from public.scenes;
-- BridgeTown should read 140 / 0 / 0 / 5460 / 7840.
