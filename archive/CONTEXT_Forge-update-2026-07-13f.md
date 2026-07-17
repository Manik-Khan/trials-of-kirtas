# CONTEXT_Forge update · 2026-07-13f

Supersedes `CONTEXT_Forge-update-2026-07-13e.md` as the current concise handoff. Earlier handoffs remain authoritative for their shipped rules and field fixes.

## What Phase 1.5f adds

### Party-shared world-space discovery

Player View now derives three map-cell states:

- unexplored;
- explored memory;
- visible now.

Current sight is the union of all living PCs, using explicit vision/darkvision when available and a 60-ft fallback. Visibility delegates to canonical `TacticsGeo` 3D range and `losVerdict()`.

Explored memory reconstructs from roster starts plus PC movement paths, edits/reinforcements and restore positions in the shared append-only log. Refresh and late join therefore derive the same explored map. Rewinds do not erase player memory.

The first renderer uses two world-space `THREE.InstancedMesh` fog layers: opaque unexplored cells and translucent explored-memory cells. Staff View and local sandbox remain omniscient. Camera angle/view never authorizes knowledge.

### Hidden-foe gates

`foeVisible()` is now backed by discovery state in Player View. Hidden foes are omitted from:

- standees/top-down tokens;
- initiative;
- hover, cell targeting and mathematical fallback picking;
- target pools, sight lines, glows, badges and effect markers;
- camera follow/focus/pair framing.

A hidden foe's authoritative result can still affect a visible PC, but Player View sanitizes the feed to **Unseen foe / Unseen attack** rather than leaking identity. Staff View sees the full row.

### Direct-fire origin preview

Selecting a hostile target and arming one direct ranged attack classifies every reachable firing origin through the existing `CB.seen`, `reachOK()` and canonical cover geometry:

- green — clear;
- yellow — half cover (+2);
- orange — three-quarters (+5);
- dark charcoal — total cover/no line/out of range.

Long-range disadvantage is retained in the hover readout. Player View never outlines an unexplored origin. The same preview works for staff inspecting a foe's weapon against a PC. It is informational only; no move/attack is committed. AoE remains separate.

Cover Contest remains the pre-roll adjudication escape hatch.

## New/changed files

- `forge/forge-discovery.js` — new pure discovery and firing-origin classifier.
- `forge/topography-test-mock.html` — fog renderer, disclosure gates and preview integration.
- `forge/forge-table-correctness.js` — version 1.2.0; anonymous hidden-attacker feed label.
- `forge/tests/smoke-forge-discovery.js` — 41 checks.
- `forge/tests/smoke-phase15f-contract.js` — 47 checks.

All retained Phase 1.5c–e suites remain green. Total bundled checks: **206**.

## Field-check priorities

1. Compare a real-player device with staff temporarily switched into Player View.
2. Move multiple PCs, refresh and late-join; explored memory must agree.
3. Verify a hidden foe leaks no token, initiative chip, picker hit, camera motion or identity in the feed.
4. Check fog composition in both 3D and top-down views.
5. Select a visible foe plus direct ranged action; verify green/yellow/orange/dark origins and hover readout.
6. Confirm unexplored cells never receive preview tiles.
7. Confirm Cover Contest still pauses before the roll and overrides the geometry verdict.

## Deliberate boundaries

- Cell-volume fog is the first renderer; per-instance terrain/prop visibility is the stronger destination.
- Hidden foes still occupy real grid cells; hidden-contact movement adjudication is not invented here.
- No AoE templates or queued move-plus-attack.
- No new protocol kind, database migration or discovery fact.

## Next order

After the browser/two-device pass, Phase 1.5 is complete enough to enter active **Phase 2 terrain**:

1. snapshot-first session loading with legacy recipe fallback;
2. archetype selector and parameter records;
3. stage-seed ownership of layout/height/semantics/decor/foes;
4. constrained elevations and first-class connectors;
5. semantic PC/foe/objective placement;
6. validation, local repair and stage-specific retry;
7. graph/critical-path/semantics/height/cover/spawn/connector overlays;
8. rules-relevant tactical props separated from visual decoration.

M uploads, commits and pushes. No bundle action commits or deploys.
