# CONTEXT_Forge update · 2026-07-13h

Supersedes `CONTEXT_Forge-update-2026-07-13g.md` as the current concise handoff. Earlier handoffs remain authoritative for the features they shipped.

## Phase 1.5 is complete through geometry/fog calibration

The production Forge now includes the complete July 13 sequence:

- storybook sky + painted horizon default; broken parallax/landmarks opt-in only;
- versioned generator foundation with snapshots, fingerprints, graph metadata, archetypes, and independent stage seeds;
- one perspective camera with 3D and top-down presets, follow/focus/pair/free modes, pan, recenter, and staff Overview;
- dual unit rigs: 3D standees and top-down tactical tokens, automatic bestiary art, and per-combatant/per-kind custom art;
- Staff View ↔ Player View local presentation toggle without changing authority;
- readable Table/System/All feed, automatic monster tokens, reinforcement modal, Ki aliases, slot choice, Cover Contest, enemy-stat privacy;
- replayable effect ledger with Sanctuary;
- party-shared world-space discovery and direct ranged firing-position preview;
- corrected Monk actions, Toll the Dead wounded die, target→preview→confirm, player move undo, flanking modes, source-aware advantage/disadvantage, and fully enforced Prone.

## Phase 1.5h — cover calibration

The old eight-ray model (four corners × head/feet) over-weighted low obstacles. A low lip could block every foot ray and automatically grant half cover.

Canonical geometry now uses **twelve body samples**: four inset horizontal corners across lower-body, torso, and head bands.

- 0–5 target-side samples blocked → none;
- 6–8 → half;
- 9–11 → three-quarters;
- all 12 blocked anywhere → total.

Target-side attribution, dead ground, ledge peek, and parapet lean remain. Legal target-facing inset attacker corners are considered without reopening sideways wall peeks.

The map now supports optional `coverShape[]` sub-cell footprints. Production props receive first-pass circle/box shapes instead of all acting as full five-foot prisms. Walls and terrain remain full-cell solids. `map.creatures[]` supplies size-aware intervening-creature cover; discovery ignores transient creature screens.

Staff can run **Forge → Run cover audit**, which samples shots and reports clear/half/¾/total percentages plus culprit categories to the System feed.

`forge/tests/smoke-los-cover.js` is replaced by a 50-case body-cover battery. `smoke-cover-calibration.js` adds 15 focused cases. `smoke-geometry-sync.js` freezes byte identity between canonical geometry and the production inline copy.

## Phase 1.5h — fog renderer

The first fog renderer used overlapping cell boxes scaled to 1.025. Coplanar faces caused the triangular/checker z-fighting visible in M’s player-view screenshot. Their heights also followed hidden terrain and occluders, leaking room silhouettes.

The replacement uses:

- per-instance terrain discovery state;
- visible terrain normal;
- explored terrain dark remembered;
- unexplored terrain collapsed;
- props, decals, grid, and local lights visible only while currently visible;
- one continuous world-space mask plane for unexplored cells, with no depth writes/tests and no hidden-height silhouette.

Discovery module version is `1.1.0`. Its LoS call uses `{ignoreCreatures:true}`.

## Canonical-copy deployment rule

The production topography inline is byte-identical to `forge/tactics-geometry.js`. The reference `battle-tactics-geo-mock.html` must also be synchronized. This bundle includes an offline guarded browser patcher and Node patcher because the exact current reference mock was not supplied in the session.

## Validation

**426 cumulative checks green** across fourteen suites. Runtime JavaScript, tests, all three executable production inline scripts, and the browser patcher script parse. The battle-mock patcher passes its fixture. SHA and ZIP integrity are verified.

Not claimed: automated WebGL screenshots or a live two-device Supabase field round. M’s browser checklist remains the release gate.

## Next-session order — active Phase 2

1. Field-check Phase 1.5h in 3D and top-down Player View; run cover audit on several real seeds.
2. Repair only demonstrated calibration/render regressions.
3. Make saved `mapSnapshot` authoritative on session load, with legacy recipe fallback.
4. Add archetype selector and versioned parameter records.
5. Make `layout`, `height`, `semantics`, `decor`, and `foes` stage seeds actually own their stages.
6. Generate constrained elevations and first-class connectors: ramps, stairs, bridges, doors, tunnels, ledges, and fords.
7. Place semantic PC/foe/objective spawns.
8. Validate normal-creature connectivity, spawn fairness, objective access, melee access, cover, sightlines, elevation advantage, and chokepoints; repair locally or retry only the failed stage.
9. Add graph, critical path, semantics, height, connector, cover, and spawn-influence overlays.
10. Expand Phase 1.5h’s tactical `coverShape` seam into authored prop footprints/rotations/movement effects.

## Deploy rule

M uploads, commits, and pushes through GitHub. Return files with repository paths intact; do not push.
