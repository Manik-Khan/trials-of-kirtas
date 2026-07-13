# Validation record — foundation.2

Completed July 13, 2026, second pass, with the live repository cloned into the workspace.

## Green

- `node --check` on all four JS deliverables plus inline-script extraction
  for both HTML artifacts (importmap block excluded as non-JS).
- `node forge/tests/smoke-generator-foundation.js` — **38 checks green**,
  including the new shared-reference, array-position, cycle, scoped-strip,
  and live-map-shape regressions.
- `tools/test-apply-forge-phase15-phase2-foundation.js` — fixture patch
  checks green with the guarded `generatorMeta` assertion.
- **Applied against a scratch copy of the actual live repo** — all anchors
  landed on the real `topography-test-mock.html` and `forge-engine.js`.
- Post-apply on the patched scratch:
  - patched engine's unknown-theme guard fires; valid `generate()` unchanged
    (returns `{cols,rows,h,wall,occ,spawns,props,meta}` — the exact
    `snapshotMap` contract);
  - all 3 inline JS blocks in the patched topography mock parse;
  - **full forge battery: 20/20 suites green** (the 19 pre-existing suites
    plus the new foundation smoke); unpatched baseline 19/19 — zero
    regressions.
- `combatMapFromF()` read from the live source: emits `cols/rows/h/wall/occ`
  via `TG.makeMap`. Session save cannot hit a shape mismatch.
- `FD.THEME_KEYS` confirmed exported by `forge-dungeon.js` and consumed by
  `forge-engine.js`, so the engine guard is on solid ground.

## Not claimed

- Chromium screenshot automation remains unavailable; the camera mock still
  needs M's browser eyeball before production camera wiring. Two contract
  notes for that review: pan direction goes screen-space-wrong after
  orbiting (production Three.js pan must be camera-relative), and the
  disabled Overview button should state why it is disabled.
- No Supabase migration is included; live database behavior was not
  exercised. The envelope stays inside the session `map` payload with old
  top-level recipe keys intact.
- Snapshot-first session loading is intentionally not part of this bite.
