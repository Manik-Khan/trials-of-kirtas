-- ============================================================================
-- schema_delta_homebrew_races.sql  —  Homebrew Races library (Forge Phase 2)
-- ----------------------------------------------------------------------------
-- A reusable, per-campaign shelf of custom (homebrew) races for the Soul Shards
-- charactermancer. The Forge's custom-race builder (SpeciesUI) already produces a
-- normalizeRace-shaped model per character and stores it in the build snapshot;
-- this table just lets a member SAVE that model and REUSE it across characters via
-- the "Homebrew" tab in the species picker. The per-character snapshot stays the
-- source of truth for a built character — a library row is convenience, and a
-- character survives the row being deleted.
--
-- Builds on schema_v1.sql (is_staff) and schema_delta_members.sql (is_member).
-- Deploy those first. Run this whole file once in the Supabase SQL editor.
--
-- Access model (matches the campaign's "shared content, owned edits" shape):
--   • READ   — any approved member (overseer/dm/player). Pending/guest can't see it.
--   • CREATE — any approved member, filed under their OWN identity (created_by is
--              pinned to auth.uid() by a column default AND the insert WITH CHECK).
--   • EDIT / DELETE — the row's creator, or staff (overseer/dm) for cleanup.
-- A player can add and manage their own homebrew; staff can tidy anyone's.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────
-- 1. TABLE
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.homebrew_races (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  -- The race model: a normalizeRace-shaped object (size, speed, darkvision,
  -- abilityBonuses, languages, skill/tool/weapon/armor proficiencies, traits, …).
  -- The builder's transient UI fields (asiMode / _bonusRows) ride along so a saved
  -- race re-opens with its increase rows intact; the derive ignores unknown keys.
  model           jsonb not null default '{}'::jsonb,
  -- Creator identity. Pinned to the inserter by the default below; the insert policy
  -- also requires created_by = auth.uid(), so a member can only file under themselves.
  -- on delete set null: a departed member's shared races persist (staff-managed).
  created_by      uuid default auth.uid() references auth.users(id) on delete set null,
  -- Denormalized display label (username || email local-part) captured at save time,
  -- so the picker can show "saved by …" without a join. Cosmetic; may go stale on rename.
  created_by_name text,
  created_at      timestamptz not null default now()
);


-- ─────────────────────────────────────────────────────────────────────────
-- 2. RLS
-- ─────────────────────────────────────────────────────────────────────────
alter table public.homebrew_races enable row level security;

-- READ — approved members only.
drop policy if exists homebrew_races_read on public.homebrew_races;
create policy homebrew_races_read on public.homebrew_races
  for select to authenticated
  using (public.is_member());

-- CREATE — a member, filing under their own identity.
drop policy if exists homebrew_races_insert on public.homebrew_races;
create policy homebrew_races_insert on public.homebrew_races
  for insert to authenticated
  with check (public.is_member() and created_by = auth.uid());

-- EDIT — creator or staff.
drop policy if exists homebrew_races_update on public.homebrew_races;
create policy homebrew_races_update on public.homebrew_races
  for update to authenticated
  using      (created_by = auth.uid() or public.is_staff())
  with check (created_by = auth.uid() or public.is_staff());

-- DELETE — creator or staff.
drop policy if exists homebrew_races_delete on public.homebrew_races;
create policy homebrew_races_delete on public.homebrew_races
  for delete to authenticated
  using (created_by = auth.uid() or public.is_staff());


-- ─────────────────────────────────────────────────────────────────────────
-- 3. GRANTS  (RLS still governs row visibility; these grant the verbs)
-- ─────────────────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.homebrew_races to authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 4. (optional) REALTIME — uncomment to stream library changes across members
--    live. Not required: the Forge loads the list on tab open and refreshes it
--    after a save. Enable only if you want one member's save to appear on
--    another's open picker without a reopen.
-- ─────────────────────────────────────────────────────────────────────────
-- alter publication supabase_realtime add table public.homebrew_races;
