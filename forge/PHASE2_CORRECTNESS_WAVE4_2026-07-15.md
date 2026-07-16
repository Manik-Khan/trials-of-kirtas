# Forge correctness wave 4 · reaction evidence, granted advantage, and target-level flanking · 2026-07-15

Baseline: Forge correctness wave 3 / structural bridges 2f.3.

This slice addresses the July 15 evening browser field report. It remains inside the correctness gate and does not promote the mock route to `/forge`, create the Planned tab, or begin the next connector type.

## Field findings addressed

### Reaction decisions now expose the triggering attack

Silvery Barbs and Shield prompts previously appeared only after Forge knew an attack had succeeded, but the reacting player was not shown the actual triggering roll. That made an informed choice between the two spells impossible.

The reaction prompt now shows, before **Use** or **Pass**:

- every raw d20 from the triggering attack;
- which d20 was kept and which was dropped;
- the kept d20 plus attack and roll modifiers;
- the final attack total;
- the target defense, including cover;
- whether the attack is a critical hit;
- the automatic advantage/disadvantage source label when present;
- when Shield is also available, whether Shield would actually convert the hit into a miss.

The local/single-device reaction path receives the same essential roll, modifier, defense, and critical information.

This is decision evidence only. It does not expose hidden creature statistics beyond the defense already required to explain the resolved hit.

### Silvery Barbs advantage survives replay into the live HUD

Replay already stored the chosen beneficiary's `advGrant`, and the next resolved attack already consumed it. The live browser unit, however, reconciled only resource pools from replay. Its local `advPreview()` therefore saw no grant and rolled normally.

Shared-unit reconciliation now copies:

- authoritative resources;
- `advGrant`;
- authoritative reaction-used state.

That reconciliation runs after cold boot and after every echoed event. Local snapshot/rewind also preserves the pending grant. The beneficiary's next attack review should now show **Advantage (Silvery Barbs)** and the resolved attack should consume the grant exactly once.

### Flanking is now target-level under the table rule

The old helper asked whether the current attacker personally had an ally in the exact opposite square. That supported the pair who established a flank but excluded a third allied melee attacker joining the same threatened target.

The selected table rule is now:

> Once two conscious allies threaten exact opposite sides or corners of a target, that target is flanked. Every conscious allied melee attacker who also threatens that target receives the selected flanking benefit.

The existing modes remain authoritative:

- **Advantage:** every eligible joining melee attacker receives advantage;
- **+2:** every eligible joining melee attacker receives +2;
- **+5:** every eligible joining melee attacker receives +5;
- **Off:** no contribution.

The attacker must still be conscious, adjacent/in reach, able to threaten the target, and on the same side as the pair establishing the flank. A nearby ally who is not part of an exact opposite pair does not establish a flank.

## Pre-roll Roll Review

The Confirm Attack door now includes a compact automatic review before dice are committed. It reports:

- Normal / Advantage / Disadvantage;
- automatic sources such as flanking or Silvery Barbs;
- final attack bonus;
- Bless 1d4 when present;
- target defense and cover.

This is the correct place to discover a missing automatic modifier before the roll. It also creates a stable future attachment point for an overseer-only pre-roll override.

No general manual advantage/disadvantage override is added in this slice. Routine corrections should not depend on editing a completed roll in God Mode. The intended follow-up design is a staff-only override attached to Roll Review, recorded as an explicit roll-source fact. **Correct Last** remains the emergency path for a genuinely completed incorrect result.

## Validation

### Focused and relevant suites

- wave 4 correctness: **17/17**
- combat rules: **62/62**
- replay: **35/35**
- feed renderer: **66/66**
- table correctness: **29/29**
- Phase 1.5d contract: **20/20**
- Phase 1.5g contract: **76/76**
- Phase 2b.1 field round: **30/30**
- wave 3 correctness: **31/31**

Modified JavaScript parses successfully and `git diff --check` is clean.

### Whole Forge smoke battery

Wave-three baseline:

- **48** completed suites plus one inherited timeout;
- **40** pass;
- **7** inherited failures;
- **1** inherited timeout.

Wave four:

- **49** completed suites plus one inherited timeout, including the new wave-four suite;
- **41** pass;
- **7** inherited failures;
- **1** inherited timeout.

No previously passing suite became a failure. The unchanged inherited reds are:

- `forge/tests/smoke-cover-contest.js`
- `forge/tests/smoke-flora.js`
- `forge/tests/smoke-forge-engine.js`
- `forge/tests/smoke-pick-unit.js`
- `forge/tests/smoke-tiers-rebase.js`
- `forge/tests/smoke-token-rig-contract.js`
- `forge/tests/smoke-unit-art.js`

The unchanged timeout is `forge/tests/smoke-placement.js`.

## Browser/two-device checklist

1. Make an attack against Vesperian that hits while both Shield and Líadan's Silvery Barbs are available. Confirm the reaction prompt shows the raw d20 evidence, final attack total, defense, critical status, and whether Shield would stop it before either reaction is selected.
2. Use Silvery Barbs and grant its advantage to Cosmere. On Cosmere's next attack, confirm Roll Review says **Advantage (Silvery Barbs)**, two d20s are rolled, and the grant is absent on his following attack.
3. Refresh the beneficiary browser after the grant but before the attack. Confirm the same pending advantage remains.
4. Place Vesperian and Líadan on exact opposite sides/corners of a foe. Move Caim into melee reach from another side and confirm he receives advantage in Advantage mode.
5. Repeat the joining-attacker test in +2 and +5 modes and confirm the numeric contribution matches the selected mode.
6. Break the exact opposite pair while Caim remains adjacent. Confirm his flanking contribution disappears.
7. Confirm Bless and cover appear in Roll Review when applicable.
8. Confirm the reaction evidence and Roll Review remain legible in both Staff/top-down and Player/3D presentation.

A clean two-device completion remains part of the `/forge` promotion gate. After that gate, active Phase 2 returns to structural bridge completion and the next connector work.
