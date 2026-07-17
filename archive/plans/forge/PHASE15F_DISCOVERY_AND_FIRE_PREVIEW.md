# Battle Forge Phase 1.5f — discovery and direct-fire guidance

Version: `forge-discovery.js 1.0.0`

## Authority boundary

The camera never decides what a player knows. Discovery is keyed to map cells and canonical line-of-sight geometry, so rotating or switching between 3D and top-down does not reveal additional information.

The pure module `forge/forge-discovery.js` owns only data questions:

1. visibility from one source;
2. union of living-PC sight sources;
3. visible/explored/unexplored composition;
4. historical PC cells derived from the event log;
5. direct-fire origin classification.

It has no DOM, three.js, Supabase or protocol dependency.

## Visibility model

For each living PC:

1. determine sight radius (`sightFt`, `visionFt`, darkvision fields, then 60-ft fallback);
2. bound the candidate cell search by that radius;
3. use canonical 3D range;
4. ask `TacticsGeo.losVerdict(map, origin, cell).canTarget`;
5. union all PC masks into `visibleNow`.

Historical PC positions are replayed through the same visibility calculation and unioned into `explored`. Final state per cell is:

```text
visibleNow       -> VISIBLE
not visible,
but explored     -> EXPLORED
otherwise        -> UNEXPLORED
```

Rewind does not erase explored memory. That is a table-memory ruling, not a replay-state mistake.

## Renderer

The first production renderer builds at most two `THREE.InstancedMesh` objects:

- opaque, depth-writing unexplored columns;
- translucent explored-memory columns.

The columns are staged against terrain and occluder heights and are rebuilt only when the map, discovery masks, viewer presentation or height scale changes.

Staff View clears the fog meshes. Player View applies them.

## Disclosure seam

`foeVisible(unit)` now answers from the unit's world/map cell in Player View. All player-facing systems consume that one seam:

- dual visual rig;
- initiative strip;
- target pools;
- token and fallback picking;
- glow, badges and effects;
- sight lines;
- camera follow/focus/pair framing.

A hidden foe's result is sanitized only for presentation before `ForgeTableCorrectness.pushEvent()`; the authoritative row and replay are untouched.

## Direct-fire classifier

The preview begins only when:

- the action kind is `attack`;
- range is greater than melee reach;
- a living hostile target is selected;
- a PC target is visible when the viewer is a player.

Origins are the active unit's current square plus `CB.seen`, preserving movement cost. In Player View, unexplored origins are removed before evaluation.

For every origin, a ghost position is passed through the live `reachOK()` gate with `{silent:true}`. The output is normalized to:

```text
clear             green   0x2da84f
half cover        yellow  0xe0bf44
three-quarters    orange  0xd67a2f
blocked/no shot   dark    0x252a27
```

The preview deliberately does not expose enemy AC or calculate hit probability. It answers only whether the direct attack can be made and what cover/range state applies.

## Protocol and persistence

No new protocol kind, schema migration or Supabase column is introduced.

- `visibleNow` is derived from current replayed unit positions.
- `explored` is derived from the existing append-only event history.
- viewer presentation remains browser-local.
- firing preview is ephemeral UI state.

## Future upgrades

After field approval:

- per-instance visibility for terrain caps, cliffs and props;
- hidden-contact movement adjudication;
- sight-radius/light/darkness refinement;
- click-to-queue move plus attack;
- separate AoE/cone/line templates;
- AI use of the same firing-origin classifier;
- Phase 2 generator overlays reusing the same cell-classification renderer.
