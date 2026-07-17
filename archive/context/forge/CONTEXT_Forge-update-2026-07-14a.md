# CONTEXT Forge update · 2026-07-14a

Supersedes `CONTEXT_Forge-update-2026-07-13h.1.md` as the current concise Forge handoff. Phase 1.5h.1 remains the completed combat/render baseline; this update records the first active Phase 2 slice.

## Phase 2a — exact snapshot authority

Session loading is now snapshot-first.

- A session envelope with its own `mapSnapshot` key must load that exact map.
- `mapFingerprint` is checked before normalization.
- Only a session with no `mapSnapshot` key may regenerate from the legacy `seed` / `theme` / `sliders` recipe.
- A present but null, malformed, dimensionally invalid, out-of-bounds, or fingerprint-mismatched snapshot stops loudly. It never falls back to a different generated battlefield.
- Every restore returns a detached clone, so runtime mutation cannot alter the saved envelope or another client's load.
- `coverShape[]` is now snapshot data. This closes the foundation.2 omission that would otherwise widen narrow trunks and columns after reload.
- Infinite void occlusion is JSON-safe in storage and numeric again at runtime.

## Production renderer seam

The saved combat map and the renderer field are no longer conflated.

`SESSION_MAP_AUTHORITY` holds the exact restored combat document. While a session is open, `combatMapFromF()` clones this authority instead of rebuilding `h`, `wall`, `occ`, or `coverShape` from visual terrain.

New snapshots store compact renderer-only metadata under `mapSnapshot.meta.renderField`:

- terrain `type[]`;
- footprint `foot[]`;
- base-terrain occlusion `baseOcc[]`;
- display name.

This is necessary because effective combat `occ[]` already includes props. Treating it as terrain during repaint would turn narrow prop footprints back into full-cell walls.

Older foundation.2 snapshots have no render metadata. Their combat geometry still loads exactly. Presentation-only type/foot data is inferred, with border-connected zero-occlusion blockers treated as exterior void and enclosed ones as pools.

## Files

- `forge/forge-generator-foundation.js` — version `2.0.0-snapshot.1`; snapshot validation, restore, legacy recipe resolution, cover shapes, JSON-safe Infinity.
- `forge/forge-engine.js` — `loadEncounter(envelope)` snapshot-first read path.
- `forge/topography-test-mock.html` — authoritative session map, render metadata save/restore, legacy fallback only when the snapshot key is absent; cache stamps `g2s1` / `fe2`.
- `forge/tests/smoke-snapshot-authority.js` — 24 checks.
- `forge/tests/smoke-phase15h-contract.js` — retains h.1 boot-order guard and pins the snapshot seam.

## Validation

- 24 snapshot-authority checks green.
- Runtime modules and all executable inline HTML scripts parse.
- Phase 1.5h.1 discovery registry still precedes the initial terrain build.

Not claimed: the full repository battery, automated WebGL screenshots, or a live two-device Supabase round. Those remain field gates.

## Next Phase 2 order

1. Field-check this snapshot-first load on a newly created session, a refresh, a second device, and one legacy recipe-only row.
2. Repair only demonstrated snapshot/render regressions.
3. Add archetype selector and versioned parameter records.
4. Make `layout`, `height`, `semantics`, `decor`, and `foes` stage seeds own their stages.
5. Continue with constrained elevations/connectors, semantic spawns/objectives, validation/local repair, overlays, and authored tactical props.

## Deploy rule

M uploads, commits, and pushes through GitHub. Do not push unless explicitly instructed.
