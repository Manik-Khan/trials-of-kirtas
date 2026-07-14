# CONTEXT Forge update · 2026-07-14a.1

Hotfix to Phase 2a snapshot authority. Phase 1.5h.1 remains the completed combat/render baseline.

## Session renderer boot failure

The first Phase 2a `topography-test-mock.html` added an early `rebuild()` read of `SESSION_ID` through the new session-map-authority clearing rule:

`if (!SESSION_ID) SESSION_MAP_AUTHORITY = null;`

The module still declared `SESSION_ID` much later with `const`, in the multiplayer boot block. The initial `resize(); rebuild();` therefore entered the lexical dead zone and threw before `topo:ready`, `window.CHAR`, and the character-sheet bridge were published.

Visible symptom: party cards reported no combat sheet and the renderer did not load.

This was a Phase 2a source initialization-order defect, not a missing character sheet. It is the same class of failure as the Phase 1.5h discovery-registry boot defect.

## Fix

`SESSION_ID` is initialized before the initial terrain build, next to `SESSION_MAP_AUTHORITY`. The later multiplayer block reuses it instead of declaring a late lexical constant.

`smoke-phase15h-contract.js` now asserts:

- discovery registry before initial rebuild;
- session identity before initial rebuild;
- no late `const SESSION_ID` declaration.

## Files

Replace only:

- `forge/topography-test-mock.html`
- `forge/tests/smoke-phase15h-contract.js`

Snapshot authority logic in `forge-generator-foundation.js` and `forge-engine.js` is unchanged.

## Validation

- All three executable inline scripts parse.
- 24 snapshot-authority checks remain green.
- Direct boot-order checks pass.

Not claimed: full repository battery, automated WebGL screenshots, or live two-device Supabase verification.

## Asset warnings

The reported favicon and portrait 404s are independent, non-fatal asset-path warnings. They do not explain the no-sheet state; the module-stopping `SESSION_ID` exception does.

## Next

After browser confirmation that the party cards populate and Enter the Forge works, resume the Phase 2a snapshot field checklist. Do not begin archetype parameters until snapshot load/refresh/two-device behavior is verified.
