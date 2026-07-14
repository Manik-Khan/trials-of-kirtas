# Forge Map Contract 2.0

**Status:** architectural contract for Battle Forge Phase 2 and the future image-to-dungeon importer  
**Date:** 2026-07-14  
**Scope:** terrain, vertical geometry, blockers, connectors, rules/render agreement, validation, and import annotations

This document does not replace the current map document in one migration. It defines the target language that the procedural generator, combat geometry, renderer, snapshots, debug overlays, tactical-prop authoring, and future image importer must share.

The current `{cols, rows, h[], wall[], occ[], coverShape[], spawns[], props[], meta}` document remains readable throughout the migration. New first-class records are added beside it. Legacy fields are removed only after every producer and consumer has moved to the same contract.

---

## 1. Design principles

1. **The gameplay grid remains five feet.** Movement, occupancy, range presentation, token placement, and ordinary D&D counting continue to use 5 × 5 ft cells.
2. **Vertical geometry is stored in feet.** Terrain, walls, rails, parapets, props, eyes, bodies, bridges, and clearances all use the same unit.
3. **Two-and-a-half-foot increments are allowed without creating a 2.5-ft movement grid.** A 2.5-ft wall is a vertical measurement or blocker height, not a new combat square.
4. **Terrain, movement, vision, cover, and art are separate properties.** A thing may affect one without affecting the others.
5. **Edges are first-class.** Walls, fences, doors, railings, drops, and many connectors sit between cells; they should not be forced to occupy an entire 5-ft cell.
6. **Rules data is authoritative.** The picture must be derived from the rules document, never the reverse at runtime.
7. **Tactical play is visually truthful.** Players may not flatten or exaggerate the battlefield into a picture that contradicts line of sight, cover, height, or reach.
8. **Snapshots preserve every rules-relevant fact.** Loading a saved encounter must not regenerate or infer combat geometry.
9. **Automatic generation and image import produce the same map language.** Validation and rendering must not care which tool authored the map.
10. **Uncertainty is explicit.** Import guesses carry confidence/provenance and are corrected before a map becomes authoritative.

---

## 2. Coordinates and measurements

### 2.1 Horizontal coordinates

- `c`, `r`: integer 5-ft gameplay cell coordinates.
- Local positions inside a cell use normalized coordinates from `0` to `1`.
- A sub-cell footprint may therefore describe a narrow wall, tree trunk, column, statue, or other shape without changing token movement resolution.
- World-space X/Z continues to place one 5-ft cell at one renderer unit unless a future renderer migration changes the global scale deliberately.

### 2.2 Vertical coordinates

- All authoritative vertical values are in feet.
- `h[i]` is the walkable terrain floor elevation at cell `i`.
- Blocker height is measured above its supporting floor unless an absolute bottom/top is explicitly provided.
- Generated terrain should normally use 5-ft tiers at first, but authored/imported geometry may use 2.5-ft increments where that improves table truth.
- Geometry functions must not assume that every height is divisible by five.

Examples:

| structure | floor elevation | added height | solid top |
|---|---:|---:|---:|
| knee wall | 0 ft | 2.5 ft | 2.5 ft |
| parapet on terrace | 10 ft | 2.5 ft | 12.5 ft |
| ordinary wall | 0 ft | 10 ft | 10 ft |
| bridge deck | 15 ft | deck thickness is render data; walk plane is 15 ft | 15 ft |
| column | 5 ft | 15 ft | 20 ft |

### 2.3 Creature dimensions

The default Medium-creature contract remains compatible with the current geometry:

- occupied footprint: one 5-ft cell;
- ordinary eye height: 5 ft above floor;
- body sample bands: lower body, torso, head/shoulders;
- optional per-creature `heightFt`, `eyeFt`, and `radius` override size-specific silhouettes.

Creature dimensions and terrain scale must use the same feet-to-world conversion.

---

## 3. Map document 2.0

### 3.1 Required core

