# Battle Forge Phase 2e — bounded elevations, stairs, ramps, and ledges

This bundle is based on Phase 2d and retains the Phase 2b.1 field-round fixes.
It is a repository-structured changed-file working set, **not** a standalone
copy of the complete site.

## Replace

- `forge/forge-generator-foundation.js`
- `forge/forge-engine.js`
- `forge/tactics-geometry.js`
- `forge/topography-test-mock.html`
- `forge/FORGE_MAP_CONTRACT_2.md`
- `forge/FORGE_PARAMETER_RECORD_2.md`
- `forge/FORGE_STAGE_OWNERSHIP_1.md`
- `forge/tests/smoke-snapshot-authority.js`
- `forge/tests/smoke-phase2c-archetype-params.js`
- `forge/tests/smoke-phase2d-stage-ownership.js`

## Add

- `forge/FORGE_VERTICAL_GEOMETRY_1.md`
- `forge/patch-phase2e-geometry-sync.js`
- `forge/tests/smoke-phase2e-elevations-connectors.js`
- `forge/tests/fixtures/tactics-geometry-phase15h.js`

## Required geometry synchronization

`tactics-geometry.js` is canonical and is inlined in two mocks. After replacing
the files above, run from the repository root:

```bash
node forge/patch-phase2e-geometry-sync.js
```

The patcher performs all guards before writing. It accepts only:

- the known Phase 1.5h/Phase 2d geometry copy; or
- the already-current Phase 2e copy.

It synchronizes:

- `forge/tactics-geometry.js`;
- `forge/topography-test-mock.html`;
- `battle-tactics-geo-mock.html`, whether that reference mock lives beside
  `forge/` or at repository root.

An unknown inline copy aborts the whole patch rather than overwriting it.

## What changed

### Bounded generated elevations

New staged maps use land floors at **5, 10, or 15 ft**. Pool/hazard beds may
remain at 0 ft. No adjacent open surfaces may differ by more than 10 ft.

The old visual shortcut that changed every lowest-tier floor into water is
removed. Terrain type now comes from the generated map rather than elevation
alone.

Wall cells inherit the highest adjacent supporting floor before their wall
height is added. They no longer sink to world zero beside an elevated room.

### First-class connectors

The height stage now emits snapshot-safe:

- `connectors[]` for generated stairs and ramps;
- `ledges[]` for every adjacent 10-ft drop.

Ordinary movement rules are:

- 0–5 ft: ordinary step;
- 10 ft: requires an open connector on that exact edge;
- climb/fly: retains its existing cliff authority;
- more than 10 ft: invalid in a new generated map.

The height stage deterministically selects enough 10-ft connectors to keep the
ordinary-creature movement graph connected. Other 10-ft boundaries remain real
unconnected ledges with alternate routes. It also records a small number of
5-ft stairs/ramps so visual transitions are authored data rather than anonymous
height seams.

### Renderer and staff overlay

Stairs and ramps render from their authoritative endpoints at tactical 100%
scale. Under the staff Forge menu, **Height → Show connectors** displays:

- gold: stairs / connected ledges;
- teal: ramps;
- red: unconnected ledges.

The overlay is staff-only and is automatically cleared when authority is not
available.

### Snapshot authority

New snapshots include `connectors[]` and `ledges[]` in their fingerprint.
Old snapshots remain readable:

- the stored old fingerprint is checked before normalization;
- missing vertical arrays restore as empty arrays;
- no old battlefield is regenerated or inferred from artwork.

Parameter record version remains 2. The generator version advances to
`2.0.0-elevations.1`; runtime cache stamps are `g2e1` and `fe5`.

## Browser checklist

1. Replace the Phase 2e files, run the geometry patcher, and hard-refresh once.
2. Confirm party sheets and **Enter the Forge** still load normally.
3. Open **Inspect map** and generate several Legacy dungeon seeds.
4. Confirm land appears on a bounded set of readable terraces and the lowest
   legal floor is not automatically painted as water.
5. Start combat and open **Forge → Height → Show connectors** as staff.
6. Confirm stairs are gold, ramps teal, and unconnected 10-ft ledges red.
7. Move an ordinary character across a connected 10-ft transition; it should
   succeed through the stairs/ramp.
8. Try an unconnected red 10-ft ledge; ordinary movement should refuse it.
9. Recheck the same edge with a climb/fly creature if available; its existing
   capability should still authorize the cliff.
10. Save/open a new shared session. Refresh and join from a second browser;
    connector placement and movement authority must remain identical.
11. Open a Phase 2d snapshot-backed session if available; its exact battlefield
    must remain unchanged and load with empty connector/ledge arrays.
12. Recheck visible damage arithmetic, multi-character claim, refresh movement
    remainder, conditional Cover Contest, cover audit, and Player View fog.
13. Run the full repository test battery after synchronization.

## Validation in this supplied working set

- snapshot authority: 24 green;
- Map Contract/render truth: 23 green;
- Phase 2b.1 field round: 30 green;
- Phase 2c parameter regression: 41 green;
- Phase 2d stage ownership: 36 green;
- Phase 2e vertical geometry: 39 green;
- **193 checks total**;
- foundation, engine, canonical geometry, and patcher parse;
- all three executable production inline scripts parse;
- production inline geometry is byte-identical to canonical geometry;
- patcher fixture verifies synchronization and unknown-copy refusal;
- both known startup-order guards remain before the initial rebuild.

The full Phase 1.5h repository suite still needs the complete repository because
`forge-discovery.js` and the remaining historical test dependencies are not in
this reduced working set.

## Known limits of this slice

- Generated connectors are single-edge stairs/ramps with first-pass meshes.
- Ledges do not yet implement falling, jumping, forced stops, rails, or one-way
  descent.
- Bridges, doors, tunnels, fords, ladders, and climb points remain future
  connector types.
- Edge blockers and authored 2.5-ft parapets remain the next map-contract work.
- The active layout grammar is still Legacy dungeon for every recorded
  archetype.

## Next slice

Broaden the connector language deliberately: multi-cell runs and the first
structural **bridges**, then doors/tunnels/fords only after bridge endpoints,
walk planes, rails, under-clearance, snapshot authority, and validation are
settled. Semantic objectives/spawn validation follows that connector base.

## Deploy rule

M uploads, commits, and pushes through GitHub. No push is included or implied.
