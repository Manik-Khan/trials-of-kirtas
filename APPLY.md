# Apply Forge correctness wave 3 + structural bridges 2f.3

This handoff expects the July 15 **wave-two** repository state as its baseline. The guarded patcher verifies every touched baseline file before writing anything.

## Recommended: guarded patcher

Unzip this bundle anywhere, then run:

```bash
node forge/patch-phase2-correctness-wave3.js /absolute/path/to/trials-of-kirtas
```

The target must be a Git working tree. The patcher:

1. verifies the SHA-256 of every file it will modify;
2. refuses an unknown or independently edited baseline;
3. runs `git apply --check`;
4. applies the patch;
5. verifies every resulting target SHA-256;
6. exits cleanly when wave three is already applied.

The patcher itself is a delivery helper and is not added to the target repository by its embedded patch.

## Alternative: unified patch

From the repository root:

```bash
git apply --check --whitespace=nowarn /path/to/forge-phase2-correctness-wave3-2026-07-15.patch
git apply --whitespace=nowarn /path/to/forge-phase2-correctness-wave3-2026-07-15.patch
```

The standalone patch includes the delivery patcher as a repository file. Remove it before committing when you do not want delivery helpers retained in production.

## Alternative: direct overlay

The bundle contains repo-structured copies of every changed file. Copy `FORGE_PROTOCOL.md`, `data/`, and `forge/` over the repository only when you intentionally want to replace the corresponding files.

## Focused validation

From the repository root:

```bash
node forge/tests/smoke-phase2-correctness-wave3.js
node forge/tests/smoke-replay.js
node forge/tests/smoke-protocol.js
node forge/tests/smoke-forge-discovery.js
node forge/tests/smoke-phase2f-bridges-damage.js
node forge/tests/smoke-forge-effects.js
node forge/tests/smoke-forge-combat-rules.js
node forge/tests/smoke-kit-derive.js
```

Expected headline results:

- wave-three suite: **31 passed, 0 failed**
- replay: **35 passed, 0 failed**
- protocol: **56 passed, 0 failed**
- discovery: **45 green**
- bridge/damage: **40 green**
- effects: **39 green**
- combat rules: **61 green**
- kit derivation: **341 passed, 0 failed**

The implementation report and browser/two-device checklist are in:

```text
forge/PHASE2_CORRECTNESS_WAVE3_2026-07-15.md
```

Do not promote the old mock route to `/forge` until the downed-state, nested-OA/reaction, wall-occlusion, and bridge-state field checklist passes cleanly on two devices.
