# Apply the Forge Phase 2 correctness wave

Use one of these methods from the clean repository state represented by the uploaded July 15 `main` ZIP.

## Guarded patcher

Copy this bundle over the repository root, then run:

```bash
node forge/patch-phase2-correctness-wave.js
```

The patcher verifies SHA-256 hashes for every touched baseline file, refuses an unknown/edited baseline, applies the patch, and verifies the target hashes.

## Unified patch

From the repository root:

```bash
git apply --check forge-phase2-correctness-wave-2026-07-15.patch
git apply forge-phase2-correctness-wave-2026-07-15.patch
```

## Validate

```bash
node forge/tests/smoke-phase2-correctness-wave.js
node forge/tests/smoke-feed-render.js
node forge/tests/smoke-phase2b1-field-round.js
node forge/tests/smoke-phase2f2-damage-pipeline.js
```

The two-device browser pass and Sanctuary hostile-target test remain required before `/forge` promotion.
