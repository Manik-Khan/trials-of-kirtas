# Apply — The Forge promotion and visibility cleanup

Baseline: the exact **reaction and hidden-information hardening** repository state delivered in `forge-phase2-reaction-hardening-2026-07-16.zip`.

This slice closes:

- initiative overlay/HUD overlap;
- duplicate physical-d20 initiative controls;
- low-contrast initiative evidence;
- missing Jack of All Trades initiative evidence;
- the 60-foot hard disappearance of enemies in truthful open line of sight;
- the first bounded product promotion to canonical `/forge/`, Workshop/Table modes, and Active/Planned controls.

## Recommended: guarded installer

On an untouched reaction-hardening baseline, copy only this installer into the repository's `forge/` directory and run:

```bash
node forge/patch-phase2-promotion-visibility.js /absolute/path/to/trials-of-kirtas
```

The installer:

1. requires a Git working tree;
2. verifies SHA-256 hashes for all 57 expected baseline/target files;
3. refuses an unknown or independently edited baseline;
4. runs `git apply --check` before changing anything;
5. verifies every target hash afterward;
6. exits safely when run a second time.

## Repo-structured replacement

The ZIP also contains the complete target versions of all changed files. Extracting it over the exact baseline installs the same byte-identical result. Afterward, running the installer simply reports that the slice is already applied.

## Alternative: standalone patch

From the repository root:

```bash
git apply --check /path/to/forge-phase2-promotion-visibility-2026-07-16.patch
git apply /path/to/forge-phase2-promotion-visibility-2026-07-16.patch
```

## Focused validation

```bash
node forge/tests/smoke-phase2-promotion-visibility.js
node forge/tests/smoke-forge-initiative.js
node forge/tests/smoke-phase2-final-trust.js
node forge/tests/smoke-phase2-reaction-hidden-info-hardening.js
node forge/tests/smoke-forge-discovery.js
node forge/tests/smoke-phase15g-contract.js
```

Expected results:

- promotion/visibility: **17/17**;
- initiative: **16/16**;
- final trust: **18/18**;
- reaction hardening: **14/14**;
- discovery: **48/48**;
- Phase 1.5g: **76/76**.

## Browser field checklist

1. Open initiative at 1440×900 and at a shorter viewport. Confirm its footer is reachable and the combat HUD cannot cover it.
2. Confirm each row has **Roll**, one final-total input, and **Enter**, with no second d20-entry workflow.
3. Roll Líadan digitally. Confirm the evidence shows `DEX +1` and `Jack of All Trades +1` separately.
4. Enter a physical/manual total. Confirm Forge labels it as a manual total without inventing components.
5. Keep an enemy in open personal line of sight at 65–100 feet. Confirm it no longer disappears.
6. Move it beyond 100 feet. Confirm it becomes gradually grey/soft instead of vanishing.
7. Move it behind a sufficiently tall wall. Confirm the wall still hides it.
8. Confirm exact hostile AC remains absent in Player View.
9. Open `/forge/` directly.
10. Open an old `forge/topography-test-mock.html?session=...` link and confirm its session/query/hash survive the redirect.
11. Confirm structural bridges remain in Active while future tools appear as Planned cards.

After this field pass, continue structural bridge completion and then doors.
