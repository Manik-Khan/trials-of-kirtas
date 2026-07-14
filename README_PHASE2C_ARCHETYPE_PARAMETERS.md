# Battle Forge Phase 2c — archetype selector and versioned parameters

This bundle is based on Phase 2b.1 and includes its field-round fixes.

## Replace

- `forge/forge-generator-foundation.js`
- `forge/forge-engine.js`
- `forge/topography-test-mock.html`

## Add

- `forge/FORGE_PARAMETER_RECORD_1.md`
- `forge/tests/smoke-phase2c-archetype-params.js`

Also replace `forge/tests/smoke-snapshot-authority.js`; only its expected runtime cache stamps changed.

## What changed

- The Forge panel now has an **Archetype** selector.
- The canonical vocabulary comes from `ARCHETYPE_DEFINITIONS` in the generator foundation.
- `legacy-dungeon` is marked active.
- Future archetypes are marked **recorded** and do not falsely change the preview yet.
- New maps save a schema-versioned `parameters` record.
- Top-level `seed`, `theme`, `sliders`, `archetype`, and `stageSeeds` remain for compatibility.
- Parameter records are authoritative over stale compatibility fields.
- Old envelopes migrate into version 1 in memory without a database migration.
- Shared sessions display the saved archetype and lock it with the rest of the map.
- Staged-fight rows include the archetype name.
- The engine accepts either legacy parameters or a versioned parameter record.
- Engine metadata records both requested `archetype` and actual `generatorProfile`.

## Important expectation

Selecting Canyon, Bridge crossing, Island chain, and the other future archetypes does **not** change terrain in Phase 2c. The UI says that the choice is recorded while the preview still uses Legacy dungeon. This is intentional; Phase 2d gives the deterministic stages ownership and begins implementing structural archetype behavior.

## Browser checklist

1. Open the Forge outside a session and enter **Inspect map**.
2. Confirm the selector contains all thirteen archetypes.
3. Choose **Canyon**. It should read `recorded` and explain that the current preview remains Legacy dungeon.
4. Confirm changing the selector alone does not regenerate or secretly alter the map.
5. Use **Save for later** or **Open the table**.
6. Confirm the staged-fight summary names Canyon.
7. Open the shared session. The selector should display Canyon as `saved` and remain disabled.
8. Confirm the map itself is the exact saved snapshot.
9. Open an older staged session created before Phase 2c; it should load as Legacy dungeon without a database migration.
10. Recheck the Phase 2b.1 damage arithmetic, multi-claim, movement-refresh, and conditional Cover Contest fixes.

## Validation run in the supplied working set

- 24 snapshot-authority checks green
- 23 Map Contract/render-truth checks green
- 30 Phase 2b.1 field-round checks green
- 41 Phase 2c archetype/parameter checks green
- both runtime modules parse
- all three executable production inline scripts parse

The Phase 1.5h contract suite could not run in this reduced working set because `forge/tactics-geometry.js` and `forge/forge-discovery.js` were not supplied with it. Run that suite and the full repository battery after integration.

## Deploy rule

M uploads, commits, and pushes. No push is included or implied by this bundle.