```js
{
  cols: Number,
  rows: Number,
  h: Number[],          // floor elevation in feet
  wall: Boolean[],      // legacy compatibility field
  occ: Number[],        // legacy/full-cell added occluder height in feet
  coverShape: Array,    // legacy/full-cell sub-cell footprint descriptors
  spawns: Array,
  props: Array,
  meta: Object
}
```

`h`, `wall`, `occ`, and `coverShape` remain supported while first-class edge blockers and connectors are introduced.

### 3.2 Target additions

```js
{
  terrain: TerrainCell[],
  edgeBlockers: EdgeBlocker[],
  connectors: Connector[],
  hazards: HazardRegion[],
  objectives: Objective[],
  regions: SemanticRegion[],
  annotations: ImportAnnotation[]
}
```

Not every field must ship in the same patch. Once introduced, it must be snapshot-safe and versioned.

### 3.3 Terrain cell

A terrain record describes the floor, not every object occupying the cell.

```js
{
  type: "stone" | "grass" | "water" | "lava" | "mud" | "ice" | String,
  walkable: Boolean,
  difficult: Boolean,
  blocksMovement: Boolean,
  hazardId: String | null,
  regionId: String | null,
  source: "generated" | "imported" | "authored"
}
```

`h[i]` remains the authoritative floor elevation. A water/lava surface may have visual depth, but its movement and damage behavior must be explicit rather than inferred from color.

### 3.4 Cell blocker / tactical prop

Rules-relevant props must carry explicit geometry. Decorative props must declare themselves visual-only.

```js
{
  id: String,
  kind: String,
  c: Number,
  r: Number,
  bottomFt: Number,          // normally local floor elevation
  heightFt: Number,
  footprint: {
    kind: "full" | "circle" | "box" | "polygon",
    cx: Number,
    cy: Number,
    radius: Number,
    halfX: Number,
    halfY: Number,
    points: Array
  },
  blocksMovement: Boolean,
  blocksVision: Boolean,
  grantsCover: Boolean,
  difficultTerrain: Boolean,
  destructible: Boolean,
  rulesRelevant: Boolean,
  render: Object
}
```

`render` may select art, rotation, material, and visual effects. It may not silently change `heightFt` or footprint.

### 3.5 Edge blocker

Many walls should occupy the boundary between squares instead of a whole square.

```js
{
  id: String,
  a: { c: Number, r: Number },
  b: { c: Number, r: Number },
  edge: "N" | "E" | "S" | "W",
  bottomFt: Number,
  heightFt: Number,
  thicknessFt: Number,
  kind: "wall" | "low-wall" | "fence" | "railing" | "door" | "gate" | "drop",
  blocksMovement: Boolean,
  blocksVision: Boolean,
  grantsCover: Boolean,
  passableWhenOpen: Boolean,
  state: "open" | "closed" | "broken" | null,
  connectorId: String | null,
  render: Object
}
```

A 2.5-ft parapet can therefore sit on a cell edge, block crossing, cover only the appropriate body samples, and remain visible at the correct physical height.

### 3.6 Connector

A connector explains how two otherwise distinct walk surfaces relate.

```js
{
  id: String,
  kind: "stairs" | "ramp" | "ladder" | "bridge" | "door" | "tunnel" | "ford" | "jump" | "climb",
  from: { c: Number, r: Number, elevationFt: Number },
  to:   { c: Number, r: Number, elevationFt: Number },
  path: [{ c: Number, r: Number, elevationFt: Number }],
  widthFt: Number,
  clearanceFt: Number | null,
  movementCostFt: Number | null,
  requires: {
    climb: Boolean,
    jump: Boolean,
    swim: Boolean,
    fly: Boolean
  },
  oneWay: Boolean,
  blocksWhenClosed: Boolean,
  state: "open" | "closed" | "broken" | null,
  render: Object
}
```

A bridge is not merely a decorative prop. It owns a walk plane, endpoints, width, clearance, rails/cover where applicable, and the terrain or hazard beneath it.

### 3.7 Ledge

