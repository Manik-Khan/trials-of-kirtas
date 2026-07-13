# Battle Forge — Phase 1.5 production camera + Phase 2 foundation.2

This bundle supersedes the earlier Phase 1.5/foundation bundle. It accepts either the current live files or files already processed by the foundation.2 patcher.

## What lands

### Production camera

- Keeps the existing `THREE.PerspectiveCamera`; no second renderer or rules path.
- Adds local **3D** and **Top-down** view presets.
- Smoothly preserves the current target, yaw, zoom, selection, combat overlays, and raycasts while switching.
- Follow active, focus selected, attacker/target pair framing, free camera, recenter, and overseer-only Overview.
- Manual pan breaks follow; ordinary orbit preserves the focus target.
- Camera-relative pan after any yaw.
- Desktop: drag orbits; **Shift-drag / middle-drag pans**; wheel zooms. Right-click remains combat targeting.
- Touch: one finger orbits; two fingers pan and pinch-zoom.
- Top-down remains near-vertical (`phi=0.055`) rather than exactly vertical, avoiding the camera-up singularity.
- View choice is local and remembered in `localStorage`; it is not a multiplayer fact.

### Phase 1.5 cleanup and Phase 2 foundation

- Storybook sky + painted horizon default; broken parallax/landmarks opt-in only.
- Foundation include cache stamp is `?v=g2f2`.
- Exact map snapshot, graph metadata, version, stage seeds, and theme guard from foundation.2.
- `clonePlain` ancestry-stack fixes and the 38-check foundation smoke are preserved unchanged.

## Browser application

1. Open `tools/forge-phase15-camera-phase2-browser-patcher.html` locally.
2. Choose current `forge/topography-test-mock.html` and `forge/forge-engine.js`.
3. Download the two replacements.
4. Upload those replacements plus the new files in `UPLOAD_MANIFEST.md`.
5. Open the Forge and test 3D ↔ Top-down, follow, token focus, target framing, Shift/middle pan, wheel/pinch, recenter, and the Overview gate.

## Checkout application

```bash
node tools/apply-forge-phase15-camera-phase2-foundation.js .
node forge/tests/smoke-generator-foundation.js
node forge/tests/smoke-camera-contract.js
```

The patcher does not commit or push.

## Scope boundary

This completes the production camera portion of Phase 1.5. Party-shared world-space fog remains the next bite; no camera view is allowed to become discovery authority.
