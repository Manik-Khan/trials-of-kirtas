# CONTEXT Forge update · 2026-07-14b

Supersedes `CONTEXT_Forge-update-2026-07-14a.1.md` as the current concise handoff. Phase 2a snapshot authority and the a.1 `SESSION_ID` boot hotfix remain part of the active line.

## Phase 2b — Map Contract 2.0

`forge/FORGE_MAP_CONTRACT_2.md` now freezes the shared foundation for:

- the procedural generator;
- combat geometry;
- the renderer;
- snapshots;
- validation/debug overlays;
- tactical-prop authoring;
- the future image-to-dungeon importer.

Settled principles:

- gameplay cells remain 5 × 5 ft;
- vertical geometry is authoritative in feet;
- 2.5-ft walls/rails/parapets are allowed without creating a 2.5-ft movement grid;
- terrain, movement, vision, cover, edge blockers, connectors, and art are distinct properties;
- walls/fences/doors/rails should migrate toward first-class edge records rather than consuming whole cells;
- stairs, ramps, ladders, bridges, doors, tunnels, fords, jumps, and climb points are first-class connectors;
- generated maps and future annotated image maps must serialize to the same snapshot language;
- automatic import guesses remain non-authoritative until validated/confirmed.

The current `{h[], wall[], occ[], coverShape[]}` document remains backward-compatible. Edge blockers and connectors are target additions, not silently inferred in this slice.

## Truthful tactical vertical scale

The old **Height exaggeration** control created a player-facing WYSIWYG failure: terrain could be flattened or stretched while the feet-based geometry remained unchanged, especially because token art is not an equivalent rules-height mesh.

The control is now **Vertical inspection scale**:

- default: 100%;
- range: 50–180%;
- available only as a pre-combat authoring preview;
- local combat resets and locks it to 100% before staging tokens/eyes/rays;
- shared sessions lock it to 100% from boot;
- it is never persisted in `mapSnapshot`.

At tactical scale, five vertical feet equals one world unit. Terrain, `occ` heights, props, creature eyes, tokens, fog, and sight lines share the same conversion.

No LoS/cover/movement ruling changed. Existing fractional `occ` values already support a 2.5-ft blocker mathematically and visually at truthful scale.

## Files

- `forge/FORGE_MAP_CONTRACT_2.md` — NEW
- `forge/topography-test-mock.html` — inspection/tactical-scale policy
- `forge/tests/smoke-map-contract-render-truth.js` — NEW, 23 checks
- `README_PHASE2B_MAP_CONTRACT.md` — deploy and browser checklist

Phase 2a.1 files are carried unchanged in the full bundle.

## Validation

- 23 Map Contract/render-truth checks green;
- 24 snapshot-authority checks green;
- all three executable production inline scripts parse;
- runtime modules and smoke scripts parse;
- discovery registry and session identity remain initialized before first rebuild;
- no late lexical `SESSION_ID` declaration.

The complete Phase 1.5h battery was not runnable from this partial working set because standalone `tactics-geometry.js` and `forge-discovery.js` were not supplied. Run the full repository battery after integration.

## Active next order

1. Field-check Phase 2b’s 100% tactical scale in local and shared combat.
2. Add archetype selector and versioned parameter records.
3. Make `layout`, `height`, `semantics`, `decor`, and `foes` seeds actually own their stages.
4. Generate bounded elevations.
5. Add first-class connectors.
6. Add semantic spawns/objectives, validation/local repair, and contract overlays.
7. Expand tactical props and edge blockers.
8. Build the top-down image-import MVP against the completed contract.

## Deploy rule

M uploads, commits, and pushes through GitHub. Return repository-structured files; do not push unless explicitly instructed.
