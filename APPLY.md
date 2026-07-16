# Apply — Forge Phase 2 reaction and hidden-information hardening

Baseline: the exact **Phase 2 final trust** repository state delivered in `forge-phase2-final-trust-2026-07-15.zip`.

This patch closes:

- Silvery Barbs and Shield using eligible higher-level spell slots;
- replay-authoritative, idempotent reaction-spell payment;
- truthful Shield presentation after a natural 20;
- player-side redaction of exact hostile AC/defense.

## Recommended: guarded installer

Copy this bundle over the repository root, then run:

```bash
node forge/patch-phase2-reaction-hardening.js /absolute/path/to/trials-of-kirtas
```

The installer:

1. requires a Git working tree;
2. verifies SHA-256 hashes for every expected baseline file;
3. refuses unknown or independently edited baselines;
4. applies the embedded patch only after `git apply --check` succeeds;
5. verifies every target hash afterward;
6. exits safely when run a second time.

## Alternative: standalone patch

From the repository root:

```bash
git apply --check /path/to/forge-phase2-reaction-hardening-2026-07-16.patch
git apply /path/to/forge-phase2-reaction-hardening-2026-07-16.patch
```

## Focused validation

```bash
node forge/tests/smoke-phase2-reaction-hidden-info-hardening.js
node forge/tests/smoke-phase2-final-trust.js
node forge/tests/smoke-replay.js
node forge/tests/smoke-kit-derive.js
```

Expected focused results:

- reaction hardening: **14/14**;
- final trust: **18/18**;
- replay: **35/35**;
- kit derivation: **341/341**.

## Browser field checklist

1. Exhaust Líadan's 1st-level slots while retaining a 2nd-level slot.
2. Start her next turn and confirm her reaction refreshes.
3. Trigger a successful attack and accept Silvery Barbs using the offered 2nd-level slot.
4. Refresh both devices and confirm exactly one slot was spent.
5. Trigger a natural 20 against a Shield user.
6. Confirm the prompt says the critical still hits and offers **Cast for later attacks**.
7. Confirm subsequent attacks use Shield's +5 AC.
8. Attack an enemy from Player View and verify that Roll Review, prompts, and feed do not reveal exact enemy AC.
9. Confirm staff presentation may still inspect exact defense where appropriate.

A clean two-browser result clears the final hardening gate for the bounded `/forge` promotion and cleanup milestone.
