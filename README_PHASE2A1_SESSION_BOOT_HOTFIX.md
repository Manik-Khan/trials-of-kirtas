# Battle Forge Phase 2a.1 — session boot-order hotfix

## What happened

Phase 2a added `SESSION_MAP_AUTHORITY` to the production renderer and made `rebuild()` clear it for local, non-session maps. The module's initial `resize(); rebuild();` call still runs early during startup, but `SESSION_ID` was declared later with `const` in the multiplayer block.

That placed the early `rebuild()` read inside JavaScript's lexical dead zone and produced:

`Uncaught ReferenceError: Cannot access 'SESSION_ID' before initialization`

The module stopped before `topo:ready` and the character-sheet bridge were published. The party screen therefore reported no combat sheet even though the sheets were not the failing subsystem.

## Fix

`SESSION_ID` is now initialized from `location.search` beside the early session-map authority state, before the first terrain build. The later multiplayer block reuses that value and no longer declares a late lexical `const`.

`smoke-phase15h-contract.js` now freezes both startup dependencies:

- `DISCOVERY_RENDER` exists before the initial `resize(); rebuild();`;
- `SESSION_ID` exists before the initial `resize(); rebuild();`, with no late `const SESSION_ID` declaration.

## Replace

- `forge/topography-test-mock.html`
- `forge/tests/smoke-phase15h-contract.js`

No other Phase 2a runtime file changed.

## Validation

- All three executable inline scripts in the HTML parse.
- `smoke-snapshot-authority.js`: 24 checks green.
- The new `SESSION_ID` ordering assertions pass directly.
- The patch differs from Phase 2a only at the session initialization seam and its regression test.

The complete repository battery and a real browser/two-device round remain field gates.

## About the 404 messages

The `favicon.ico` and party portrait 404s are separate asset-path warnings. They do not prevent sheet loading or emit the renderer boot failure. The fatal `SESSION_ID` exception was the cause of the no-sheet state in this report.

## Deploy

M uploads, commits, and pushes. Hard-refresh once after replacing the HTML.
