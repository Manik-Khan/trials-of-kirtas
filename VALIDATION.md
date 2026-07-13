# Validation record — Phase 1.5 production camera + foundation.2

Completed July 13, 2026.

## Green

- `forge/tests/smoke-generator-foundation.js` — **38/38**.
- `forge/tests/smoke-camera-contract.js` — **15/15** on the patched fixture.
- Guarded Node patcher fixture — green from a pristine-current shape.
- Node syntax checks — foundation module, both smoke tests, Node patcher, and patcher fixture.
- Browser patcher inline script extracted and passed `node --check`.
- Browser and Node patchers are generated from the same transformation block.
- Patcher accepts either:
  - current live files with no foundation applied, or
  - the immediately previous foundation.2 output.
- Foundation include stamp corrected to `?v=g2f2`.
- `SHA256SUMS.txt` excludes itself and verifies cleanly.

## Camera contract frozen by smoke

- The existing `THREE.PerspectiveCamera` remains the only renderer camera.
- 3D and near-vertical top-down presets share target, yaw, range, raycasts, projections, and overlays.
- Top-down avoids an exact vertical singularity.
- Panning is camera-relative after rotation.
- Shift-drag and middle-drag pan without taking right-click from combat targeting.
- Two-finger pan/pinch is wired for touch.
- A turn start re-engages active-unit follow.
- Follow tracks tweened movement.
- Token selection focuses the selected unit.
- Target selection frames attacker + target, then returns to the actor.
- Overview is overseer-only and explains why it is disabled for players.
- The painted horizon and scenery cards hide in top-down; the sky card remains behind the tactical board.

## Verified against current source shape

The production anchors were checked against the newest July 13 File Library copy and the current GitHub `main` file page. The live surface is a 7,174-line perspective-camera mock; the patch does not replace that architecture.

## Not claimed

- No automated Chromium/WebGL rendering was available, so the transition, horizon behavior, and touch feel still need M's real-browser eyeball.
- The complete repository smoke battery was not available in the local artifact runtime.
- Supabase was not exercised.
- Party-shared world-space fog is not included in this bite.
- Archetype-specific terrain generation is not included; foundation.2 remains data/versioning only.
- No commit or push was performed.
