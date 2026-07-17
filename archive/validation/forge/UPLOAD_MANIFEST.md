# Upload manifest — Phase 1.5h

## Runtime replacements

- `forge/topography-test-mock.html`
- `forge/tactics-geometry.js`
- `forge/forge-discovery.js`

## Reference mock replacement produced by guarded patcher

- `battle-tactics-geo-mock.html` **or** `forge/battle-tactics-geo-mock.html`, matching its current repository location

## Test replacements

- `forge/tests/smoke-los-cover.js`
- `forge/tests/smoke-forge-discovery.js`
- `forge/tests/smoke-phase15f-contract.js`

## New tests

- `forge/tests/smoke-cover-calibration.js`
- `forge/tests/smoke-phase15h-contract.js`
- `forge/tests/smoke-geometry-sync.js`

## New subsystem document

- `forge/PHASE15H_GEOMETRY_AND_FOG.md`

## Retained cumulative support files

The ZIP includes unchanged Phase 1.5 modules and tests so the cumulative battery can run from the bundle. Do not replace identical deployed copies merely because they are present.

## Helper files — do not deploy

- `tools/forge-phase15h-sync-battle-mock.html`
- `tools/apply-forge-phase15h-battle-mock.js`
- `tools/test-apply-forge-phase15h-battle-mock.js`
- `README_APPLY.md`
- `VALIDATION.md`
- `UPLOAD_MANIFEST.md`
- `SOURCE_BASELINE.txt`
- `CONTEXT.md`
- `CONTEXT_Forge.md`
- `CONTEXT_Forge-update-2026-07-13h.md`
- `README_NEW_SESSION.md`

M remains the committer and pusher. This bundle performs neither action.
