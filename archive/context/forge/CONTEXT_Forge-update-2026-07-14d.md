# CONTEXT Forge update · 2026-07-14d

Supersedes the concise Phase 2c handoff for current Forge work. Earlier handoffs
remain authoritative for the systems they shipped.

## Phase 2d — true deterministic stage ownership

The generator foundation is now `2.0.0-stages.1`. Canonical parameter records
advance to version 2 while version 1 remains readable.

### Profiles and migration

- New/unversioned authoring inputs normalize to
  `generatorProfile:"stage-owned-legacy"`.
- Version-1 records normalize into the current data shape but retain
  `generatorProfile:"legacy-dungeon"` by default, preserving snapshot-less old
  recipe regeneration.
- An explicitly stored generator profile is never overwritten.
- Valid `mapSnapshot` data remains authoritative regardless of recipe version.
- Unsupported future parameter versions and unknown profiles fail loudly.

The current record contract is `forge/FORGE_PARAMETER_RECORD_2.md`.

### Owned stages

The active legacy grammar now exposes this deterministic pipeline:

`layout → height → semantics → decor → foes`

- **Layout** calls `forge-dungeon` with the layout attempt seed. It owns
  topology and produces a dense decor candidate pool.
- **Height** owns terrain heights. In this first staged grammar it deterministically
  chooses the legacy entrance-high/boss-high tier orientation without consuming
  semantics randomness.
- **Semantics** owns room roles, critical labels, shrine/elite choices, lake or
  grave labels, and an objective-candidate mark.
- **Decor** filters and varies the dense prop/torch candidates using only the
  decor stream, then adds semantic props.
- **Foes** owns party and foe placement and its local retry stream.

The structural graph facts used between stages are topology-derived and contain
no independent random stream.

Every successful staged map records:

- all five stage seeds;
- per-stage attempt counts;
- independent output fingerprints;
- profile/version data in `map.meta.stageOwnership`.

The isolation and retry contract is `forge/FORGE_STAGE_OWNERSHIP_1.md`.

### Isolation rules

- Height changes do not reroll layout, semantics, decor, or spawn positions.
- Decor changes do not reroll layout, height, semantics, or spawns.
- Foes changes only placement.
- Semantics may change semantic props along with room meaning, but not topology,
  heights, or spawn placement.
- Layout may change downstream products because it is the topology owner.
- Layout retries advance only layout; spawn retries advance only foes.

### Production integration

`topography-test-mock.html` now builds the procedural preview through
`ForgeEngine.generateDetailed()` rather than calling `ForgeDungeon` directly.
The renderer consumes:

- the staged engine height field;
- staged map spawns;
- the decor stage seed for renderer-only scatter;
- graph metadata and the stage-ownership ledger.

New session snapshots retain the ledger in metadata. Runtime cache stamps are
`g2s1` and `fe4`.

The known boot-order guards remain intact: both `DISCOVERY_RENDER` and
`SESSION_ID` initialize before the first `resize(); rebuild();`.

### Archetype honesty

Canyon, Bridge Crossing, Valley, and the other Phase 2c archetypes remain
recorded intent. Stage ownership is active, but all still use the legacy
room-and-corridor layout grammar until archetype terrain is implemented.

### Validation

154 checks green across the five runnable working-set suites:

- snapshot authority 24;
- Map Contract/render truth 23;
- Phase 2b.1 field round 30;
- Phase 2c parameter regression 41;
- Phase 2d stage ownership 36.

Runtime modules and all three executable production inline scripts parse. The
full Phase 1.5h repository suite still needs the complete repo because canonical
`tactics-geometry.js` and `forge-discovery.js` are not included in this reduced
working set.

## Next slice — Phase 2e

Replace the legacy depth-to-tier field with bounded tactical elevations and
begin first-class connector emission. Start with stairs, ramps, and ledges,
validate connectivity and movement transitions, and only then broaden to
bridges, doors, tunnels, and fords.

## Deploy rule

M uploads, commits, and pushes through GitHub. Return repository-structured
files; do not push unless explicitly instructed.
