# Validation record — Phase 1.5f

Completed July 13, 2026 against the exact Phase 1.5e production output.

## Green

### Runtime syntax

- `node --check forge/forge-discovery.js`
- `node --check forge/forge-effects.js`
- `node --check forge/forge-table-correctness.js`
- `node --check forge/forge-unit-art.js`
- `node --check netlify/functions/forge-token-art.js`
- Extracted and parsed all three executable inline scripts from `forge/topography-test-mock.html`:
  - canonical geometry block;
  - production ES module block;
  - classic party/session block.

### Headless and integration checks

- `smoke-forge-effects.js` — **31 green**
- `smoke-phase15d-contract.js` — **20 green**
- `smoke-phase15e-contract.js` — **25 green**
- `smoke-table-correctness.js` — **29 green**
- `smoke-token-proxy.js` — **7 green**
- `smoke-unit-art-automatic.js` — **6 green**
- `smoke-forge-discovery.js` — **41 green**
- `smoke-phase15f-contract.js` — **47 green**

**Total: 206 checks green.**

New coverage includes:

- stable three-state discovery values;
- explicit/darkvision/default sight radii;
- canonical LoS delegation and party-union visibility;
- explored-memory accumulation and event-history reconstruction;
- PC/foe roster-kind normalization;
- movement path, edit, reinforcement and restore history;
- camera-independent world-space fog groups;
- instanced unexplored versus explored rendering;
- Player View versus Staff View behavior;
- hidden-foe unit rig, initiative, target pool, cell picker and fallback-picker gates;
- hidden-turn camera non-disclosure;
- anonymous hidden-attacker feed presentation;
- ranged direct-action qualification;
- reachable-origin classification with movement-cost preservation;
- no preview on unexplored origins;
- green/yellow/orange/dark cover vocabulary;
- long-range disadvantage retention;
- silent preview geometry evaluation;
- no protocol addition and explicit AoE exclusion.

### Integrity

- `SHA256SUMS.txt` excludes itself and passes `sha256sum -c`.
- ZIP integrity passes `unzip -t`.

## Source/diff

- Phase 1.5e topography baseline SHA256:
  `3487178acdfb382fed59f30bc465097b749fd29ff2984fad5573abb83df76c56`
- Phase 1.5f topography replacement SHA256:
  `ced0e444f68f8648e746ed3c1a313ec75420fd117a6396e37c930a6ad3fd1807`
- Topography diff: **169 insertions, 19 deletions**.

## Not claimed

- No automated Chromium/WebGL rendering was available. The fog volumes, 3D/top-down composition, overlay colors and hover feel require M's real-browser eyeball.
- A live two-device Supabase session was not exercised in this workspace. Shared exploration was validated headlessly from event-shaped history, not over realtime transport.
- The complete historical repository checkout could not be fetched here, so unrelated legacy Forge suites were not rerun. All eight relevant retained/new suites in this bundle are green.
- Cell-volume fog is the approved first renderer, not the final per-instance terrain renderer.
- Hidden-contact movement, AoE templates and click-to-queue move/attack are not implemented.
- No commit or push was performed.

## Recommended repository checks after upload

```bash
node forge/tests/smoke-forge-discovery.js
node forge/tests/smoke-phase15f-contract.js
node forge/tests/smoke-forge-effects.js
node forge/tests/smoke-phase15e-contract.js
node forge/tests/smoke-table-correctness.js
node forge/tests/smoke-cover-contest.js
node forge/tests/smoke-los-cover.js
node forge/tests/smoke-forge-board.js
node forge/tests/smoke-replay.js
```