A ledge records an abrupt vertical boundary between adjacent walk surfaces. It is not a wall and does not itself invent a traversal.

```js
{
  id: String,
  a: { c: Number, r: Number, elevationFt: Number },
  b: { c: Number, r: Number, elevationFt: Number },
  high: { c: Number, r: Number, elevationFt: Number },
  low: { c: Number, r: Number, elevationFt: Number },
  dropFt: Number,
  connectorId: String | null,
  source: "generated" | "imported" | "authored" | "height"
}
```

Phase 2e introduces `ledges[]` beside `connectors[]`. A ledge with no connector is a cliff for ordinary movement. A linked stair/ramp authorizes that exact edge. A later edge-blocker migration may enrich drops with rails, falling, one-way descent, and jump/climb rulings without changing floor elevations.

---

## 4. Geometry responsibilities

### 4.1 Terrain elevation

- `h[]` determines the creature’s supporting floor.
- A height difference does not automatically say whether movement is legal; ordinary step rules and explicit connectors decide that.
- A cliff face may be represented by adjacent floor elevations plus an impassable edge/drop record.

### 4.2 Movement

Movement checks, in order:

1. destination cell is walkable;
2. no blocking creature or full-cell blocker occupies it;
3. the crossed edge permits travel;
4. the elevation change is within ordinary step allowance, or a connector/capability authorizes it;
5. movement cost and hazards are applied.

A thin wall between cells should block crossing without making either adjacent 5-ft square unusable.

### 4.3 Sight and cover

- Sight rays operate in continuous 3D feet.
- Full-cell terrain/blockers, sub-cell footprints, edge blockers, and creature silhouettes all participate.
- Cover remains body-sample based and target-side attributed.
- A blocker’s vertical top is `bottomFt + heightFt`.
- A 2.5-ft barrier should hide only the body portions it physically intersects; it is not automatically half cover.
- A closed door may block movement and sight. An open door must cease doing so without regenerating the map.

### 4.4 Legacy compatibility

Until edge blockers are fully integrated:

- `wall[i] + occ[i]` continues to represent a full-cell blocker;
- `coverShape[i]` narrows its horizontal footprint;
- a migration utility may convert suitable legacy walls into edge blockers only when the intended edge is unambiguous;
- no loader may guess a rules-changing edge from artwork alone.

---

## 5. Rules-to-render agreement

### 5.1 Tactical scale

The tactical view uses one authoritative conversion:

```js
worldPerFoot = 1 / 5;
worldY = feet * worldPerFoot;
```

At tactical scale:

- 5 ft of elevation = 1 world unit;
- a 2.5-ft wall = 0.5 world unit;
- creature eyes, body size, props, rails, walls, bridges, fog, targeting rays, and token grounding all use the same conversion.

### 5.2 No deceptive player scale

During an active combat or loaded session:

- vertical scale is fixed at 100%;
- the user cannot flatten or exaggerate terrain;
- sight lines must start/end at the same heights used by the geometry verdict;
- a visually low wall cannot remain mathematically tall, and a visually tall wall cannot be mathematically short.

### 5.3 Authoring inspection scale

A visual vertical-scale control may remain before combat for terrain inspection.

It must be labeled as authoring-only, default to 100%, and reset to 100% before tactical play. It is not a game rule and is never persisted into `mapSnapshot`.

### 5.4 Render-only data

Textures, decals, particles, atmospheric backdrops, decorative scatter, and mesh thickness may be render-only. Any visual mass that appears solid enough to affect tactical judgment must have matching rules geometry or be visibly identified as decoration.

---

## 6. Generator responsibilities

The procedural generator should produce maps in independently retryable stages:

1. `layout` — regions, graph, paths, boundaries;
2. `height` — bounded floor elevations;
3. `semantics` — entrance, objective, hazards, encounter roles;
4. `decor` — rules props and visual decoration kept distinct;
5. `foes` — encounter/spawn influence.

The height stage may assign 5-ft terrain tiers initially. The semantics/decor stages may add 2.5-ft parapets, rails, low walls, tombstones, and similar structures.

