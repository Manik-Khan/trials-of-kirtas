# Temple Terraces and Intentional Deployment Design

**Date:** 2026-07-17
**Status:** Approved for implementation
**First archetype:** `temple-terraces`

## Objective

Make generated Forge scenes feel inhabited and purposeful. The archetype must decide why terrain, routes, and connectors exist; the biome must decide how they look; the DM must decide where every encounter group begins.

Temple Terraces is the first complete proof of that model. It creates deliberate multi-tier architecture with useful stair routes, then gives the DM explicit deployment flags for any number of Party, Ally/NPC, and Enemy groups.

## Current problem

The existing connector system is mechanically trustworthy but semantically unopinionated:

- bridge candidates are straight `land -> POOL cells -> land` spans selected by a deterministic hash;
- candidate selection does not consider destinations, critical routes, objectives, chokepoints, or whether the crossing materially changes play;
- the height stage samples some ordinary 5-ft elevation transitions as stairs or ramps even though normal movement already crosses them;
- the bridge audit proves identity, movement, unavailable states, bridgehead safety, and rail cover, but not whether a bridge has an in-world purpose;
- stair and bridge meshes use hard-coded colors instead of a saved biome-appropriate construction style;
- local and shared combat start currently choose party and foe anchors automatically, including highest/lowest-tier and visibility-band heuristics.

The July 17 field recipe demonstrates the distinction. Its bridge was a valid 10-ft span with a four-step walk-around route, and its lone staircase marked an already-walkable 5-ft edge. Both records passed their implemented rules while still reading as arbitrary structures.

## Governing principles

1. **Intent precedes geometry.** A connector exists because a named route needs it, not because a post-pass found an eligible edge.
2. **The scene and encounter have separate authors.** The archetype authors the place; the DM authors deployment.
3. **Natural and constructed terrain use different language.** Hills use slopes, switchbacks, ridges, and climbs. Temples, forts, settlements, mines, and ruins may use stairs, ramps, ladders, and bridges.
4. **Not every elevation boundary needs a connector.** Intentional cliffs and blocked edges create tactics. Required destinations still need a legal route for the creatures expected to reach them.
5. **Biome changes construction, not purpose.** Material and condition may vary without moving the route or changing its rules authority.
6. **Failures narrate.** The Forge never silently adds a structure, relocates a deployment group, stacks units, or drops a combatant.
7. **Saved authority remains exact.** Snapshots and live sessions reproduce authored routes, styles, groups, flags, and final positions without regeneration.

## Scope

This design includes:

- the first active `temple-terraces` archetype;
- intent-owned architectural regions, routes, elevation bands, stairs, and landings;
- deterministic Temple variants;
- purpose validation and local repair;
- biome-aware Temple construction profiles;
- DM-authored deployment groups and flags;
- deterministic local formation around each flag;
- exact save, reload, reconnect, and combat-start behavior;
- compatibility rules for legacy maps and saved encounters;
- staff-facing purpose diagnostics.

This design does not include:

- the future `bridge-crossing` archetype;
- freehand terrain painting or connector drawing;
- neutral/civilian allegiance or mid-fight allegiance changes;
- reinforcement timing and off-map reserves;
- destructible stairs or bridges;
- moving platforms, elevators, or animated drawbridges;
- a second creature layer beneath a bridge;
- generalized building interiors or multiple stacked floors at one grid coordinate.

## Implementation boundaries

This is one product contract with two cooperating authorities, implemented through separate review checkpoints:

1. **Intentional scene generation:** Temple regions, routes, stairs, construction profiles, purpose validation, and local repair.
2. **DM deployment authoring:** group records, flags, deterministic local formations, manual positions, and placement validation.
3. **Encounter integration:** saved draft authority, exact session positions, reconnect/replay reconstruction, and the Roll Initiative gate.

The scene-generation checkpoint must be testable without inventing final combatant locations. The deployment checkpoint consumes an accepted map without changing its terrain. Encounter integration must not fall back to automatic high/low or visibility-band anchors for a newly authored encounter.

