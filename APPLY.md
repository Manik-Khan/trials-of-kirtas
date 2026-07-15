# Apply Forge Phase 2 correctness wave 2

This handoff expects the July 15 correctness-wave-1 state as its baseline. The guarded patcher verifies every touched baseline file before it writes anything.

## Recommended: guarded patcher

Unzip this bundle anywhere, then run:

```bash
node forge/patch-phase2-correctness-wave2.js /absolute/path/to/trials-of-kirtas
```

The target must be a Git working tree. The patcher:

1. verifies the SHA-256 of every file it will modify;
2. refuses an unknown or independently edited baseline;
3. runs `git apply --check`;
4. applies the patch;
5. verifies every resulting target SHA-256;
6. exits cleanly when the wave is already applied.

The patcher itself is a delivery helper and is not added to the target repository by its embedded patch.

## Alternative: unified patch

From the repository root:

```bash
git apply --check --whitespace=nowarn /path/to/forge-phase2-correctness-wave2-2026-07-15.patch
git apply --whitespace=nowarn /path/to/forge-phase2-correctness-wave2-2026-07-15.patch
```

## Alternative: direct overlay

The bundle contains repo-structured copies of every changed file. Copy `data/` and `forge/` over the repository only when you intentionally want to replace the corresponding files.

## Focused validation

From the repository root:

```bash
node forge/tests/smoke-phase2-correctness-wave2.js
node forge/tests/smoke-forge-effects.js
node forge/tests/smoke-forge-combat-rules.js
node forge/tests/smoke-feed-render.js
node forge/tests/smoke-table-correctness.js
node forge/tests/smoke-replay.js
node forge/tests/smoke-protocol.js
```

Expected focused result:

- wave-2 suite: **31 passed, 0 failed**
- effects: **39 green**
- combat rules: **61 green**
- feed renderer: **66 passed, 0 failed**
- table correctness: **29 green**

The full implementation report and browser field checklist are in:

```text
forge/PHASE2_CORRECTNESS_WAVE2_2026-07-15.md
```

Do not promote the old mock route to `/forge` until the browser and two-device field pass is clean.
