# CONTEXT Forge update · 2026-07-14b.1

Field corrections after the first Phase 2b Map Contract browser/two-device pass.

## Current authority

Phase 1.5h.1 remains the settled combat geometry/fog baseline. Phase 2a.1 makes saved snapshots authoritative. Phase 2b freezes Map Contract 2.0 and truthful tactical vertical scale. This b.1 patch corrects five demonstrated runtime/UI regressions without changing that architecture.

## Damage derivation and evidence

The table showed only a final damage total. Vesperian's `Booming Blade · Longsword` also resolved without the expected +6 flat modifier because two representations coexisted:

- the current live-derived weapon cantrip, which should own attack/damage math;
- the saved legacy Booming Blade row/id used by default HUD slots, whose `dmgMod` was stale.

New contract:

1. `weapon-actions.js` derives Dueling (+2) for eligible one-handed melee attacks and weapon cantrips. No bonus for ranged, two-handed-only, or versatile-two-handed mode.
2. `forge-kit-derive.js` semantically folds Booming Blade / Green-Flame Blade weapon variants. The higher-authority derived action owns math but adopts the legacy id so saved slot references survive.
3. every attack resolution publishes `dmgParts` with rolls, flat bonus, type, and component total;
4. `forge-table-correctness.js` preserves those parts in replayable display facts;
5. `forge-feed-render.js` displays the arithmetic by default.

Critical damage doubles dice only. Rage remains flat and non-doubled; Hex dice double on a critical.

## Vertical inspection access

The Phase 2b scale lock was correct, but the only adjustable state was hidden behind the full-screen local party selector. Local mode now exposes **Inspect map** before combat and **Choose party / start fight** to return. Shared sessions never expose authoring preview and remain `100% · tactical`.

## Multi-character claim flow

A successful shared claim no longer auto-enters the fight. The overlay remains open for additional claims and provides an explicit **Enter the fight** door. Each claim still goes through `forge_claim_unit()` and refreshes the authoritative controllers map.

## Movement refresh reconciliation

The log was correct but presentation was not. `beginTurn()` painted a fresh full budget; replay then computed the real remainder without repainting. The next echoed shared move also subtracted locally from the already-reconciled value.

Now:

- `setActiveFromLog()` repaints immediately after `applyLogEconomy()`;
- a session `walk` echo only re-applies log economy;
- local sandbox movement alone performs direct path subtraction.

The known field sequence—move 20/30, attack, refresh, move 10—must display 10/30 after refresh and 0/30 after the final move.

## Cover Contest

Cover Contest is now offered only for canonical finite partial cover (`+2` or `+5`). It is absent for clear shots and total cover, and a stale toggle clears if geometry changes before confirmation.

M's proposed staff correction path is accepted in principle but not implemented locally. A cover override must be a shared, replayable one-shot adjudication scoped to attacker + target + turn + action. It must not permanently mutate target AC. Design that protocol-backed quick action before building the right-click/God Mode UI.

## Files

Replace:

- `forge/topography-test-mock.html`

Add/run:

- `forge/patch-phase2b1-field-round.js` — guarded transactional patch for `weapon-actions.js`, `forge-kit-derive.js`, `forge-table-correctness.js`, and `forge-feed-render.js`
- `forge/tests/smoke-phase2b1-field-round.js`

Documentation:

- `README_PHASE2B1_FIELD_ROUND.md`

## Validation

Focused green checks in the isolated working set:

- Phase 2b.1 field round: 30
- snapshot authority: 24
- Map Contract/render truth: 23

All three executable inline scripts parse. Both startup-order guards remain pinned. Full repository battery and post-deploy Supabase/browser rounds remain required.

## Next order

1. Deploy and field-check b.1.
2. Specify the protocol-backed one-shot staff cover override; build only after the fact shape and replay behavior are frozen.
3. Resume Phase 2 generator work: archetype selector + versioned parameter records, then stage-owned deterministic streams.