## Intent-first scene pipeline

Temple Terraces uses this generation order:

1. **Archetype intent** defines the architectural regions, required destinations, route roles, and construction vocabulary.
2. **Layout** realizes broad contiguous terraces and usable landings.
3. **Height** assigns deliberate elevation bands to those regions.
4. **Routes** connect the approach, terraces, side positions, and summit.
5. **Connectors** realize only the route segments that cross constructed elevation boundaries.
6. **Semantics** label the sanctuary, optional objectives, defensive positions, and suggested deployment regions.
7. **Decor** dresses the scene without obstructing routes, landings, or deployment capacity.
8. **Validation and local repair** prove that the authored place still works.
9. **DM deployment** creates encounter groups and positions after the scene is accepted.

Generic connector sampling does not run after the Temple connector stage. A random eligible edge cannot acquire a staircase or bridge merely to exhibit a connector record.

## Temple intent record

The generated map carries this versioned, immutable, snapshot-safe intent record. Any necessary schema revision must update this specification before implementation rather than silently changing its authority:

```js
{
  version: 1,
  archetype: "temple-terraces",
  variant: "axial" | "switchback" | "ring",
  regions: [
    {
      id: "approach" | "lower-court" | "mid-terrace" |
          "side-terrace" | "summit-sanctuary" | String,
      role: String,
      elevationFt: Number,
      cells: MapPoint[]
    }
  ],
  routes: [
    {
      id: String,
      role: "primary-ascent" | "secondary-route" | "summit-access" | String,
      required: Boolean,
      regionIds: String[],
      path: MapPoint[],
      connectorIds: String[]
    }
  ],
  connectorPurposes: {
    [connectorId]: {
      routeId: String,
      role: String,
      fromRegionId: String,
      toRegionId: String
    }
  },
  suggestedDeploymentRegions: [
    { regionId: String, reason: String }
  ],
  constructionProfile:
    "temple-masonry" |
    "druidic-overgrown-stone" |
    "tundra-frost-stone" |
    "volcanic-basalt" |
    "cavern-carved-rock" |
    "grassland-weathered-ruin" |
    "swamp-sunken-stone"
}
```

Suggested deployment regions are descriptive guidance only. They are not spawn records and never choose a side's actual location.

## Temple structure

### Regions and tiers

The archetype creates three or four broad architectural tiers on the existing 5-ft tactical grid. Normal generated elevations remain within the established 0/5/10/15-ft bands unless a later map-contract revision explicitly raises the bound.

A valid Temple includes:

- an exterior or threshold **approach**;
- a **lower court** large enough to stage movement rather than a one-cell corridor;
- one or more **intermediate terraces**;
- a **summit sanctuary** or equivalent meaningful destination;
- optionally, a **side terrace**, overlook, ritual station, or protected position.

Elevation belongs to regions. The archetype must not create a checkerboard of individually raised squares.

### Variants

The archetype deterministically chooses one of three structural variants:

- **Axial:** a strong central ascent with a secondary side approach where space permits.
- **Switchback:** alternating stair runs and landings that traverse the face or interior court of the Temple.
- **Ring:** a route that wraps around a summit mass, exposing different sides and sightlines during ascent.

Ruin, overgrowth, frost, subsidence, and repair are construction conditions layered onto a valid variant. They may close or roughen an optional route, but cannot invalidate the required primary ascent.

### Routes

Every Temple has one required primary route from the approach to the summit. An ordinary creature must be able to traverse it without climb, fly, jump, swim, or special capability requirements.

When the footprint provides enough space, the Temple also creates a secondary tactical route. It may be:

- longer but better protected;
- narrower or more exposed but faster;
- connected to a side objective;
- positioned to enable flanking or high-ground contest;
- partially ruined while remaining traversable by ordinary movement.

The primary route cannot become an unavoidable exposed kill corridor unless the scene intent also provides a viable alternate tactic. A secondary route is not generated when it would be a cosmetic duplicate with no meaningful decision.

## Stair and landing contract

Temple stairs are first-class connector records owned by named routes.

