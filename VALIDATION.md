# Validation record — Phase 1.5g

Completed July 13, 2026.

## Green

Ten headless suites, **338 checks total**:

- `smoke-forge-combat-rules.js` — 56
- `smoke-forge-discovery.js` — 41
- `smoke-forge-effects.js` — 31
- `smoke-phase15d-contract.js` — 20
- `smoke-phase15e-contract.js` — 25
- `smoke-phase15f-contract.js` — 47
- `smoke-phase15g-contract.js` — 76
- `smoke-table-correctness.js` — 29
- `smoke-token-proxy.js` — 7
- `smoke-unit-art-automatic.js` — 6

Additional validation:

- `node --check` on all runtime modules and included test files.
- Extracted all three executable inline scripts from `topography-test-mock.html`; each passes `node --check`.
- Phase 1.5f → 1.5g production diff is bounded to 164 insertions and 93 deletions in the HTML, plus the new pure rules module and the updated table-correctness seam.
- Advantage/disadvantage cancellation, flanking variants, incapacitated exclusions, Prone ranges, crawl/stand costs, replay movement cost, Toll the Dead dice, Monk composition, malformed-damage refusal, feed routing, explicit confirmation, and undo gating all have known-answer coverage.

## Deliberate boundaries

- `Hand of Harm` is not yet a complete post-hit rider. It is explicitly disabled rather than misrepresented as a direct attack.
- Prone is fully enforced; the bundle does not claim complete mechanical enforcement for every inherited condition.
- Area-of-effect targeting remains outside the direct-attack preview/confirmation flow.
- Player movement undo is intentionally unavailable after an opportunity attack or any later consequence; authoritative DM rewind is required.

## Not claimed

- The complete historical repository battery could not be run because a full repository checkout was unavailable in this workspace and outbound Git access was unavailable.
- Automated WebGL rendering was unavailable.
- A live two-device Supabase session was not exercised here.

The real-browser and two-device field checklist in `README_APPLY.md` remains required before calling this table-ready.
