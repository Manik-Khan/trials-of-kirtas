# CONTEXT Forge update · 2026-07-14e

Supersedes the concise Phase 2d handoff for current Forge work. Earlier handoffs
remain authoritative for the systems they shipped.

## Phase 2e — bounded vertical geometry and first-class connectors

The generator foundation is now `2.0.0-elevations.1`. Parameter record version
remains 2; this slice changes the generated map product, not the authoring
record shape.

### Height-stage authority

The staged pipeline remains:

`layout → height → semantics → decor → foes`

The height stage now owns one complete deterministic vertical product:

- bounded floor elevations `h[]`;
- first-class `connectors[]`;
- explicit `ledges[]`;
- a `meta.vertical` summary;
- one height fingerprint covering all three rules records.

Changing the height seed still cannot alter layout, semantics, decor, or foe
placement.

### Generated elevation bounds

New staged land floors are 5, 10, or 15 ft. Explicit pool/hazard beds may remain
at 0 ft. Adjacent open surfaces are locally bounded to a maximum 10-ft
difference.

Wall cells now inherit the highest adjacent supporting floor before their wall
occluder height is added. Elevated rooms therefore no longer sit beside wall
meshes/rules solids rooted at world zero.

The production preview no longer converts every lowest-tier floor into water.
Only explicit pool terrain is water; elevation alone cannot rewrite terrain
semantics.

### Stairs, ramps, and ledges

Phase 2e implements the first subset of the connector schema in
`forge/FORGE_VERTICAL_GEOMETRY_1.md`:

- generated stairs;
- generated ramps;
- 10-ft ledge records.

Movement authority is shared by the engine validator and canonical
`tactics-geometry.js`:

- 0–5 ft is an ordinary step;
- a 10-ft cardinal edge requires an open connector on that edge;
- climb/fly retain their existing cliff authority;
- closed/broken connectors authorize nothing;
- new generated maps refuse adjacent differences greater than 10 ft.

The height generator unions the ordinary 0/5-ft movement components and selects
deterministic 10-ft connector edges until ordinary-creature connectivity is
restored. Other 10-ft boundaries remain unconnected tactical ledges with
alternate routes. A small sample of 5-ft transitions is also recorded as
stairs/ramps for render/importer truth.

### Rendering and diagnostics

The renderer consumes connector endpoints directly:

- stairs render as stepped treads;
- ramps render as an inclined strip;
- all vertical placement uses the same 5-ft-to-one-world-unit tactical scale.

Staff can toggle **Forge → Height → Show connectors**:

- gold stairs/connected ledges;
- teal ramps;
- red unconnected ledges.

The overlay is unavailable outside staff authority.

### Snapshot and geometry synchronization

`mapSnapshot` now includes `connectors[]` and `ledges[]`; new fingerprints cover
them. Old snapshots remain readable because their old fingerprint is checked
before missing arrays normalize to empty arrays.

Canonical `forge/tactics-geometry.js` and the production inline copy are
byte-identical. `forge/patch-phase2e-geometry-sync.js` must be run after file
replacement to synchronize the reference `battle-tactics-geo-mock.html`. The
patcher accepts only the known previous or already-current geometry hashes and
performs no partial write.

Runtime cache stamps are `g2e1` and `fe5`.

The known boot-order guards remain intact: `DISCOVERY_RENDER` and `SESSION_ID`
are both initialized before the initial `resize(); rebuild();`.

### Compatibility

- Snapshot-backed encounters remain exact and never regenerate.
- Version-1 snapshot-less recipes retain the monolithic legacy profile.
- New version-2 records use the stage-owned profile and Phase 2e vertical
  product.
- Existing old snapshots may contain taller/unconnected legacy elevations; they
  load as saved rather than being silently repaired.
- Canyon, Bridge Crossing, Valley, and the other archetypes remain recorded
  intent on the Legacy dungeon layout grammar.

### Validation

193 checks green across the six runnable working-set suites:

- snapshot authority 24;
- Map Contract/render truth 23;
- Phase 2b.1 field round 30;
- Phase 2c parameter regression 41;
- Phase 2d stage ownership 36;
- Phase 2e vertical geometry 39.

Foundation, engine, canonical geometry, patcher, and all three executable
production inline scripts parse. Geometry byte identity and the guarded
reference-mock patcher pass fixture tests. The full historical repository suite
still requires the complete repo, especially `forge-discovery.js` and the
reference mock itself.

## Next slice — Phase 2f

Broaden connectors in a controlled order. First establish multi-cell connector
paths and structural bridges with endpoints, walk plane, rails, under-clearance,
rendering, movement, snapshot authority, and validation. Doors, tunnels, fords,
ladders, jumps, and climb points follow only after that bridge contract is
stable. Semantic objectives/spawn fairness and full debug overlays remain after
the connector base.

## Deploy rule

M uploads, commits, and pushes through GitHub. Return repository-structured
files; do not push unless explicitly instructed.
