# Battle Forge Phase 2b — Map Contract 2.0 and truthful tactical scale

## What this slice does

Phase 2b freezes the shared data language for the procedural generator, combat geometry, renderer, validation tools, tactical-prop authoring, and the future image-to-dungeon importer.

It also closes the current height-exaggeration WYSIWYG problem:

- the gameplay grid remains 5 ft;
- vertical geometry may use 2.5-ft measurements;
- authoring preview can still exaggerate terrain before combat;
- all tactical combat and shared sessions are locked to a truthful 100% vertical scale;
- terrain, occluders, props, creature eyes, tokens, fog, and sight lines use one feet-to-world conversion.

No cover thresholds, line-of-sight rulings, movement rules, or snapshot-authority behavior were changed.

## Files

Replace/add:

- `forge/topography-test-mock.html`
- `forge/FORGE_MAP_CONTRACT_2.md` **NEW**
- `forge/tests/smoke-map-contract-render-truth.js` **NEW**
- `CONTEXT_Forge-update-2026-07-14b.md` **NEW handoff**

The bundle also carries the unchanged Phase 2a.1 foundation/engine/tests so it can be used as a complete replacement for that working set.

## Runtime behavior

### Before combat

The Forge panel shows **Vertical inspection scale**. It defaults to 100% and may be adjusted from 50–180% as an authoring preview.

### Local combat

Starting combat resets the scale to 100% before tokens, eyes, or sight lines are staged and disables the inspection control.

### Shared session

A `?session=` view is locked to 100% from boot. The control remains visible as a truthful status rather than pretending to be a live camera preference.

The inspection value is never part of `mapSnapshot` and never changes rules geometry.

## Validation performed

- `smoke-map-contract-render-truth.js`: **23 green**
- `smoke-snapshot-authority.js`: **24 green**
- all three executable inline HTML scripts parse under Node
- foundation, engine, and smoke scripts parse
- `DISCOVERY_RENDER` still initializes before the first rebuild
- `SESSION_ID` still initializes before the first rebuild
- no late lexical `const SESSION_ID` declaration

The complete Phase 1.5h repository smoke requires `forge/tactics-geometry.js` and `forge/forge-discovery.js`, which were not part of this supplied working set. Run the full repository battery after integration.

## Browser checklist

1. Open Forge without a session: scale begins at 100% and remains adjustable.
2. Move it above/below 100%: terrain preview changes and the note remains authoring-only.
3. Start local combat: scale returns to 100%, becomes disabled, and tokens/sight lines remain correctly grounded.
4. Open a shared session: scale reads `100% · tactical` and cannot be changed.
5. Recheck a low wall and an elevated shot visually against the geometry verdict.
6. Confirm party sheets and **Enter the Forge** still load—the Phase 2a.1 boot-order guard remains intact.

## Next slice

Continue Phase 2 with the archetype selector and versioned parameter records. Those records should refer to `FORGE_MAP_CONTRACT_2.md` and must not yet generate edge blockers or connectors until their stage ownership is explicit.

## Deploy rule

M uploads, commits, and pushes through GitHub. Do not push unless explicitly instructed.
