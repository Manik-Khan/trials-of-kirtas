# Battle Forge Phase 2d — deterministic stage ownership

This bundle is based on Phase 2c and retains the Phase 2b.1 field-round fixes.
It is a repository-structured working set, not a standalone copy of the full
site.

## Replace

- `forge/forge-generator-foundation.js`
- `forge/forge-engine.js`
- `forge/topography-test-mock.html`
- `forge/tests/smoke-snapshot-authority.js`
- `forge/tests/smoke-phase2c-archetype-params.js`

## Add

- `forge/FORGE_PARAMETER_RECORD_2.md`
- `forge/FORGE_STAGE_OWNERSHIP_1.md`
- `forge/tests/smoke-phase2d-stage-ownership.js`

The Phase 2b.1 external-module patcher remains in the full working set. Run it
only if those damage/feed/claim/movement/cover fixes have not already been
applied to the repository.

## What changed

Newly authored recipes now use parameter record version 2 and
`generatorProfile: "stage-owned-legacy"`.

The active legacy room-and-corridor grammar runs through five independently
seeded products:

1. `layout` owns topology, rooms, corridors, and the dense candidate pool;
2. `height` owns the current tier orientation and height field;
3. `semantics` owns room labels, critical route labels, and objective intent;
4. `decor` owns final prop/torch selection and variation;
5. `foes` owns party and foe placement.

Every successful map records stage seeds, attempt counts, and fingerprints in
`map.meta.stageOwnership`.

Changing one stage seed is regression-tested not to reroll unrelated stage
products. Layout remains the expected exception: a new topology can change all
downstream products because they consume that topology.

## Compatibility

- `mapSnapshot` is still authoritative.
- Existing snapshot-backed sessions repaint exactly and do not regenerate.
- Version-1 snapshot-less recipes retain the old monolithic
  `legacy-dungeon` profile.
- New/unversioned authoring inputs become version 2 and use the staged profile.
- Top-level compatibility fields remain; the canonical `parameters` record owns
  recipe reads.
- Recorded archetypes such as Canyon and Bridge Crossing still use the legacy
  layout grammar. Their intent is preserved honestly; no terrain archetype is
  falsely claimed as implemented.

A newly generated version-2 map may differ from an older map made with the same
human-facing root seed because layout now consumes its named derived stage seed.
Saved snapshots and version-1 legacy recipes prevent this from changing old
encounters.

## Retry behavior

- A layout failure advances only the layout attempt stream.
- A spawn failure advances only the foes attempt stream.
- Height, semantics, and decor are deterministic one-pass stages in this slice;
  their local repair/retry seams arrive with the corresponding validators.

## Browser checklist

1. Apply Phase 2d over the current repository and hard-refresh once.
2. Confirm party sheets and **Enter the Forge** load normally.
3. Open **Inspect map**, select Legacy dungeon, and generate a map.
4. Re-enter the same seed and settings; confirm the same terrain, decor, and
   spawn preview returns.
5. Select Canyon or Bridge Crossing. Confirm the choice is recorded while the
   note still says the legacy layout grammar is being used.
6. Save/open a new table and confirm it loads the exact saved snapshot after a
   refresh and on a second browser.
7. Open a Phase 2c snapshot-backed table; confirm its battlefield is unchanged.
8. Open an older snapshot-less recipe if one is available; confirm it still
   follows the legacy profile rather than silently migrating its map.
9. Recheck the Phase 2b.1 field fixes: visible damage arithmetic, multi-claim,
   refresh movement remainder, and cover contest only when cover exists.
10. Run the full repository test battery.

## Validation in this supplied working set

- snapshot authority: 24 green;
- Map Contract/render truth: 23 green;
- Phase 2b.1 field round: 30 green;
- Phase 2c parameter regression: 41 green;
- Phase 2d stage ownership: 36 green;
- **154 checks total**;
- both runtime modules parse;
- all three executable production inline scripts parse;
- both known startup-order guards remain before the initial rebuild.

The full Phase 1.5h suite was not runnable from this reduced working set because
canonical `forge/tactics-geometry.js` and `forge/forge-discovery.js` are not
included. Run it after integration in the complete repository.

## Next slice

Phase 2e should replace the legacy depth-to-tier field with bounded tactical
elevations and begin emitting first-class connectors. Start with a small honest
connector set—stairs, ramps, and ledges—before bridges, tunnels, doors, and
fords broaden the grammar.

## Deploy rule

M uploads, commits, and pushes through GitHub. No push is included or implied.
