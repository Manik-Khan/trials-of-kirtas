# CONTEXT Forge update · 2026-07-14c

Supersedes the concise Phase 2b.1 handoff for current work. Earlier documents remain authoritative for the systems they shipped.

## Phase 2c — archetype selector and versioned parameter records

Phase 2c freezes the generator-input save language before stage ownership changes terrain.

### Canonical record

`forge-generator-foundation.js` now exports:

- `PARAMETER_SCHEMA = "forge-map-parameters"`
- `PARAMETER_VERSION = 1`
- `PARAMETER_DEFAULTS`
- `ARCHETYPE_DEFINITIONS`
- `parameterRecord()`
- `slidersFromRecord()`

Generator version is `2.0.0-params.1`.

A record separates requested `archetype` from actual `generatorProfile`. In this slice every map still uses `generatorProfile:"legacy-dungeon"`. Future archetypes are valid recorded intent but make no hidden geometry changes.

The full contract is `forge/FORGE_PARAMETER_RECORD_1.md`.

### Compatibility and authority

New encounter envelopes contain:

- canonical `parameters`;
- `parameterSchema` and `parameterVersion`;
- existing top-level `seed`, `theme`, `sliders`, `archetype`, and `stageSeeds`;
- authoritative `mapSnapshot` and fingerprint.

When the parameter record is present, it owns recipe reads. Old envelopes without one normalize into version 1 in memory. Unsupported versions and unknown archetypes fail loudly. No database migration is required.

Saved `mapSnapshot` remains authoritative. Parameters never cause a present snapshot to regenerate.

### Forge UI

The DUNGEON panel has an Archetype selector populated from the canonical definitions.

- Legacy dungeon: `active`.
- Valley, Canyon, Central hill, Ring, Split plateau, Bridge crossing, Island chain, Courtyard, Cavern chambers, Temple terraces, Ridge, Basin: `recorded`.

Selecting a recorded archetype does not rebuild. The note states that the preview remains on the legacy grammar until stage ownership lands.

Shared sessions display the saved archetype, lock it, and hide it from non-overseer map controls. Staged-fight summaries include the archetype label.

### Engine

`ForgeEngine.generate()` accepts legacy parameters, an encounter carrying `parameters`, or a direct version-1 parameter record. Output metadata records:

- requested archetype;
- actual generator profile;
- parameter schema/version;
- deterministic stage seeds;
- graph metadata.

### Validation

118 checks green across the four runnable suites in the supplied working set:

- snapshot authority 24;
- Map Contract/render truth 23;
- Phase 2b.1 field round 30;
- Phase 2c archetype/parameters 41.

Runtime modules and all three executable production inline scripts parse.

The Phase 1.5h contract suite was not runnable from this reduced bundle because canonical `tactics-geometry.js` and `forge-discovery.js` were not supplied. Run the full repository battery after integration.

## Next slice — Phase 2d

Make the five deterministic streams actually own their stages:

1. layout seed owns dungeon topology and room graph;
2. height seed owns elevation assignment only;
3. semantics seed owns room roles/objective intent only;
4. decor seed owns non-structural dressing and rules-relevant prop selection without perturbing layout;
5. foes seed owns encounter/spawn selection only.

Freeze cross-stage isolation: changing one stage seed may change that stage and downstream validated products, but must not silently reroll unrelated upstream stages. Add per-stage retry/repair seams before implementing constrained elevation and connectors.

## Deploy rule

M uploads, commits, and pushes through GitHub. Return repository-structured files; do not push unless explicitly instructed.
