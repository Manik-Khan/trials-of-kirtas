# Forge Structural Bridges 1

**Phase:** 2f  
**Generator:** `2.0.0-bridges.1`  
**Depends on:** `FORGE_MAP_CONTRACT_2.md`, `FORGE_VERTICAL_GEOMETRY_1.md`

This contract extends the Phase 2e connector vocabulary from single-edge stairs and ramps to multi-cell structural bridges. The bridge record is rules authority; the mesh is only its rendering.

## 1. Bridge record

A bridge is a first-class connector:

```js
{
  id: "height-bridge-0",
  kind: "bridge",
  from: { c, r, elevationFt },
  to:   { c, r, elevationFt },
  path: [
    { c, r, elevationFt }, // first land endpoint
    // every consecutive deck cell
    { c, r, elevationFt }, // last land endpoint
  ],
  widthFt: 5,
  movementCostFt,
  deckThicknessFt: 0.5,
  clearanceFt,
  rails: {
    left: true,
    right: true,
    heightFt: 2.5,
    thicknessFt: 0.25
  },
  surface: "bridge-deck",
  supportsUnderpass: false,
  oneWay: false,
  state: "open" // open | closed | broken
}
```

`path[]` owns the complete traversal. Every consecutive point must be cardinally adjacent. A unit may enter a blocked bridge cell only along one of those authored path segments; diagonal and side entry into the middle of a span are illegal.

## 2. Generated bridge bounds

Phase 2f generates deterministic bridges only where the current legacy dungeon contains:

- an open land endpoint;
- one to four consecutive `POOL` cells;
- a second open land endpoint;
- endpoint elevations differing by no more than 5 ft;
- positive clearance below the half-foot deck.

The height seed owns candidate order and selection. At most two non-overlapping generated bridges are selected. A map with no valid pool span receives no bridge; the generator does not invent water or rewrite layout to force one.

Later archetype grammars may author bridges over lava, chasms, roads, and other hazards through the same record.

## 3. Movement authority

An open bridge surface overrides the blocked underlying pool cell for occupancy. The creature stands at the path point's `elevationFt`, not at the pool bed.

- Entering, traversing, and leaving the bridge follows consecutive `path[]` segments.
- Side or diagonal entry into an interior bridge cell is refused.
- `closed` and `broken` bridges expose no walk surface.
- The normal 5-ft movement grid remains unchanged.
- Bridge length contributes one 5-ft move per path segment.

Phase 2f does not support two creatures occupying different vertical layers of the same `(c,r)` cell. `supportsUnderpass:false` records that occupancy limitation explicitly.

## 4. Sight and cover authority

The underlying pool or void is not promoted into a full-height column.

- The bridge deck blocks a ray only through its actual slab thickness.
- Space below the slab remains sight-open up to `clearanceFt`.
- Rails are 2.5-ft edge blockers with their own thickness.
- Rails may contribute cover when a sampled ray crosses the actual rail footprint.
- A broken bridge removes deck and rail authority.

This is distinct from under-bridge occupancy: Phase 2f models optical clearance but not a second walk surface beneath the same grid cell.

## 5. Rendering truth

The renderer consumes the same feet contract as geometry:

- deck elevation comes from each path point;
- deck thickness comes from `deckThicknessFt`;
- rail height and thickness come from `rails`;
- tokens on the bridge use the same deck elevation;
- the Height overlay draws bridge paths in blue.

Visual supports are decorative. They do not silently create movement or LoS blockers.

## 6. Snapshot and stage ownership

`mapSnapshot.connectors[]` preserves the complete bridge record and participates in the map fingerprint. Snapshot load never regenerates or repairs a bridge.

Bridge selection is owned by the `height` stream. It therefore participates in the height-stage fingerprint and cannot alter layout, semantics, decor, or foes.

## 7. Validation

A bridge is invalid when any of these are true:

- missing or duplicate ID;
- fewer than three path points;
- non-cardinal or discontinuous path;
- endpoint is blocked or disagrees with map elevation;
- interior deck cell is not over a blocked base cell;
- deck intersects the base surface;
- non-positive width, thickness, or clearance;
- interior cell overlaps another bridge;
- state is outside `open | closed | broken`.

Invalid generated maps are refused rather than rendered approximately.

## 8. Deferred

Not included in Phase 2f:

- doors, tunnels, and fords;
- drawbridges or animated state changes;
- destructible bridge hit points;
- units moving beneath a bridge;
- multi-lane or diagonal bridges;
- bridge-specific objectives or spawn influence;
- image-import annotation UI.