- A staircase may be a straight run, switchback segment, or part of a wrapping ascent.
- Multi-square stair paths are supported; an entire architectural run must not collapse into one isolated tread marker.
- Each staircase connects two distinct named regions or two deliberate landings within a named route.
- Connector endpoints agree with the authoritative terrain elevations.
- Both ends provide usable landing space.
- Required landings remain free of blocking props, deployment flags, and initial token positions.
- A 5-ft edge may receive stairs when it is an intentional constructed route transition, but never through generic sampling.
- A 10-ft transition requires an explicit connector or a local height repair that divides it into legal constructed segments.
- Remaining unconnected ledges are intentional boundaries, not omissions produced by a random connector cap.

Natural ramps or eroded approaches may appear only when the Temple variant and construction condition explain them. A generic outdoor hillside must not receive masonry stairs merely because its cells have different heights.

## Purpose and scene validation

Temple validation extends mechanical connector validation with semantic checks.

### Required checks

- every required region exists and has usable area;
- the primary route begins at the approach and ends at the summit;
- every required route segment is traversable by an ordinary creature;
- every staircase belongs to exactly one declared route purpose;
- stair endpoints and path elevations agree with `h[]`;
- every landing has enough connected, unblocked cells for arrival and departure;
- no staircase ends in a wall, prop, hazard, cliff, isolated tile, or unrelated region;
- no connector exists outside the archetype intent record;
- the summit is not reachable through an unmarked illegal vertical seam;
- suggested tactical positions remain reachable by the creatures expected to use them;
- decoration does not block a required route or consume required landing capacity;
- the map retains useful movement choices rather than a collection of disconnected platforms.

### Local repair

Repair targets only the failed stage or neighborhood:

1. move or widen a landing;
2. realign a staircase within its intended boundary;
3. adjust the affected terrace edge or tier;
4. remove or relocate obstructive decor;
5. retry the Temple layout stage when the intent cannot be realized locally.

Repair may not silently move objectives, change deployment flags, reroll foes, or add a connector with no declared purpose. If bounded retries cannot produce a coherent Temple, generation stops with a narrated error.

## Biome-aware construction

The Temple archetype establishes that the place is constructed. The biome supplies a deterministic, snapshot-safe construction profile:

| Biome | Temple construction language |
|---|---|
| Temple | dressed ceremonial stone, masonry, carved stair edges |
| Druidic | ancient overgrown stone, roots, vines, and credible later repairs |
| Tundra | frost-worn carved stone and ice-weathered surfaces |
| Volcanic | basalt, dark masonry, and metal reinforcement |
| Cavern | excavated or carved native rock |
| Grassland | weathered ruins integrated into open landscape |
| Swamp | mossed stone, sunken foundations, and limited timber repair |

Connector rendering consumes the saved construction profile. It does not infer a new style from the viewer's current biome control and does not use one hard-coded gold or brown material for every map.

The profile changes visual material, trim, wear, and decorative supports. It cannot change connector identity, path, elevation, movement, cover, or route purpose.

Bridges are outside the first Temple Terraces slice. A later explicit Temple variant may author a moat, chasm, or collapsed-nave crossing through the same intent model.

## DM-authored deployment

### Separation of authority

The generator may identify useful regions, but it does not create final Party or Enemy positions for a new authored encounter.

- **Generated scene authority:** regions, routes, connectors, objectives, suggested deployment regions, and decoration.
- **Workshop encounter authority:** deployment groups, group membership, controller policy, DM-placed flags, formation seeds, and manual overrides.
- **Started-session authority:** exact resolved unit positions stored with the roster/session facts and reconstructed through the existing snapshot/replay path.

Automatic highest-tier Party placement, lowest-tier foe placement, and visibility-band enemy anchor selection do not decide a DM-authored encounter.

### Deployment groups

The DM may create any number of named groups. The first version supports these deployment roles:

- **Party**;
- **Ally/NPC**;
- **Enemy**.

