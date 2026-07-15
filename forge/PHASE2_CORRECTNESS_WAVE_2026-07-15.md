# Forge Phase 2 correctness wave · implementation report · 2026-07-15

Baseline: uploaded `trials-of-kirtas-main.zip` (`sha256 0834bd54245977ab90c976fc36f288424999be61b1ffcb7bd193313412d2d3fd`).

This slice deliberately does **not** promote the route to `/forge`, move bridge tools into Planned, or begin the next connector capability. Structural bridges remain active Phase 2 work.

## Implemented

### Raw d20 evidence

- Advantage and disadvantage now retain both raw d20 results and the kept index.
- Normal rolls and cancelling advantage/disadvantage retain one d20.
- Silvery Barbs retains the triggering die, the new die, and which result stands.
- The evidence survives attack publication, replay facts, Chronicle conversion, refresh/replay, and feed rendering.
- The feed marks the kept die clearly and subdues/strikes the dropped die.

### Ki / Focus authority

- `ki`, `kiPoints`, `ki_points`, `focus`, `focusPoints`, and `focus_points` normalize to one `ki` pool.
- Resources are seeded into replay state from the session roster.
- Successful `ability_used` and `attack_resolved` facts carry `resource_spend`.
- Failed or cancelled publication spends nothing.
- Flurry of Blows attaches the spend to its first resolved strike only, so both strikes cost one Ki total.
- Replay, refresh, snapshot, and restore reconstruct the same remainder.
- The HUD reads replay-authoritative resource values through the existing derived kit/pool presentation.

### Dash and movement reconciliation

- Turn economy now records `movedFt`, `movementBonusFt`, and `movementCostFt` as replay facts.
- Remaining movement is derived as:

  `base speed + movement bonuses - moved distance - extra movement costs`

- Dash and Step of the Wind — Dash publish movement bonuses instead of mutating a session-local counter.
- Standing from Prone publishes its movement cost.
- HUD maximum, HUD remainder, reachable cells, movement validation, refresh, replay, and rewind enter through `reconcileMovementPresentation()`.
- The walk-completion callback re-enters the same door, preventing highlights from disappearing after movement/action sequences.

### Product and presentation decisions

- **Open the Table** is now **Roll Initiative** everywhere user-facing.
- Supporting copy explains that the action creates the persistent shared encounter.
- Grid opacity defaults to 50%.
- Grid opacity remains local and persists per browser through `localStorage`.
- The selected/hovered green destination receives a subtle pulse; reduced-motion mode holds a static presentation.
- Fog-mask sampling is nearest-neighbor with mipmaps disabled, preventing unexplored void pixels from bleeding into visible cells.
- The existing three-state discovery renderer continues to hide unexplored terrain instances and all visible-only objects, retain subdued explored terrain, and union party discovery.

## Validation

### Focused correctness suite

`node forge/tests/smoke-phase2-correctness-wave.js`

- 22 passed, 0 failed.

It covers resource aliases, successful and cancelled spend, Flurry's one-Ki total, deterministic replay, snapshot/restore, Dash and movement-cost facts, accumulated movement bonuses, raw advantage evidence, Silvery Barbs evidence, Chronicle preservation, the reconciliation door, Roll Initiative, local 50% grid, reduced-motion-safe pulse, and fog-mask sampling.

### Relevant regression suites

All passed:

- protocol: 56/56
- replay: 35/35
- Forge board: 26/26
- effects/Sanctuary ledger: 31/31
- discovery: 41/41
- table correctness: 29/29
- feed renderer: 66/66
- Phase 1.5e integration: 25/25
- Phase 2b.1 field round: 30/30
- Phase 2f bridges/damage: 40/40
- Phase 2f.1 audit: 21/21
- Phase 2f.2 damage pipeline: 39/39
- kit derivation: 341/341
- starter kits: 20/20

All modified JavaScript files pass `node -c`; the production HTML's executable inline scripts pass the Phase 2b.1 parser check; `git diff --check` is clean.

### Whole Forge smoke battery

Uploaded baseline:

- 44 tests total
- 33 pass
- 10 fail
- 1 timeout

This slice:

- 45 tests total, including the new correctness suite
- 35 pass
- 9 fail
- 1 timeout

The feed renderer moved from failing to passing, the new correctness suite passes, and no new whole-battery failure remains. The inherited reds are unchanged: cover-contest calibration, Flora/stage-engine harness, flat-mode engine expectation, stale Phase 1.5d/1.5g contracts, pick-unit harness, placement timeout, tiers rebase harness, and stale unit-art contract/version checks.

## Field verification still required

Automated coverage cannot close these browser/multiplayer gates:

1. Confirm both raw d20s and the kept die remain identical after two-device refresh/reconnect.
2. Confirm Caim spends one Ki for Flurry, Patient Defense, and each Step of the Wind choice on both devices.
3. Reproduce 10 ft move → Dash → 20 ft move and confirm 30 ft remains on both devices; then refresh and rewind.
4. Move → attack → move again and confirm reachable blue tiles return.
5. Visually inspect the selected green pulse across terrain and reduced-motion mode.
6. Zoom out in Player View and confirm no unexplored topology, props, enemies, decals, badges, or lights leak through.
7. Drive a hostile enemy attack against Sanctuary-protected Líadan and verify the Wisdom-save gate, redirect/lost-action behavior, successful attack behavior, removal trigger, and refresh reconstruction.
8. Complete one clean two-device join/claim/refresh/replay/correction round.

The `/forge` promotion gate remains closed until this field pass succeeds.

## Archive-size note

The extracted repository is about 93 MB. The largest asset concentrations are:

- `forge/`: 29.28 MB, dominated by biome horizons, skies, and parallax PNGs;
- `img/`: 6.88 MB, led by `img/maps/kirtas.jpeg` at 5.58 MB;
- `assets/`: 6.43 MB, including the Vesperian sprite sheet at 1.58 MB.

Asset optimization should be a later bounded maintenance slice: inventory references first, then lossless metadata stripping, WebP/AVIF candidates, responsive variants, duplicate detection, and repository/LFS policy. No art assets were changed in this correctness wave.