Connector generation must occur after height assignment and before final validation. Local repair should alter only the failed stage or affected neighborhood whenever possible.

---

## 7. Image-import annotation vocabulary

The future importer must emit this same contract. Automatic analysis proposes annotations; the user confirms or corrects them.

Required authoring tools:

- **scale/grid calibration** — cell size and image alignment;
- **walkable-region brush/lasso**;
- **terrain-type brush** — stone, ground, water, lava, pit, difficult terrain;
- **height-region fill/brush** — exact feet or tier value;
- **raise/lower tool** — normally 2.5-ft or 5-ft steps;
- **wall-edge tool**;
- **low-wall/fence/railing tool**;
- **full-cell blocker/prop footprint tool**;
- **stairs/ramp/ladder/bridge/door/tunnel/ford connector tool**;
- **hazard and objective regions**;
- **decorative-only mask**;
- **uncertainty review overlay**.

Suggested annotation record:

```js
{
  id: String,
  kind: "terrain" | "height" | "edge" | "blocker" | "connector" | "hazard" | "objective" | "decor",
  geometry: Object,
  value: Object,
  source: "auto" | "user",
  confidence: Number | null,
  confirmed: Boolean
}
```

No auto-detected rule may become authoritative merely because its color resembles water, wall, or elevation. Low-confidence and rules-changing guesses must be surfaced for confirmation.

---

## 8. Validation requirements

Before a generated or imported map can become a fight snapshot, validate:

- map dimensions and array lengths;
- walkable-region connectivity for ordinary creatures;
- connector endpoint validity and vertical continuity;
- no bridge without reachable endpoints and a defined walk plane;
- no door/fence/wall edge with contradictory passability;
- PC and foe spawn capacity and separation;
- objective access;
- melee access or an intentional encounter exception;
- ranged sightline distribution;
- cover distribution and culprit categories;
- elevation advantage without unavoidable domination;
- chokepoint count and width;
- hazards do not accidentally consume all viable routes;
- rules props have matching visible mass;
- visual-only props do not enter geometry;
- snapshot fingerprint includes every rules-relevant field.

Validation failures should identify the region, edge, connector, prop, or stage responsible. Repair locally when safe; otherwise retry only the failed deterministic stage.

---

## 9. Debug overlays

Phase 2 overlays should expose the contract rather than merely decorate the renderer:

- graph nodes/edges;
- critical path;
- semantic regions;
- floor heights in feet;
- edge blockers with height labels;
- connector paths and endpoint elevations;
- walkability and movement components;
- cover footprints and occluder tops;
- sampled sightlines and cover distribution;
- spawn influence/fairness;
- import confidence and unconfirmed annotations.

Overlays are staff/authoring tools and do not alter authority.

---

## 10. Migration order

1. Freeze this contract and truthful tactical scale.
2. Add versioned archetype parameter records.
3. Make stage seeds own their stages.
4. Generate bounded elevations.
5. Introduce first-class connectors.
6. Introduce edge blockers, beginning with low walls/rails and doors.
7. Place semantic spawns/objectives.
8. Add validation/local repair and contract overlays.
9. Expand authored tactical-prop footprints and rotations.
10. Build the top-down image-import MVP against the same records.
11. Add assisted orthographic/isometric import after the top-down workflow is reliable.

---

## 11. Acceptance criteria for the foundation

The foundation is ready for the importer when all of the following are true:

- a 5-ft cell can carry a 2.5-ft edge wall without becoming a 2.5-ft movement grid;
- the renderer and geometry show the same wall/eye relationship at tactical scale;
- stairs, ramps, bridges, doors, tunnels, ledges, and fords are data rather than inferred decoration;
- a generated map and a hand-annotated image map serialize to the same authoritative snapshot shape;
- validation can explain inaccessible regions, connector failures, unfair spawns, and cover/sightline extremes;
- a saved snapshot reloads identically on every client without recipe regeneration or artwork-based inference.
