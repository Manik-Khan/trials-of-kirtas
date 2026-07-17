# CONTEXT_Forge update · 2026-07-13d

Supersedes the 13c token-rig handoff as the current short Forge handoff. Earlier geometry, character-authority, camera and generator-foundation records remain authoritative for their own shipped decisions.

## Phase 1.5d built

The exact production `topography-test-mock.html` that M field-tested after the 3D/top-down and token-rig build was used as the patch base.

### Presentation authority

The Forge toggle now opens a compact menu containing Forge-chrome visibility and, for authorized staff/DM/overseer accounts, a local **Staff View / Player View** toggle.

- Real players are permanently masked.
- Staff retain authority while locally entering Player View.
- Player View omits enemy initiative HP, suppresses the complete active-enemy BG3 bar, removes overseer tools and filters hidden enemies through `foeVisible()`.
- The choice is local-only and remembered; it never publishes a protocol event.

### Monster token art

The blank `G` goblin result was an identity-transport problem, not absent bestiary art.

- Generic goblins now carry `Goblin / MM`.
- Picked and saved foes preserve `{name,source}` through the roster and combat unit.
- `forge-unit-art.js` v1.1 resolves through a fixed-path same-origin Netlify token bridge, retries direct 5e.tools art, then uses initials.
- Existing per-unit and per-kind custom overrides remain higher priority.

### Table-correctness fixes

- Reinforcement picker is now a viewport-owned modal above the BG3 HUD, with reachable scrolling and footer.
- Caim's raw `kiPoints` pool aliases to canonical combat resource `ki` without changing the sheet key.
- Every leveled spell asks for a slot when several eligible levels exist; non-scaling spells say there is no higher-level benefit. This fixes Sanctuary's silent level-2 spend.
- The existing pre-roll cover adjudication is restored to the BG3 HUD as **Contest next shot**.
- The right-side Forge feed now receives authoritative structured attack/ability facts, including full roll math, cover word and damage, with subtle hit/miss/crit/save/heal tinting and no AC.

### Deliberate boundary

Sanctuary's persistent ward, Wisdom-save interception and break conditions are not pretended here. They are the first effect-ledger implementation in Phase 1.5e.

## Validation

- 20 Phase 1.5d integration-contract checks.
- 21 table-correctness checks.
- 7 token-proxy checks.
- 6 automatic-art checks.
- Total: 54 checks green.
- All three runtime JavaScript files parse.
- All three inline scripts extracted from the patched HTML parse.
- SHA256 manifest verifies cleanly.

The full repository Forge battery was not rerun in this isolated workspace because the complete checkout was unavailable. M should run the listed existing smokes after upload when practical.

## Next order

1. M browser-eyeballs Phase 1.5d on staff and player devices.
2. Phase 1.5e: general replayable effect ledger, Sanctuary first.
3. Phase 1.5f: party-shared world-space fog and direct-attack firing-position/cover preview.
4. Phase 2 terrain: active archetypes, elevations, connectors, semantic spawns/objectives, validation and repair.

## Deploy rule

M uploads, commits and pushes through GitHub. Return repository-shaped files; do not push.
