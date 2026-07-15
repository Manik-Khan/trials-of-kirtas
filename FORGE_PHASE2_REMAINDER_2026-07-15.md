# Forge Phase 2 remainder · 2026-07-15

This is the active roadmap after the July 15 field handoff. It separates current foundations, immediate correctness work, active Phase 2 work, planned product features, and later polish.

## Shipped foundations

### Snapshot and generation authority

- exact map snapshots;
- fingerprints;
- legacy fallback;
- versioned parameter records;
- archetype intent;
- independent deterministic stage streams.

### Vertical geometry

- truthful feet-to-world scale;
- bounded elevations;
- stairs;
- ramps;
- ledges;
- multi-cell structural bridges;
- bridge paths, rails, deck thickness, clearance, snapshot preservation, and geometry authority.

### Combat foundation

- shared sessions and replay;
- action/bonus economy;
- movement undo and staff rewind;
- cover geometry and Cover Contest;
- flanking modes;
- Prone;
- Sanctuary effect ledger;
- party-shared discovery;
- canonical component damage evidence.

## Current correctness wave

These must reach “trustworthy” before another large capability slice:

1. raw advantage/disadvantage d20 evidence;
2. Ki/Focus spending and replay;
3. Dash capacity and movement reconciliation;
4. movement-highlight lifecycle;
5. selected-destination pulse;
6. unexplored-map fog presentation;
7. Sanctuary hostile-target field verification;
8. clean two-device join/refresh/replay round.

## Active Phase 2 — vertical structures and connectors

Structural bridges remain active work, not Planned.

### Bridge completion

- visible generation controls and counts;
- deterministic bridge candidate selection;
- saved/restored path identity;
- rail cover;
- bridge movement;
- open/closed/broken state;
- state changes as replayable facts;
- bridge-specific validation;
- clear staff overlay.

### Next connectors

1. doors;
2. tunnels;
3. fords;
4. hazardous crossings;
5. ladders/jump/climb points where the existing connector record supports them.

## Active Phase 2 — semantics and validation

- semantic room/region roles;
- PC spawns;
- foe spawns;
- objectives;
- normal-creature connectivity;
- objective access;
- melee access;
- spawn fairness;
- cover density;
- sightline distribution;
- elevation advantage;
- chokepoint detection;
- local repair or failed-stage retry;
- debug overlays.

## Forge promotion / cleanup milestone

Perform after the correctness wave and a clean multiplayer round, without waiting for all of Phase 2.

### Product identity

- canonical `/forge`;
- visible name **The Forge**;
- Workshop mode before a session;
- Table mode after authoritative session creation;
- `Roll Initiative` creates the shared encounter;
- `Enter the Table/Fight` joins an existing encounter;
- local sandbox relabeled as a single-device test;
- old mock URL redirects and preserves session parameters.

### Active panel

Keep:

- biome/archetype/encounter generation;
- current foe setup;
- camera controls;
- grid opacity;
- active height/connector overlays;
- cover audit;
- currently supported diagnostics.

### Planned tab

Cards only; no disabled fake controls:

- Asset Library;
- Image-to-Dungeon Import;
- Terrain Annotation;
- Auto-Dress;
- Advanced Visual Profiles;
- full Authoring Inspection tools.

### Retire or hide

- greyed-out legacy water-fill controls;
- old standalone heightmap upload;
- dead detail/height-level controls superseded by the map contract;
- asset selector shell before the library exists;
- subtle shader toggles without an authored supported profile;
- tactical vertical-inspection control when it is permanently locked.

## Later Phase 2 / importer foundation

- authored tactical props;
- edge blockers;
- rotations and movement effects;
- image importer semantic output;
- top-down calibration;
- paint/lasso/fill annotations;
- height-region correction;
- wall/low-wall edges;
- bridge/stair/ramp annotations;
- validation and repair;
- art/asset reconstruction after tactical authority is correct.

## Scope thermometer

- **Proof:** works in isolation.
- **Integrated:** connected to the real system.
- **Trustworthy:** correct, persistent, replayable, and non-misleading.
- **Usable:** ordinary users understand and operate it.
- **Polished:** refined presentation and edge cases.

Most feature slices stop at Trustworthy. Product milestones raise core flows to Usable. Polish is selective.

## Rule

> Adjacent bug: fix it.  
> Adjacent idea: record it.

Never beautify a lie.
