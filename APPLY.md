# Apply Forge correctness wave 4

This handoff expects the exact **correctness wave 3 / structural bridges 2f.3** repository state as its baseline.

## Recommended: guarded patcher

Unzip this bundle anywhere, then run:

```bash
node forge/patch-phase2-correctness-wave4.js /absolute/path/to/trials-of-kirtas
```

The target must be a Git working tree. The patcher:

1. verifies the SHA-256 of every file it will modify;
2. refuses an unknown or independently edited baseline;
3. runs `git apply --check`;
4. applies the implementation patch;
5. verifies every resulting target SHA-256;
6. exits cleanly when wave four is already applied.

The patcher itself is a delivery helper and is not written into the target repository by its embedded patch.

## Alternative: unified patch

From the repository root:

```bash
git apply --check --whitespace=nowarn /path/to/forge-phase2-correctness-wave4-2026-07-15.patch
git apply --whitespace=nowarn /path/to/forge-phase2-correctness-wave4-2026-07-15.patch
```

The standalone patch includes the delivery patcher as a repository file. Remove it before committing when delivery helpers should not remain in production.

## Alternative: direct overlay

The bundle contains repo-structured copies of every changed implementation file. Copy the `forge/` directory over the repository only when intentionally replacing the corresponding files.

## Focused validation

From the repository root:

```bash
node forge/tests/smoke-phase2-correctness-wave4.js
node forge/tests/smoke-forge-combat-rules.js
node forge/tests/smoke-replay.js
node forge/tests/smoke-feed-render.js
node forge/tests/smoke-table-correctness.js
node forge/tests/smoke-phase15d-contract.js
node forge/tests/smoke-phase15g-contract.js
node forge/tests/smoke-phase2b1-field-round.js
```

Expected headline results:

- wave four: **17 passed, 0 failed**
- combat rules: **62 green**
- replay: **35 passed, 0 failed**
- feed renderer: **66 passed, 0 failed**
- table correctness: **29 green**
- Phase 1.5d: **20 green**
- Phase 1.5g: **76 green**
- Phase 2b.1 field round: **30 green**

The implementation report and browser/two-device checklist are in:

```text
forge/PHASE2_CORRECTNESS_WAVE4_2026-07-15.md
```

Do not promote the old mock route to `/forge` until the reaction-evidence, Silvery Barbs grant, and joining-attacker flanking checks pass cleanly on two devices.