Deployment role and control are separate. Party and Ally/NPC groups both resolve to the existing friendly `pc` combat side; Enemy groups resolve to `foe`. This preserves current targeting and ally/enemy rules while allowing friendly NPCs to remain overseer-controlled and independent of player formations.

Control remains authoritative per unit. A group's controller policy supplies the default behavior but never overwrites an existing player seat assignment:

- `unit-owners` preserves each assigned unit controller;
- `overseer` makes otherwise unassigned members overseer-controlled.

Each group records:

```js
{
  id: String,
  label: String,
  role: "party" | "ally" | "enemy",
  controllerPolicy: "unit-owners" | "overseer",
  unitIds: String[],
  anchor: { c: Number, r: Number } | null,
  formationSeed: Number,
  manualPositions: { [unitId]: { c: Number, r: Number } }
}
```

The encounter draft owns this record. The saved battlefield must preserve it alongside the immutable map snapshot, and the resolved positions continue into the session roster.

### Flag placement and formation

The Workshop flow is:

1. create and name a group;
2. choose its deployment role and controller policy;
3. assign combatants;
4. select **Place Flag** and click a legal map cell;
5. preview deterministic placement around the flag;
6. move the flag, reseed only that formation, split the group, or position units manually;
7. repeat for every active group;
8. use **Roll Initiative** only after all active combatants have valid positions.

Formation placement uses the flag as its only regional anchor. The seed controls tie-breaking and local arrangement, not which part of the map the group occupies.

The formation planner may reuse the proven spacing behavior of `clusterAround`, but it must operate as a pure deterministic planner over a bounded local candidate set. Candidate cells must:

- remain within the flag's connected local deployment region;
- be walkable and large enough for the unit;
- avoid walls, hazards, required stair paths, bridge spans, and required landings;
- avoid cells reserved by other groups or manual positions;
- respect requested spacing when possible and narrate any compression;
- never cross a connector or leave the region merely to make a group fit.

If the group does not fit, the preview reports its capacity and asks the DM to move the flag, divide the group, reduce its size, or position units manually. Units are never stacked, silently dropped, or moved to a different region.

### Manual placement and precedence

An explicit manual unit position overrides its group's generated formation position. Moving or reseeding a group must not discard manual overrides without confirmation.

Every active combatant must have one valid resolved position, either through a deployment group or an explicit individual placement. A unit cannot belong to multiple active deployment groups.

### Regeneration and invalidation

- cosmetic and presentation changes preserve groups, flags, and positions;
- decor regeneration preserves them but revalidates obstruction conflicts;
- layout, height, route, or archetype changes mark affected flags and positions unresolved;
- unresolved groups remain visibly attached to their former authored record but cannot start combat until the DM accepts a valid placement;
- the Forge never silently relocates a flag after structural regeneration.

## Workshop interface

The unified Forge panel gains a **Deployment** section after scene-generation controls and before **The Table** actions.

Each group card shows:

- name and deployment role;
- controller policy and unit-control summary;
- assigned combatants;
- flag state;
- available capacity versus assigned unit count;
- formation validity;
- controls for Place/Move Flag, Preview/Reseed Formation, Split Group, and individual placement.

Map flags remain visible in Workshop and use distinct Party, Ally/NPC, and Enemy treatments. Suggested regions may be toggled as a staff overlay, but a suggestion never becomes a flag until the DM places or explicitly accepts it.

**Roll Initiative** narrates every missing or invalid requirement. It does not become an inert disabled button with no explanation.

The Vertical Geometry section continues to show mechanical connector audits and adds route-purpose information such as:

- `primary ascent`;
- `secondary route`;
- `summit access`;
- originating and destination region labels.

## Save, session, and compatibility behavior

- old saved maps and sessions load their exact existing connector and spawn records;
- snapshot load never regenerates Temple intent, stairs, styles, groups, flags, or positions;
- existing live bridge state and replay identity remain unchanged;
- new Temple maps use the new intent and deployment records;
- legacy generated maps retain required steep connectors needed for mechanical reachability, but stop receiving generic decorative 5-ft stair/ramp samples;
- generic production bridges are not forced into legacy maps while `bridge-crossing` is unavailable;
- the bridge rules engine and audit remain available for existing or explicitly authored bridge records;
- compatibility fallback placement may load an old staged encounter that lacks deployment groups, but any newly authored encounter uses DM flags before combat start.

