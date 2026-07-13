# Battle Forge Phase 2 — generator foundation

Version: `2.0.0-foundation.2`

## Architectural correction

The current `forge-dungeon.js` already performs the structural graph work Phase 2 needs:

1. scatter room seeds;
2. separate overlaps;
3. create Delaunay candidate edges;
4. reduce to a minimum spanning tree;
5. restore tunable loops;
6. assign BFS depth and room semantics;
7. mark the critical route.

Phase 2 therefore begins by exposing and versioning that graph. It must not build a competing graph generator beside it.

## New encounter envelope

Saved session `map` values retain the old top-level recipe keys so current readers keep working:

```js
{
  seed,
  theme,
  sliders,

  generatorVersion: "2.0.0-foundation.2",
  archetype: "legacy-dungeon",
  stageSeeds: {
    layout,
    height,
    semantics,
    decor,
    foes
  },

  mapSnapshot: {
    cols, rows, h, wall, occ, spawns, props, meta
  },
  mapFingerprint,
  graph: {
    nodes,
    edges,
    entrance,
    boss,
    maxDepth,
    overlays,
    summary
  }
}
```

`mapSnapshot` is plain JSON and is detached from the live typed arrays. It records current board-unit spawn positions when they exist and falls back to the generator's semantic marks before combat placement. It is the authoritative save artifact. The seed and parameters remain the reproducible recipe and authoring history.

This foundation writes the snapshot but deliberately leaves current session boot recipe-compatible. Snapshot-first loading is the next integration step, after the envelope is approved and existing session compatibility is tested.

## Stage-seed rule

Every stage derives from the root seed and a stable label. A stage can later be rerolled by replacing only its seed.

- `layout`: room placement and topology
- `height`: elevation assignment and height constraints
- `semantics`: room roles, objectives, encounter intent
- `decor`: visual-only and rules-relevant decoration streams
- `foes`: roster composition and placement

This bite records those seeds but does not yet force the old monolithic generator to consume them. Changing the random stream now would silently change every existing seed.

## Archetype contract

Ratified keys:

- `valley`
- `canyon`
- `central-hill`
- `ring`
- `split-plateau`
- `bridge-crossing`
- `island-chain`
- `courtyard`
- `cavern-chambers`
- `temple-terraces`
- `ridge`
- `basin`

`legacy-dungeon` is the compatibility key for the current behavior.

## Next terrain bite

1. Add an archetype selector and archetype parameter records.
2. Make `layout` seed own scatter/separation/topology.
3. Make `semantics` seed own room intent and objectives.
4. Assign elevations from the `height` seed under bounded-tier and route constraints.
5. Emit connectors as first-class data: ramps, stairs, bridges, doors, tunnels, ledges, and fords.
6. Place semantic PC/foe/objective spawns.
7. Validate normal-creature routes, spawn fairness, objective access, melee access, cover, chokepoints, and sightlines.
8. Repair locally where possible; retry only the failed stage when not.
9. Add graph, critical path, semantics, height, cover, spawn-influence, and connector debug overlays.
10. Split rules-relevant props from visual-only decoration.

## Camera/fog dependency

The camera mock is intentionally separate from the generator. Fog authority remains world-space and map-cell based; the camera never decides what a player knows.
