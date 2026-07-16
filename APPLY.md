# Apply · Forge initiative-authority cleanup · 2026-07-16

## Expected baseline

Apply this to the July 16 **promotion/visibility** build—the build that introduced canonical `/forge/`, Workshop/Table modes, the Planned tab, the compact initiative editor, and widened long-range creature recognition.

## Preferred: guarded installer

From anywhere:

```bash
node /path/to/extracted/forge-phase2-initiative-authority-cleanup-2026-07-16/forge/patch-phase2-initiative-authority-cleanup.js /absolute/path/to/trials-of-kirtas
```

The installer checks every expected baseline hash before writing. It is idempotent: a second run reports that all files are already current.

## Alternative: standalone patch

From the repository root:

```bash
git apply --check /path/to/forge-phase2-initiative-authority-cleanup-2026-07-16.patch
git apply /path/to/forge-phase2-initiative-authority-cleanup-2026-07-16.patch
```

## Verification

```bash
node forge/tests/smoke-phase2-initiative-authority-cleanup.js
node forge/tests/smoke-kit-derive.js
node forge/tests/smoke-phase2-final-trust.js
node forge/tests/smoke-phase2-promotion-visibility.js
node forge/tests/smoke-phase2-reaction-hidden-info-hardening.js
node forge/tests/smoke-phase2b1-field-round.js
```

Expected focused result:

```text
14 passed, 0 failed
```

## Browser check

1. Hard-refresh `/forge/` on both browsers.
2. Open initiative and roll Líadan.
3. Confirm the row shows `DEX +1` and `Jack of All Trades +1`.
4. Confirm the total is `d20 + 2`.
5. Confirm there is no `Other sheet bonuses -1` and no stale-sheet warning.
6. Confirm the bright modal shows the math immediately.
7. After closing the modal, confirm the feed contains one permanent initiative fact rather than duplicate narration.
