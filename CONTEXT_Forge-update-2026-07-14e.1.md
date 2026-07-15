# CONTEXT Forge update · 2026-07-14e.1

Hotfix over Phase 2e. Phase 2f is paused pending a clean two-device field round.

## Field failures

The Phase 2e renderer added `verticalOverlayGroup` after the initial `resize(); rebuild();`. Initial terrain construction calls `drawVerticalOverlay()`, so module boot failed before `window.CHAR` and `topo:ready`; the visible result was the familiar no-combat-sheet / unusable character-selection screen.

The same field round exposed shared-session convergence failures: a player already waiting in staging did not transition cleanly when the DM started; a fast claim could miss the pipeline identity; refresh visually emptied the feed; a defeated foe could remain as a stale sprite; old table-correctness/feed copies dropped hidden `dmgParts` and failed to filter channels; and the prior Phase 2b.1 external-module patcher had been uploaded but, naturally, not executed by GitHub.

## Phase 2e.1 fixes

- Vertical overlay registry initializes before the first rebuild. Discovery and `SESSION_ID` boot guards remain intact.
- `session_started` updates the still-open claim screen and Enter button without refresh.
- Claims made during cold catch-up are copied into the pipeline identity before seating the board.
- Active row + staging replay triggers bounded catch-up retries and refuses a half-synced board.
- Cold boot and watchdog resync reconstruct the visible encounter feed from the authoritative protocol events.
- Runtime presentation compatibility preserves `dmgParts`; damage component arithmetic is always visible.
- Runtime action compatibility applies Dueling to eligible one-handed weapon/weapon-cantrip actions only when the external module does not already own it, and semantic cantrip dedupe keeps live math.
- Feed channel CSS is corrected; transport/resync messages route to System.
- Downed state now removes/changes stale visuals during both cold spawn and resync.
- Cover Contest remains optional and appears only for half/three-quarters cover; stale decorators cannot arm it for clear attacks.

## Not yet ruled on

The reported missing flanking advantage occurred inside the desynchronized round. Do not change flanking rules until it reproduces in a clean synchronized session with exact unit cells and the active flanking mode recorded.

## Validation

231 runnable checks green across seven suites. Runtime inline scripts parse. Full-repository smokes and live two-device testing remain required.

## Deploy

Replace `forge/topography-test-mock.html`. No patcher execution is required for this hotfix. M uploads, commits, and pushes.
