# Validation record — Phase 1.5h

Completed July 13, 2026 against the exact Phase 1.5g production replacement supplied in the preceding bundle.

## Green

Fourteen cumulative suites, **426 checks total**:

- `smoke-cover-calibration.js` — 15
- `smoke-forge-combat-rules.js` — 56
- `smoke-forge-discovery.js` — 41
- `smoke-forge-effects.js` — 31
- `smoke-geometry-sync.js` — 1
- `smoke-los-cover.js` — 50
- `smoke-phase15d-contract.js` — 20
- `smoke-phase15e-contract.js` — 25
- `smoke-phase15f-contract.js` — 49
- `smoke-phase15g-contract.js` — 76
- `smoke-phase15h-contract.js` — 20
- `smoke-table-correctness.js` — 29
- `smoke-token-proxy.js` — 7
- `smoke-unit-art-automatic.js` — 6

Additional validation:

- `node --check` on canonical geometry, discovery, all included test files, both Node helper tools, and the executable browser-patcher script.
- Extracted all three executable inline scripts from the replacement `topography-test-mock.html`; every block passes `node --check`.
- Production inline tactics geometry is byte-identical to `forge/tactics-geometry.js`.
- Guarded battle-mock patcher fixture passes and preserves content outside the geometry block.
- Phase 1.5g → 1.5h production HTML diff is bounded to 331 insertions and 289 deletions, principally canonical geometry, footprint assignment, discovery render registry, continuous veil, and cover-audit UI.
- Discovery module change is bounded to version `1.1.0` and `ignoreCreatures:true` for static visibility.
- SHA-256 manifest verifies without a self-entry.
- ZIP integrity verifies.

## Frozen Phase 1.5h clauses

- Twelve target-body samples across lower body, torso, and head.
- Less than half the target body blocked does not grant cover.
- Six to eight samples grant half; nine to eleven grant three-quarters; twelve physically blocked is total.
- Target-side attribution remains authoritative.
- Low lips no longer automatically grant half cover.
- Sub-cell circles/boxes prevent narrow props from becoming five-foot walls.
- Living intervening creatures can grant half cover; dead creatures do not.
- Discovery ignores transient creature cover.
- Ledge peek and parapet lean remain, including steep-berm/tall-wall/one-back closures.
- Per-instance terrain visibility and one continuous unexplored veil replace overlapping boxes.
- Props, decals, grid marks, and local lights require current visibility.
- Staff cover audit reports only to System.

## Deliberate boundaries

- The twelve-sample thresholds are a deterministic Battle Forge interpretation of body coverage, not a claim that tabletop RAW mandates a twelve-ray algorithm.
- First-pass prop shapes are calibration data. Phase 2 tactical props still need authored footprints, rotations, movement effects, and art/rules agreement.
- Explored memory currently retains dark static terrain only; remembered props/lights are intentionally not claimed.
- Cover audit is diagnostic. Cover Contest remains the authoritative adjudication override.

## Not claimed

- Automated WebGL screenshots were unavailable.
- A live two-device Supabase field round was not exercised.
- The complete historical repository battery outside the cumulative Phase 1.5 bundle was not available in this workspace.
- The exact current `battle-tactics-geo-mock.html` was not supplied; the guarded patcher was validated against an extracted reference fixture, and M must diff its output against the live file.

The browser/two-device checklist in `README_APPLY.md` remains the release gate.
