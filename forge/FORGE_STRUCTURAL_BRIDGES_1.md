# Forge Structural Bridges 1

**Phase:** 2f.4
**Generator:** `2.0.0-bridges.2`
**Depends on:** `FORGE_MAP_CONTRACT_2.md`, `FORGE_VERTICAL_GEOMETRY_1.md`

This contract extends the Phase 2e connector vocabulary from single-edge stairs and ramps to multi-cell structural bridges. The bridge record is rules authority; the mesh is only its rendering.

## 1. Bridge record

A bridge is a first-class connector:

```js
{
  id: "height-bridge-<path-hash>",
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

## 2. Stable structural identity

Generated bridge identity is derived from the exact ordered path, including elevation at every point. It is not derived from array position.

```text
path signature
→ deterministic hash
→ height-bridge-<path-hash>
```

Consequences:

- inserting or removing another bridge does not silently rename an unchanged span;
- snapshot save/load preserves the same ID and path signature;
- multiplayer live-state edits carry `path_signature` as proof;
- a replay edit whose proof does not match the current connector is refused rather than applied to the wrong structure.

The complete connector record remains part of the map snapshot and fingerprint.

## 3. Generated bridge bounds

Phase 2f generates deterministic bridges only where the current legacy dungeon contains:

- an open land endpoint;
- one to four consecutive `POOL` cells;
- a second open land endpoint;
- endpoint elevations differing by no more than 5 ft;
- positive clearance below the half-foot deck.

The height seed owns candidate order and selection. At most two non-overlapping generated bridges are selected. A map with no valid pool span receives no bridge; the generator does not invent water or rewrite layout to force one.

Later archetype grammars may author bridges over lava, chasms, roads, and other hazards through the same record.

## 4. Movement authority

An open bridge surface overrides the blocked underlying pool cell for occupancy. The creature stands at the path point's `elevationFt`, not at the pool bed.

- Entering, traversing, and leaving the bridge follows consecutive `path[]` segments.
- Side or diagonal entry into an interior bridge cell is refused.
- `closed` and `broken` bridges expose no interior walk surface.
- The authored land endpoints remain ordinary terrain when the bridge is unavailable.
- The normal 5-ft movement grid remains unchanged.
- Bridge length contributes one 5-ft move per path segment.

Phase 2f does not support two creatures occupying different vertical layers of the same `(c,r)` cell. `supportsUnderpass:false` records that occupancy limitation explicitly.

## 5. Sight and rail-cover authority

The underlying pool or void is not promoted into a full-height column.

- The bridge deck blocks a ray only through its actual slab thickness.
- Space below the slab remains sight-open up to `clearanceFt`.
- Rails are 2.5-ft edge blockers with their own thickness.
- A ray that crosses the target-side rail footprint establishes at least half cover when two or more body samples are blocked.
- Cover evidence names `bridge-rail` as the culprit.
- A closed or broken bridge removes deck and rail authority.

This is distinct from under-bridge occupancy: Phase 2f models optical clearance but not a second walk surface beneath the same grid cell.

## 6. Rendering truth

The renderer consumes the same feet contract as geometry:

- deck elevation comes from each path point;
- deck thickness comes from `deckThicknessFt`;
- rail height and thickness come from `rails`;
- tokens on the bridge use the same deck elevation;
- the Height overlay draws open bridge paths in blue, closed in amber, and broken in red;
- selecting a bridge marks both endpoints and every path point for staff inspection.

Visual supports are decorative. They do not silently create movement or line-of-sight blockers.

## 7. Snapshot, replay, and live state

`mapSnapshot.connectors[]` preserves the complete authored bridge record and participates in the map fingerprint. Snapshot load never regenerates or repairs a bridge.

Bridge selection is owned by the `height` stream. It therefore participates in the height-stage fingerprint and cannot alter layout, semantics, decor, or foes.

The snapshot `state` is the encounter baseline. During a live fight, the overseer may publish:

```js
{
  kind: "edit",
  payload: {
    changes: [
      {
        connector_state: {
          id: "height-bridge-<path-hash>",
          state: "closed",
          path_signature: "<ordered path proof>"
        }
      }
    ]
  }
}
```

Replay stores:

- the latest valid override in `connectorStates[id]`;
- the matching identity proof in `connectorStateProofs[id]`.

Rendering, movement, sight/discovery reconciliation, refresh, reconnect, rewind, and correction consume that replay-derived state. The live override does not mutate the map snapshot or its fingerprint.

When a rewind or correction removes the latest override, the runtime restores the captured snapshot baseline. It does not leave the connector stranded in the former live state.

State edits are refused while an action/animation is unsettled or while any combatant occupies an **interior span cell**. A creature standing on a land endpoint does not prevent the bridge from closing or breaking because the endpoint remains ordinary terrain.

State authority:

- `open`: physical deck/rails/supports render; path is traversable; rail cover is active;
- `closed`: no interior walk surface or rail cover; amber route marker remains for staff clarity;
- `broken`: no interior walk surface or rail cover; red broken-route marker remains for staff clarity.

## 8. Staff controls and audit

The active Height / Vertical Geometry section exposes each generated bridge as a staff card with:

- stable ID and span length;
- clearance;
- current state;
- occupied/clear status;
- movement and rail-cover audit result;
- **Inspect**, **Open**, **Closed**, and **Broken** controls.

**Audit bridges** verifies, from the canonical map and geometry layer:

1. deterministic path-derived identity;
2. cardinal path continuity;
3. open traversal in both directions unless one-way;
4. closed and broken interior-span refusal;
5. preservation of usable land endpoints;
6. rail footprint and cover behavior.

An audit failure is staff-visible and must not be hidden by successful rendering.

## 9. Validation

A bridge is invalid when any of these are true:

- missing or duplicate ID;
- ID does not agree with the generated path identity for a newly generated bridge;
- fewer than three path points;
- non-cardinal or discontinuous path;
- endpoint is blocked or disagrees with map elevation;
- interior deck cell is not over a blocked base cell;
- deck intersects the base surface;
- non-positive width, thickness, or clearance;
- interior cell overlaps another bridge;
- state is outside `open | closed | broken`.

Invalid generated maps are refused rather than rendered approximately.

## 10. Deferred

Not included in Phase 2f.4:

- doors, tunnels, and fords;
- animated/timed drawbridge transitions;
- destructible bridge hit points;
- units moving beneath a bridge;
- multi-lane or diagonal bridges;
- bridge-specific objectives or spawn influence;
- image-import annotation UI.
