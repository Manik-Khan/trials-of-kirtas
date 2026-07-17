# Forge Phase 2 remainder · 2026-07-16

This roadmap supersedes `FORGE_PHASE2_REMAINDER_2026-07-15.md`.

## Shipped foundations

### Map and generation authority

- exact `mapSnapshot` authority with legacy fallback;
- map fingerprints;
- versioned archetype and parameter records;
- independent deterministic layout, height, semantics, decor, and foe streams;
- truthful tactical feet-to-world scale;
- bounded elevation;
- stairs, ramps, ledges, and structural bridge records.

### Combat and multiplayer trust

- persistent shared encounters;
- replay, refresh, reconnect, correction, and staff rewind;
- canonical component damage;
- raw advantage/disadvantage evidence;
- action, bonus-action, reaction, spell-slot, Pact-slot, Ki, and movement authority;
- Bless, Sanctuary, Shield, Silvery Barbs, flanking, Prone, and opportunity-attack foundations;
- initiative component evidence and manual ordering;
- hostile AC redaction in Player View;
- downed-creature presentation;
- personal current sight plus party-shared explored memory.

### Product promotion

- canonical `/forge/`;
- canonical `forge/index.html`;
- visible name **The Forge**;
- Workshop and Table modes;
- `Roll Initiative`;
- query-preserving old-route redirect;
- 50% local grid default;
- Active and Planned separation;
- retirement of obsolete prototype residue.

## Current active slice — Phase 2f.4 bridge field verification

Structural bridges remain Active Phase 2 work.

Implemented:

- path-derived stable identity;
- path-signature proof;
- snapshot and replay authority;
- Open, Closed, and Broken states;
- occupancy-safe state changes;
- interior-span blocking with usable land endpoints;
- bridge-rail cover;
- staff inspection and state controls;
- bridge audit.

Required before doors:

- clean two-browser identity pass;
- save/reload and refresh/reconnect consistency;
- open traversal;
- rail-cover confirmation;
- Closed/Broken movement refusal;
- occupancy refusal and endpoint allowance;
- rewind/correction restoration;
- clean **Audit Bridges** result.

## Next connector — doors

Doors must extend the connector contract rather than becoming ad hoc map props.

Minimum authority:

- deterministic identity tied to the exact threshold/edge and connected regions;
- immutable snapshot baseline;
- replayable state changes;
- open state permits movement and sight through the aperture;
- closed state blocks movement and sight truthfully;
- rendering, discovery, pathfinding, targeting, and interaction consume the same state;
- no closing through an occupied threshold;
- refresh, reconnect, rewind, and correction reconstruct the same state;
- staff inspection identifies the door, connected spaces, state, occupancy, and rule verdicts;
- a focused door audit verifies identity, movement, sight, state persistence, and rendering truth.

Settle the first supported state model explicitly before implementation. Do not silently imply lock, key, break, secret-door, or trap mechanics unless they are actually authoritative and tested.

## Connector order after doors

1. tunnels;
2. fords;
3. hazardous crossings;
4. ladders;
5. jump points;
6. climb points.

Every connector type should reuse stable identity, snapshot baseline, replay state, truthful geometry, inspection, and audit wherever applicable.

## Semantics and validation

After the connector foundation:

- semantic room and region roles;
- PC spawns;
- foe spawns;
- objectives;
- normal-creature connectivity;
- objective access;
- melee access;
- spawn fairness;
- cover density and distribution;
- sightline distribution;
- elevation advantage;
- chokepoints;
- local repair or failed-stage retry;
- graph, critical-path, semantics, height, connector, cover, and spawn-influence overlays.

## Later Phase 2 and importer foundation

- authored tactical props;
- edge blockers;
- rotations and movement effects;
- top-down image importer;
- scale calibration;
- paint, lasso, and fill annotation;
- height-region correction;
- wall and low-wall edges;
- bridge, stair, ramp, and connector annotations;
- validation and repair;
- art reconstruction after tactical authority is correct.

## Planned tab

Keep these as clear future-work cards, not disabled active controls:

- Asset Library;
- Image-to-Dungeon Import;
- Terrain Annotation;
- Auto-Dress;
- Advanced Visual Profiles;
- full Authoring Inspection.

## Deferred presentation systems

The current vision contract is usable, but a complete authored lighting simulation remains later work:

- bright, dim, and dark illumination;
- authored light sources;
- darkness and magical darkness;
- full darkvision color/detail behavior;
- additional atmosphere and distant-recognition tuning.

Do not let that later presentation work interrupt connector authority unless a new visual contradiction blocks ordinary play.

## Stop conditions

Stop forward work for:

- renderer boot failure;
- failed join or character claim;
- divergent state after refresh or reconnect;
- incorrect resource, movement, attack, initiative, or reaction reconstruction;
- exact hostile AC exposed to a player;
- unexplored topology revealed;
- a connector whose rendering disagrees with movement or sight;
- connector identity changing across save/load or clients;
- a bridge/door state applied to the wrong connector;
- rewind failing to restore the snapshot baseline.

## Scope rule

> Adjacent bug: fix it.  
> Adjacent idea: record it.  
> Never beautify a lie.
