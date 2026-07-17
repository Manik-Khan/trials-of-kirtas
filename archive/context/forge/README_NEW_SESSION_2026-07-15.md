# Battle Forge — new session launch checklist · 2026-07-15

Use this document with:

1. `CONTEXT.md`
2. `CONTEXT_Forge.md`
3. `CONTEXT_Forge-update-2026-07-15a.md`
4. `FORGE_PHASE2_REMAINDER_2026-07-15.md`
5. this `README_NEW_SESSION_2026-07-15.md`

The current concise authority is `CONTEXT_Forge-update-2026-07-15a.md`.

## Suggested first prompt

> Read all current context documents completely. Treat the July 15 browser report as field authority. Do not continue new generator features until the demonstrated correctness wave is closed. First inspect the current live copies of the Forge runtime and diff them against the latest Phase 2f.2 working set. Preserve structural bridges as active Phase 2 work. Fix, in order: advantage/disadvantage raw-die evidence, Ki/Focus resource consumption, Dash and movement-budget reconciliation, movement-highlight restoration, and fog-of-war presentation. Keep Sanctuary as verification-pending, not broken. Rename Open the Table to Roll Initiative and default the local grid opacity to 50%. Then run a clean two-device round. After that, continue bridge state/UI work and the remaining Phase 2 connector roadmap. Do not promote the mock URL to `/forge` until the correctness gate passes.

## Files to upload at session start

Upload the **current live/repository copies**, not an older generated bundle:

### Production surface and combat presentation

- `forge/topography-test-mock.html`
- `forge/forge-hud.js`
- `forge/forge-feed-render.js`
- `forge/forge-table-correctness.js`
- `forge/forge-action-damage.js`
- `forge/forge-damage-evidence.js`

### Character actions and resource economy

- `forge/forge-kit-derive.js`
- `weapon-actions.js`
- current character JSON for Caim, Vesperian, Cosmere, and Líadan, or permission to read the current repository copies
- `forge/forge-replay.js`
- `forge/forge-pipeline.js`
- `forge/forge-board.js`

### Rules, effects, and discovery

- `forge/forge-combat-rules.js`
- `forge/forge-effects.js`
- `forge/forge-discovery.js`
- `forge/tactics-geometry.js`

### Generator/bridge state

- `forge/forge-generator-foundation.js`
- `forge/forge-engine.js`
- `forge/FORGE_MAP_CONTRACT_2.md`
- `forge/FORGE_VERTICAL_GEOMETRY_1.md`
- `forge/FORGE_STRUCTURAL_BRIDGES_1.md`

Diff uploads against current `main` before claiming either is newer.

## First browser checklist

### Advantage evidence

1. Create a normal attack and confirm one d20 is shown.
2. Create an advantage attack through flanking.
3. Confirm two raw d20 results are shown and the kept result is identified.
4. Refresh both devices and confirm the same pair remains.
5. Confirm advantage/disadvantage cancellation records one normal d20.

### Ki / Focus

1. Note Caim's starting resource count.
2. Use Flurry of Blows.
3. Confirm one resource is spent total and both strikes resolve.
4. Refresh both devices and confirm the same remainder.
5. Repeat with Patient Defense and Step of the Wind.
6. Cancel an ability before resolution and confirm no resource is spent.

### Dash and movement

1. Move 10 ft from 30.
2. Dash.
3. Confirm the authoritative capacity is now 60 ft and the remainder is 50 ft.
4. Move another 20 ft; confirm 30 ft remains.
5. Refresh; confirm the same value and reachable tiles.
6. Rewind; confirm number, validation, and highlights all restore together.

### Movement highlights

1. Move, attack, then move again.
2. Confirm remaining blue tiles return.
3. Rewind and confirm tiles restore.
4. Confirm selected green destination pulses subtly.
5. Confirm reduced-motion preference removes or softens the pulse.

### Fog of war

1. Player View starts with unexplored topology absent, not merely darkened.
2. Move around and confirm discovery opens the map.
3. Zoom out; no unexplored room/wall silhouettes appear.
4. Explored but currently unseen terrain remains subdued memory.
5. Enemies, props, decals, local lights, interactions, and badges require current visibility.
6. Confirm the intended darkvision radius with M before freezing its value.

### Sanctuary

1. Apply Sanctuary to Líadan.
2. Drive or simulate a hostile attack against her.
3. Confirm the Wisdom-save gate occurs before the attack.
4. Confirm success/failure behavior and effect removal.
5. Refresh and verify replay reconstruction.

### UI decisions

1. Shared encounter creation reads **Roll Initiative**.
2. Supporting copy explains that it creates the persistent multiplayer table.
3. Grid starts at 50%.
4. Every device may change grid opacity locally during combat.
5. Bridge/connector controls remain in the active Height/Vertical Geometry section.
6. Planned items are not shown as disabled active controls.

## Promotion gate

Do not rename the production route yet.

After the correctness checklist and one clean two-device round:

- create canonical `/forge`;
- establish explicit Workshop and Table modes;
- add the Planned tab;
- remove/retire prototype residue;
- preserve old session/join URLs through a query-preserving redirect;
- relabel local combat as a single-device test;
- keep one canonical production HTML implementation.

## Stop conditions

Stop forward work immediately for:

- renderer boot failure;
- player seated as spectator after claiming;
- stale or divergent movement/state after refresh;
- wrong attack/damage/resource math;
- replay losing authoritative dice or combat facts;
- hidden geometry visible through unexplored fog;
- saved bridge geometry changing between clients.

Record aesthetic or QoL ideas without interrupting the current slice unless they contradict rules or materially block use.
