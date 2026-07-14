# Battle Forge Phase 1.5h — geometry and fog calibration

Phase 1.5h closes the two field issues discovered after the first firing-preview and fog pass:

1. low or narrow obstacles were producing cover too often;
2. unexplored fog was made from overlapping boxes, producing triangle/checker artifacts and leaking hidden room silhouettes.

This bite does not begin active Phase 2 terrain generation. It repairs the authority and presentation layers that Phase 2 maps will rely on.

## Cover calibration

### Visibility and cover are separate questions

The geometry still uses real terrain height, `occ[]`, dead ground, target-side attribution, ledge peek, and parapet lean. The change is how partial cover is graded.

The old model traced four target corners at two heights: feet and head. A low lip could block all four foot rays and immediately count as half cover even though most of the creature remained visible.

The new model traces **twelve target-body samples**:

- four inset horizontal corners;
- lower body, torso, and head/shoulder bands.

Target-side blocked samples grade as:

| Target-side body samples blocked | Result |
|---:|---|
| 0–5 | No cover |
| 6–8 | Half cover, +2 |
| 9–11 | Three-quarters cover, +5 |
| all 12 blocked anywhere | Total cover |

This is a deterministic 3D interpretation of the tabletop body-coverage rule, not a claim that the tabletop rules prescribe twelve rays.

### Sub-cell obstruction footprints

Height alone is no longer required to make a prop fill an entire five-foot cell. The map may carry optional `coverShape[]` descriptors:

```js
{ kind: "full", source: "wall" }
{ kind: "circle", radius: 0.18, source: "tree" }
{ kind: "box", halfX: 0.22, halfY: 0.30, source: "column" }
```

The production surface assigns first-pass shapes to tactical props. Walls and terrain remain full-cell solids. Trees, columns, rocks, reeds, mushrooms, and similar props use narrower circles or boxes.

This is the contract Phase 2 tactical props will deepen. A prop’s picture, footprint, height, and rules must ultimately agree.

### Intervening creatures

`map.creatures[]` may now provide sub-cell creature silhouettes for attack cover. Dead creatures are ignored. Discovery sight deliberately calls geometry with `ignoreCreatures:true`, so transient bodies do not alter which static terrain the party remembers.

### Legal firing eyes

The engine retains:

- center eye;
- target-facing lip corners;
- immediately adjacent target-facing parapet lean;
- target-facing inset attacker corners where they do not create a wall-corner loophole.

The winning eye still travels with the verdict so visible sight lines originate from the ruling that authorized the shot.

### Cover audit

Authorized staff can open **Forge → Run cover audit**. The audit samples legal battlefield pairs and posts a System-feed summary:

```text
Clear 48.2% · Half 31.6% · ¾ 12.0% · Total 8.2%
Culprits: wall … · tree … · creature …
```

This is calibration instrumentation, not gameplay authority. Cover Contest remains the adjudication escape hatch.

## Fog renderer calibration

### Removed

The first renderer created one tall box for every unexplored cell and enlarged each box slightly. Adjacent coplanar faces overlapped and fought in the depth buffer, producing the triangular/checker pattern seen in the field screenshot. Box heights also followed hidden walls and occluders, leaking room architecture.

### Current renderer

The new renderer uses two layers:

1. **Per-instance discovery state**
   - visible terrain renders normally;
   - explored terrain renders as dark remembered terrain;
   - unexplored terrain instances are collapsed out of view;
   - props, decals, grid marks, local lights, and decorative cards render only while their cells are currently visible.

2. **One continuous world-space unexplored veil**
   - generated from the cell-state mask;
   - rendered above the battlefield with `depthTest:false` and `depthWrite:false`;
   - replaces thousands of overlapping fog surfaces;
   - does not use hidden wall or prop height to shape the darkness.

Player View remains the discovery presentation. Staff View remains omniscient.

## Canonical-copy rule

`tactics-geometry.js` remains inlined in both tactical mocks. This bundle provides:

- exact replacement `forge/tactics-geometry.js`;
- exact replacement `forge/topography-test-mock.html` with byte-identical inline geometry;
- a guarded browser/Node patcher for the current `battle-tactics-geo-mock.html` reference file.

Do not leave the reference mock on the old eight-ray geometry.

## Validation

The cumulative bundle contains **426 green checks**, including:

- 50 authoritative LoS/cover cases;
- 15 focused cover-calibration cases;
- 41 discovery cases;
- 20 Phase 1.5h integration-contract cases;
- one byte-identity geometry-sync check;
- all retained Phase 1.5d–g, effects, combat-rules, table-correctness, token-art, and proxy checks.

## Field checks still required

- Low lips should usually be clear rather than automatic half cover.
- Waist-high full barriers should normally grant half cover.
- Narrow trees and columns should not behave as five-foot walls.
- Intervening creatures should sometimes grant half cover.
- Cover Contest must still override a disputed shot.
- Unexplored fog should no longer show triangular/checker artifacts.
- Hidden room heights, walls, props, and lights should not sculpt the fog silhouette.
- Explored terrain should remain dark and readable in both 3D and top-down views.
- Run the staff cover audit on several real seeds before changing thresholds again.

## Next phase

After the browser/two-device field pass, begin active Phase 2 generator terrain:

1. snapshot-first session loading with legacy recipe fallback;
2. archetype selector and parameter records;
3. actual stage-seed ownership;
4. constrained elevations and first-class connectors;
5. semantic spawns and objectives;
6. validation, local repair, and stage-specific retry;
7. graph, critical-path, semantics, height, connector, cover, and spawn overlays;
8. expand tactical prop footprints from this Phase 1.5h seam.
