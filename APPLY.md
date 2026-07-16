# Apply Forge Phase 2 final trust slice · 2026-07-15

This bundle targets the exact repository state produced by **Forge correctness Wave 4**.

## Recommended: guarded patcher

Copy the bundle into the repository while preserving its folder structure, then run:

```bash
node forge/patch-phase2-final-trust.js /absolute/path/to/trials-of-kirtas
```

The patcher:

- verifies that the target is a Git working tree;
- verifies every relevant Wave 4 baseline hash;
- refuses an unknown or independently edited baseline;
- applies the embedded patch;
- verifies every target hash afterward;
- exits safely when run a second time.

## Alternative: copy the repo-structured files

The bundle mirrors repository paths. You may copy the included files over the matching files in the repository. The new files are:

- `forge/forge-initiative.js`
- `forge/tests/smoke-forge-initiative.js`
- `forge/tests/smoke-phase2-final-trust.js`
- `forge/PHASE2_FINAL_TRUST_SLICE_2026-07-15.md`

## Standalone patch

A separate `forge-phase2-final-trust-2026-07-15.patch` is provided alongside this ZIP. From the Wave 4 repository root:

```bash
git apply --check /path/to/forge-phase2-final-trust-2026-07-15.patch
git apply /path/to/forge-phase2-final-trust-2026-07-15.patch
```

## Focused validation

```bash
node forge/tests/smoke-forge-initiative.js
node forge/tests/smoke-phase2-final-trust.js
node forge/tests/smoke-table-correctness.js
node forge/tests/smoke-forge-discovery.js
node forge/tests/smoke-forge-effects.js
```

Then perform the two-browser initiative, Bless, and player-vision checklist in `forge/PHASE2_FINAL_TRUST_SLICE_2026-07-15.md`.

Do not promote the route to `/forge` until that field pass is clean.
