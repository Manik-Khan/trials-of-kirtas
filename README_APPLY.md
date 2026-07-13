# Battle Forge — Phase 1.5 cleanup + Phase 2 foundation

This bundle is based on the July 13 handoff and the newest `topography-test-mock.html` located in the File Library. It deliberately does **not** rewrite the terrain generator yet.

## What this bite changes

### Phase 1.5 cleanup

- Storybook sky + painted horizon stay on by default.
- Broken parallax and landmark cards become explicit experiments:
  - `?parallax=1`
  - `?landmarks=1`
- `?storybook=0` still restores the older background.
- `forge-engine.js` now rejects an unknown `themeKey` with a useful error instead of failing later inside the dungeon generator.
- `forge/camera-discovery-mock.html` provides the approval surface for follow, focus, pair framing, free pan/orbit/zoom, recenter, overseer overview, bounds, and the three discovery states.

### Phase 2 foundation

- Adds `forge/forge-generator-foundation.js`.
- Gives every saved generated encounter a `generatorVersion`.
- Derives independent deterministic seeds for `layout`, `height`, `semantics`, `decor`, and `foes`.
- Keeps `legacy-dungeon` as the compatibility archetype so this bite does not alter today's maps.
- Serializes the graph the existing generator already creates: rooms, edges, loops, critical edges, depths, and semantics.
- Saves the old recipe shape (`seed`, `theme`, `sliders`) **and** an exact plain-JSON `mapSnapshot` plus fingerprint. The snapshot includes current board-unit positions when combat placement exists, with generator semantic marks as the pre-combat fallback.
- Adds a 38-check headless smoke test.

## Apply through a browser

1. Open `tools/forge-phase15-phase2-browser-patcher.html` locally.
2. Choose the current live copies of:
   - `forge/topography-test-mock.html`
   - `forge/forge-engine.js`
3. Click **Validate, patch, and download both files**.
4. Upload the downloaded replacements to `forge/` in GitHub.
5. Upload these new files with their folder paths intact:
   - `forge/forge-generator-foundation.js`
   - `forge/camera-discovery-mock.html`
   - `forge/tests/smoke-generator-foundation.js`
   - `forge/PHASE2_GENERATOR_FOUNDATION.md`

The browser patcher is offline and anchor-guarded. It aborts instead of guessing when a live file has drifted.

## Apply from a checkout

From the repository root:

```bash
node path/to/unzipped-bundle/tools/apply-forge-phase15-phase2-foundation.js .
node forge/tests/smoke-generator-foundation.js
node forge/tests/smoke-forge-engine.js
node forge/tests/smoke-tiers-rebase.js
node forge/tests/smoke-placement.js
node forge/tests/smoke-flora.js
```

Then inspect the diff. The script does not commit or push.

## Browser checks

Open:

- `forge/topography-test-mock.html` — sky + horizon should appear without query flags; broken cards should not.
- `forge/topography-test-mock.html?parallax=1&landmarks=1` — experimental cards should return only when explicitly requested.
- `forge/camera-discovery-mock.html` — exercise all camera controls and approve or revise the interaction contract before the Three.js production build.

## Foundation.2 revision (July 13, second pass)

- `clonePlain` rewritten: cycle detection is now per-ancestry, so a **shared
  (non-cyclic) object referenced by several props survives on every prop**
  instead of silently vanishing after its first occurrence; array positions
  are preserved (`undefined`/functions become `null`, JSON semantics, no
  compaction); the `mapSnapshot` key-strip is **scoped to `meta` only** — a
  prop merely named `mapSnapshot` is no longer eaten.
- The map-bridge `generatorMeta` call is guarded: if the foundation script
  fails to load, terrain still renders with `generatorMeta:null`, and
  `forgeSessionMap()` narrates the missing module at save time.
- `combatMapFromF()` was verified against the live repo: it returns
  `TG.makeMap`'s `{cols, rows, h, wall}` plus `occ` — exactly the shape
  `snapshotMap` requires. No normalizer needed; a smoke check now pins this.
- `SHA256SUMS.txt` no longer lists its own hash (impossible to satisfy;
  `sha256sum -c` would always fail on that line).
- Smoke test grew from 31 to 38 checks covering all of the above.

## Important boundary

The archetype list is now versioned data, not active terrain behavior. The next generator-terrain bite will make archetypes constrain elevations, connectors, spawns, and validation. Keeping that separate protects current seed identity and makes review possible.

This bite **writes** the exact snapshot into newly saved session envelopes. The current session boot path remains recipe-compatible and is not switched to snapshot-first loading here; that consumption change belongs with the production generator/session migration after this foundation is reviewed.
