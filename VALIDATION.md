# Validation record — Phase 1.5c top-down token rig

Completed July 13, 2026.

## Green

- `node --check` on:
  - `forge/forge-unit-art.js`
  - both smoke tests;
  - both Node helper scripts;
  - the browser patcher’s extracted inline JavaScript.
- `forge/tests/smoke-unit-art.js` — **27 checks green**:
  - URL safety;
  - PC portrait fallback;
  - explicit statblock art;
  - generated 5e.tools token paths;
  - initials fallback;
  - per-instance and per-kind keys;
  - precedence;
  - persistence;
  - corrupt-storage recovery.
- `forge/tests/smoke-token-rig-contract.js` — **26 checks green**:
  - one shared unit rig;
  - 3D standee / top-down disc switching;
  - movement and height restaging;
  - discovery seam;
  - death/removal behavior;
  - authoritative metadata seam;
  - URL and local-file customization;
  - correct scope rebuilding;
  - direct near-vertical token picking;
  - God Mode matcher integration;
  - hit-flash integration.
- Guarded patcher fixture passed.
- Browser patch manifest output matched the Node patcher output byte-for-byte on the fixture.
- Every JavaScript block in the patched fixture parsed successfully.
- Known 5e.tools token-path form was checked against live Goblin and Adult Red Dragon token assets.
- `sha256sum -c SHA256SUMS.txt` passes after packaging.

## Not claimed

- The user’s current camera-patched production file was not uploaded with this request, so the patch was not applied to that exact file in this workspace. Both patchers are deliberately anchor-guarded against it.
- The full repository Forge battery was not rerun here because the repository checkout was not mounted in this build workspace.
- WebGL appearance, image CORS behavior for arbitrary custom hosts, touch interaction, and multiplayer browser behavior still need M’s real-browser/table eyeball.
- Local overrides are not synchronized across devices in this bite.
