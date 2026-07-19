# Forge Temple Terraces contract · version 1

Status: **Workshop preview**. The intentional terrain generator is implemented; DM deployment groups and encounter promotion are not part of this slice.

## Identity

- Generator version: `2.1.0-temple.1`
- Parameter schema/version: `forge-map-parameters` / `2`
- Generator profile: `intentional-archetype`
- Archetype key: `temple-terraces`
- Runtime: `forge-temple-terraces.js`
- Canonical surface: `forge/index.html`

Fresh Temple authoring selects the intentional profile. A saved record with an explicit historical `legacy-dungeon` or `stage-owned-legacy` profile retains that profile. Exact saved snapshots remain authoritative.

## Deterministic scene grammar

`ForgeTempleTerraces.generate(options)` consumes the five named stage seeds plus biome, room count, and decor density. It returns:

```js
{
  dungeon,
  h,
  connectors,
  ledges,
  intent,
  constructionProfile
}
```

The layout seed selects one of three canonical variants by `layoutSeed % 3`:

- `axial` — aligned ceremonial ascents;
- `switchback` — alternating side approaches;
- `ring` — ascent sides rotate around the sanctuary.

The map uses the established 5-foot tactical grid and the existing 0/5/10/15-foot platform bands:

1. `approach` — 0 feet;
2. `lower-court` — 5 feet;
3. `upper-court` — 10 feet;
4. `summit-sanctuary` — 15 feet.

Every region is a broad platform, never a single raised decorative cell. Retaining-wall bands separate the tiers. Map size is even and bounded from 40 to 52 cells using the saved room-count input.

## Intent authority

The scene publishes an immutable, snapshot-safe intent record:

```js
{
  version: 1,
  archetype: "temple-terraces",
  variant: "axial" | "switchback" | "ring",
  regions: [{ id, role, elevationFt, cells }],
  routes: [{ id, role, required, regionIds, connectorIds }],
  connectorPurposes: {
    [connectorId]: { routeId, role, fromRegionId, toRegionId }
  },
  suggestedDeploymentRegions: [{ regionId, priority }]
}
```

Exactly one required `primary-ascent` crosses approach → lower court → upper court → summit. Fields at least 44 cells wide also receive a nonduplicate `secondary-route` between the courts and summit. Suggested deployment regions are annotations only; they do not place units.

## Stair contract

Every generated Temple connector:

- has `kind: "stairs"`;
- is declared by a route and carries a matching purpose record;
- has `source: "archetype-intent"`;
- contains a cardinally continuous `path` of at least three points;
- includes a low landing, retaining-band stair cell, and high landing;
- writes each path point's `elevationFt` into the authoritative `h[]` cell;
- cuts only its declared retaining-wall gap;
- remains open, two-way, and usable without climb/jump/swim/fly;
- renders from the same saved path consumed by movement rules.

The renderer iterates every path segment. It does not derive a second visual or rules route from connector endpoints.

## Construction profiles

Biome chooses visual construction without changing identity, path, elevation, movement, or purpose:

| theme | profile |
|---|---|
| temple | `temple-masonry` |
| druidic | `druidic-overgrown-stone` |
| tundra | `tundra-frost-stone` |
| volcanic | `volcanic-basalt` |
| cavern | `cavern-carved-rock` |
| grass | `grassland-weathered-ruin` |
| swamp | `swamp-sunken-stone` |

Structural rendering is deterministic. Saved construction does not call `Math.random()`.

## Stage ownership

- `layout` owns footprint and variant.
- `height` owns stair placement details and the authoritative height/connector fingerprint.
- `semantics` owns route/deployment-region annotations, not geometry.
- `decor` owns props and cannot obstruct a route.
- `foes` is deliberately unresolved and fingerprints the literal `deployment-unresolved`.

Temple scenes always return `spawns: []`. No player, ally, NPC, or enemy position is inferred from height, visibility, or map extrema.

## Validation and repair

Generation refuses a scene unless it has:

- a valid dungeon document and Temple intent;
- unique broad regions;
- exactly one complete required primary ascent;
- matching route, connector, purpose, and region references;
- in-bounds cardinal stair paths and truthful endpoint/path elevations;
- open retaining-wall gaps and clear landings;
- no decor on authored connector cells;
- reachability from approach through every required region;
- no bridge connector.

One bounded local repair may clear obstructing decor and restore declared stair cells. It may not add an undeclared connector, move a region, invent a route, or place a combatant. A scene still invalid after repair stops loudly.

## Preview and promotion boundary

Temple Terraces is visible and inspectable in Workshop, including route-purpose diagnostics. It cannot start local combat, Roll Initiative, or Save for later while `templeDeploymentPending()` is true. Those doors remain visible and narrate that DM deployment flags are required.

This slice does **not** implement deployment flags. Promotion from `preview` to `active` requires the separate deployment-group and encounter-integration plans: any number of Party, Ally/NPC, and Enemy groups, DM-authored flags, deterministic formation around each flag, exact persistence, and reconnect/replay reconstruction.

## Legacy connectors and bridges

Staged legacy generation no longer samples ordinary 5-foot edges as decorative stairs or ramps. It emits a steep stair/ramp only when the connector repairs a movement-blocking rise required for connectivity.

Staged legacy generation does not select structural bridges, and `findBridgeRecipe()` returns `null` rather than hunting for a seed that forces one. Bridge identity, geometry, movement, cover, state, replay, audit, and explicit `selectBridges()` authority remain intact for the future `bridge-crossing` archetype.

## Field checklist

1. Select Temple Terraces and confirm the selector says `preview`.
2. Inspect axial, switchback, and ring variants on multiple seeds.
3. Confirm every region is broad and every stair has usable landings.
4. Match every stair's purpose label to its visible source and destination regions.
5. Compare Temple, Druidic, Tundra, and Volcanic construction.
6. Confirm no bridge appears in Temple or staged legacy generation.
7. Confirm staged legacy maps no longer receive decorative 5-foot connectors.
8. Attempt local combat, Roll Initiative, and Save for later; confirm each narrates the deployment dependency.
9. Save/reload a legacy encounter and confirm historical behavior remains unchanged.

Browser observation is the field gate. Automated checks prove deterministic contracts, not visual usability.
