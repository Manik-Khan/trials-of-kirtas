# Phase 2f.4 — structural bridge completion · 2026-07-16

## Purpose

This slice raises structural bridges from an integrated foundation to a trustworthy connector system before Phase 2 begins doors.

The focus is not new visual dressing. It is one shared identity, movement, cover, rendering, replay, and staff-inspection contract.

## Implemented

### Deterministic identity

Generated bridge IDs now derive from the exact ordered path and elevations. They no longer depend on connector array position.

A path signature is preserved as live-edit proof. If an old replay fact names a bridge ID but its proof disagrees with the current connector path, Forge refuses the edit and restores the snapshot baseline.

### Snapshot and replay authority

- The immutable snapshot preserves the complete bridge record.
- Replay stores both `connectorStates` and `connectorStateProofs`.
- Missing live overrides restore the captured snapshot baseline after rewind or correction.
- Refresh and reconnect reconstruct the same state without mutating the map fingerprint.

### Movement correction

Closed and broken bridges now block only their interior span. Their land endpoints remain ordinary terrain.

This closes an important edge case where making a bridge unavailable could also make the adjacent land bridgehead unusable.

State changes are blocked only when a creature occupies the interior span. Standing at an endpoint no longer falsely prevents a valid bridge edit.

### Rail cover

Bridge rails now participate in canonical cover evidence. A target-side rail that blocks the required body samples grants at least half cover, and the culprit is reported as `bridge-rail`.

Closed and broken states remove deck and rail authority together.

### Staff controls and audit

The active Height / Vertical Geometry panel now exposes:

- stable ID and span length;
- state and occupancy;
- movement and rail-cover status;
- Inspect, Open, Closed, and Broken controls;
- Audit Bridges;
- clear endpoint/path markers for the selected span.

The audit tests identity, continuity, open traversal, unavailable-state refusal, preserved bridgeheads, and both rail footprints against the same geometry consumed by combat.

## Files

Core additions and changes:

- `forge/forge-bridge-authority.js`
- `forge/forge-generator-foundation.js`
- `forge/forge-engine.js`
- `forge/forge-replay.js`
- `forge/tactics-geometry.js`
- `forge/index.html`
- `forge/FORGE_STRUCTURAL_BRIDGES_1.md`
- `forge/tests/smoke-phase2f4-bridge-completion.js`

## Focused field checklist

1. Generate a bridge and note its staff-card ID.
2. Refresh both clients and confirm the same ID/path.
3. Save/reload the battlefield and confirm identity remains unchanged.
4. Move across an open bridge in both directions.
5. Attack a target behind each rail and confirm at least half cover when the rail blocks the body samples.
6. Close the bridge and confirm the interior span is unavailable.
7. Confirm the adjacent land endpoint is still usable.
8. Break the bridge and repeat the movement check.
9. Place a creature on the interior span and confirm Close/Break is refused.
10. Move that creature to a land endpoint and confirm the state change is allowed.
11. Rewind/correct a state change and confirm the snapshot baseline returns.
12. Run Audit Bridges and confirm all movement, state, identity, and rail indicators pass.

## Automated validation

Focused Phase 2f.4 suite: **33/33**.

Relevant regressions:

- Phase 2f bridges/damage: **40/40**;
- replay: **35/35**;
- tactics geometry: **26/26**;
- wave-three multiplayer/reaction/bridge contract: **31/31**;
- Phase 2d stage ownership: **36/36**;
- generator foundation: **38/38**;
- promotion/visibility: **17/17**;
- initiative authority cleanup: **14/14**.

The long-standing flat-mode engine calibration test remains inherited and outside this slice.

## Next active Phase 2 work

After the focused two-browser bridge pass, begin **doors**. Doors must use the same connector principles established here: stable identity, snapshot baseline, replayable state, truthful movement and sight authority, staff inspection, and refresh-safe reconstruction.
