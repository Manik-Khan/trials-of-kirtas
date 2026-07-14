# Forge Vertical Geometry 1

**Status:** Phase 2e contract  
**Date:** 2026-07-14  
**Scope:** bounded generated floor elevations, first-class stairs and ramps, explicit ledges, movement authority, rendering, snapshots, and validation

This contract implements the first vertical slice of `FORGE_MAP_CONTRACT_2.md`. It does not introduce bridges, doors, tunnels, fords, ladders, jump links, edge walls, or authored 2.5-ft parapets. Those remain later slices.

## 1. Measurement model

- The gameplay grid remains the ordinary **5-ft movement grid**.
- Authoritative floor elevations remain feet, not renderer units.
- New generated land uses 5-ft floor tiers bounded to **5, 10, or 15 ft**.
- Generated pool/hazard beds may remain at 0 ft and are excluded from ordinary movement when the rules record says water blocks.
- The datum is arbitrary: a 5-ft lowest land floor is not “floating.” It keeps the global water plane below legal ground while preserving all relative D&D measurements.
- A single generated stair/ramp edge may rise at most **10 ft**. Larger adjacent differences are invalid.

## 2. Height-stage product

The height stage owns one deterministic record:

```js
{
  h: Number[],
  connectors: Connector[],
  ledges: Ledge[],
  meta: {
    vertical: {
      version: 1,
      maxElevationFt: 15,
      orientation: "entrance-high" | "boss-high" | "flat",
      connectors: Number,
      ledges: Number
    }
  }
}
```

Its stage fingerprint includes `h`, `connectors`, and `ledges`. Changing the height seed may alter those records but may not alter layout, semantics, decor, or foe placement.

## 3. Connector record

Phase 2e emits only `stairs` and `ramp` connectors:

```js
{
  id: "height-connector-0",
  kind: "stairs" | "ramp",
  from: { c, r, elevationFt },
  to:   { c, r, elevationFt },
  path: [{ c, r, elevationFt }, ...],
  widthFt: 5,
  clearanceFt: null,
  movementCostFt: 5,
  requires: { climb:false, jump:false, swim:false, fly:false },
  oneWay: false,
  blocksWhenClosed: false,
  state: "open",
  deltaFt: 5 | 10,
  source: "height",
  render: { generated:true }
}
```

The endpoints are cardinally adjacent in this slice. The wider contract allows longer paths later for bridges, stair runs, tunnels, and fords.

A 5-ft rise is already legal under the ordinary step rule. The generator still records a small, deterministic set of those transitions as stairs/ramps so the renderer and future importer share authored connector language rather than anonymous terrain seams.

A 10-ft rise is not an ordinary step. It becomes traversable only when an open connector authorizes that exact edge, or the creature has an existing capability such as climb or fly.

## 4. Ledge record

Every generated adjacent 10-ft drop is explicit:

```js
{
  id: "height-ledge-0",
  a:    { c, r, elevationFt },
  b:    { c, r, elevationFt },
  high: { c, r, elevationFt },
  low:  { c, r, elevationFt },
  dropFt: 10,
  connectorId: "height-connector-0" | null,
  source: "height"
}
```

A ledge with a connector is the vertical boundary crossed by those stairs or that ramp. A ledge without a connector is a real cliff edge: ordinary movement cannot cross it, but climb/fly capabilities retain their existing authority.

Phase 2e stores ledges separately rather than pretending they are walls. A later edge-blocker slice may add drop-edge behavior such as forced stops, jumping, falling, rails, or one-way descent without changing the floor data.

## 5. Generation and repair

1. Layout supplies the open-cell topology and graph facts.
2. Height assigns room/corridor tiers between 5 and 15 ft.
3. Adjacent open cells are locally clamped to a maximum 10-ft difference.
4. Ordinary 0/5-ft edges form movement components.
5. Deterministically selected 10-ft edges receive stairs/ramps until those components are connected.
6. Remaining 10-ft edges remain unconnected ledges and therefore create tactical cliffs with alternate routes.
7. A small deterministic sample of 5-ft transitions receives connector records for visual/authoring truth.
8. Vertical validation runs before spawn acceptance.

This is a local height-stage product. It does not reroll layout, semantics, decor, or foes.

## 6. Movement authority

Movement checks the destination wall, then vertical difference:

- `0–5 ft`: ordinary movement is allowed.
- `>5 ft`: an open connector must match the crossed edge.
- `>10 ft`: invalid in generated Phase 2e maps.
- `climb` or `fly`: retains the existing ability to cross cliffs without a generated stair/ramp.
- closed or broken connector: authorizes nothing.
- one-way connector: reverse traversal is refused.
- future connector requirements (`jump`, `swim`, etc.) are already schema-safe but are not generated here.

The engine validator and canonical tactics geometry implement the same rule independently, and smoke tests freeze their agreement.

## 7. Rendering and overlays

- Terrain remains rendered directly from authoritative `h[]` at tactical 100% scale.
- Stairs render as stepped solid treads between their endpoint floors.
- Ramps render as inclined solid strips between endpoint floors.
- Connector art is derived from connector records; it never changes the recorded rise.
- Terrain cliff sides already visualize ledges.
- Staff may toggle a connector/ledge overlay:
  - stairs: gold;
  - ramps: teal;
  - unconnected ledges: red;
  - ledges with connectors: gold.
- Player View does not expose the staff overlay.

Floor elevation no longer changes a generated floor cell into water for visual effect. Only explicit pool terrain is water.

## 8. Snapshot and compatibility

`mapSnapshot` now carries `connectors[]` and `ledges[]`. They are included in new fingerprints and restored as detached records.

Compatibility rules:

- old snapshots without these keys restore with empty arrays;
- their original stored fingerprint is checked before normalization, so they remain readable;
- version-1 snapshot-less recipes retain the legacy monolithic generator and its old elevation behavior;
- new parameter-version-2 staged maps receive the Phase 2e vertical contract;
- present-but-malformed connectors or ledges stop loudly and never fall back to regeneration.

## 9. Validation

A staged map is refused when:

- any generated land elevation lies outside 5–15 ft;
- any adjacent open-cell difference exceeds 10 ft;
- a connector endpoint is outside the map, blocked, non-cardinal, or disagrees with `h[]`;
- a generated connector is not stairs/ramp, is duplicated, or rises more than 10 ft;
- a ledge is not a cardinal 10-ft boundary;
- a ledge references a missing connector;
- PC and foe spawns are not mutually reachable for an ordinary creature using open connectors.

## 10. Deferred work

The next vertical/connectivity slices may add:

- multi-cell stair and ramp paths;
- bridges and their rails/clearance;
- doors, tunnels, and fords;
- ladders, climb points, jumps, falling, and one-way drops;
- first-class edge blockers and 2.5-ft parapets;
- connector-aware difficult movement costs;
- local height/connector retry and repair overlays;
- image-import annotation tools that author these same records.