The future `bridge-crossing` archetype will restore purposeful production bridge discovery. **Find Bridge Seed** must ultimately search bridge-capable archetype intent rather than force a bridge into an arbitrary legacy landscape.

## Failure narration

Required messages include:

- why a Temple generation or local repair failed;
- which connector lacks a route purpose;
- which landing or region is unreachable;
- why a flag cell is illegal;
- how many units fit around a flag;
- which group or unit remains unresolved;
- whether spacing was compressed;
- which structural change invalidated a deployment;
- why Roll Initiative cannot proceed.

No failure path may substitute a different region, silently lower the group size, overlap units, or discard a manual position.

## Validation strategy

### Generator known-answer tests

Use real `ForgeEngine` generation and fixed Temple recipes to prove:

- `temple-terraces` is executable rather than record-only;
- identical parameters reproduce identical variant, regions, routes, heights, connectors, and style profile;
- axial, switchback, and ring recipes each produce coherent broad terraces;
- every staircase has a declared connector purpose;
- primary ascent reaches the summit for an ordinary creature;
- no unmarked vertical seam bypasses required stairs;
- required landings are usable and decor-free;
- no generic connector appears outside the intent record;
- changing the biome style cannot change route geometry or stage ownership;
- snapshots preserve the complete intent and construction records.

### Deployment tests

Extract and run the real placement planner against real generated Temple maps:

- multiple groups of every supported deployment role can coexist;
- a group repeats exactly for the same anchor and formation seed;
- changing only a formation seed changes only that group's local arrangement;
- placement remains within the anchor's connected region;
- stair paths, required landings, walls, hazards, and occupied cells are excluded;
- insufficient capacity returns a narrated failure and never stacks or drops units;
- manual positions take precedence and survive unrelated group changes;
- a unit cannot resolve into two groups;
- structural regeneration invalidates affected flags without moving them;
- resolved group data and exact positions survive save, reload, reconnect, and combat start.

### Regression tests

Run the canonical Forge geometry, bridge, snapshot, replay, placement, generation, and session smokes. Any touched JavaScript receives `node --check`. Cache stamps are bumped for every changed runtime module include.

### Browser field pass

1. Generate at least one seed for each Temple variant.
2. Inspect every staircase and confirm its visible route purpose.
3. Confirm architecture and connector materials suit several biomes.
4. Create multiple Party, Ally/NPC, and Enemy groups.
5. Place groups on different terraces and verify capacity previews.
6. Reseed one formation and confirm no other group or map stage changes.
7. Manually position an allied NPC and confirm group reseeding preserves it.
8. Save and reload the battlefield.
9. Reconnect a second browser and confirm identical flags and positions.
10. Start combat and confirm every unit begins at the exact approved location.
11. Regenerate decor and then structure, confirming preservation and invalidation behavior respectively.

## Promotion criteria

Temple Terraces is ready when:

- its architecture reads as a place built for a purpose;
- every visible staircase explains a required or useful route;
- an ordinary creature can use the primary ascent from approach to summit;
- materials match the biome without changing rules geometry;
- the DM, not the seed, chooses every encounter group's region;
- multiple independently controlled friendly and hostile groups are supported;
- no unit is silently placed, moved, stacked, or omitted;
- the exact approved scene and deployment survive save, reload, reconnect, and combat start;
- focused automated checks and the real browser field pass are both green.

## Follow-on work

After Temple Terraces is field-approved, use the same intent, purpose, style, and deployment contracts for `bridge-crossing`:

- author two or more meaningful regions separated by a genuine hazard;
- give each bridge a named route purpose;
- reject trivial or orphan spans;
- select bridge construction from biome and culture;
- preserve the existing structural bridge movement, cover, state, identity, snapshot, and replay authority.
