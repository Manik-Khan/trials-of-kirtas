# CONTEXT_Forge update · 2026-07-13b

Supersedes `CONTEXT_Forge-update-2026-07-13a.md` as the current staged handoff. The 13a and 12g records remain authoritative for the visual-direction and ledge/character/ranged fixes they document.

## Phase 1.5 production camera — staged, not yet browser-field-tested

The approved flat camera/discovery mock was treated as a **behavior contract**, not a renderer template. Inspection of the current topography surface confirmed the production camera is `THREE.PerspectiveCamera`, so the implementation keeps that camera and adds two local presets over one state machine:

- **3D** — the existing battlefield presentation and default.
- **Top-down** — a near-vertical tactical view (`phi=0.055`) on the same camera.

Shared across both views:

- `cam.tgt`, yaw, range, raycasting, sprite/DOM projection, targeting, badges, sight lines, and future world-space fog;
- follow active unit;
- focus selected unit;
- frame attacker + target, hold, then return to actor;
- free camera, recenter, bounded pan/zoom, and overseer-only Overview.

Input contract:

- drag = orbit;
- Shift-drag or middle-drag = camera-relative pan;
- wheel = zoom;
- touch: one-finger orbit, two-finger pan/pinch;
- right-click remains reserved for combat targeting.

Manual pan breaks follow. Orbit preserves the current focus. Every new turn re-engages active-unit follow. Top-down hides the painted horizon/parallax/landmark cards but retains the sky behind the tactical board.

The view choice is local and remembered in `localStorage`; it is not a protocol fact and cannot affect replay or multiplayer authority.

## Foundation.2 carried forward

- `clonePlain` ancestry-stack cycle handling;
- shared-reference survival without aliases;
- array-position JSON semantics;
- `mapSnapshot` stripping scoped to `meta`;
- guarded `generatorMeta` bridge;
- `generatorVersion: 2.0.0-foundation.2`;
- exact snapshots, graph metadata, fingerprints, archetypes, and independent stage seeds;
- foundation include cache stamp corrected to `?v=g2f2`.

Validation in the staged bundle: foundation **38/38**, camera contract **15/15**, guarded patch fixture green, browser patcher syntax green.

## Next order

1. M browser-eyeballs the production 3D ↔ top-down transition and camera controls.
2. Build party-shared three-state fog in map/world space; camera remains presentation only.
3. Make saved-session boot snapshot-first with legacy recipe fallback.
4. Activate archetype constraints, elevations, connectors, semantic spawns/objectives, validation/repair, and debug overlays.

## Deploy rule

M uploads, commits, and pushes through GitHub web. The bundle and patchers perform no repository action.
