# Validation record — Phase 1.5d

Completed July 13, 2026 against the exact production HTML uploaded after M's successful 3D/top-down and token-rig field test.

## Green

### Runtime syntax

- `node --check forge/forge-table-correctness.js`
- `node --check forge/forge-unit-art.js`
- `node --check netlify/functions/forge-token-art.js`
- Extracted and parsed all three executable inline scripts from the patched HTML:
  - classic geometry block;
  - production ES module block;
  - classic party/session block.
- Import map excluded because it is JSON, not executable JavaScript.

### Headless checks

- `smoke-phase15d-contract.js` — **20 green**
- `smoke-table-correctness.js` — **21 green**
- `smoke-token-proxy.js` — **7 green**
- `smoke-unit-art-automatic.js` — **6 green**

**Total: 54 checks green.**

Coverage includes:

- permission-aware Staff/Player View;
- real-player lock to Player View;
- hidden-foe filtering and enemy-vital masking;
- active-enemy HUD suppression;
- Forge-menu presentation toggle;
- bestiary identity transport and generic Goblin/MM fallback;
- same-origin token bridge and direct-art retry;
- custom-art precedence;
- reinforcement modal stacking/close contract;
- `kiPoints` → `ki` alias while retaining `rawKey`;
- non-scaling leveled-spell chooser text;
- Cover Contest restoration;
- declaration/resolution feed merging;
- self-contained resolved attack display facts;
- damage, healing and soft verdict tone classes;
- duplicate predictive-row prevention.

### Integrity

- `SHA256SUMS.txt` excludes itself and passes `sha256sum -c`.
- Patched HTML is based on the uploaded file with SHA256:
  `484644cdcd1b091171b4ca65d9f03fd0e40774438bbcc6780d72dda59ab997a2`.

## Not claimed

- No automated Chromium/WebGL rendering was available. M still needs to eyeball the menu, reinforcement modal, top-down token images and feed colors in a real browser.
- The complete repository was not available in this isolated workspace, so the entire pre-existing Forge smoke battery was not rerun here.
- Supabase/RLS and a real two-device session were not exercised by headless tests.
- Sanctuary's persistent effect is not implemented in this bite; only correct slot choice is.
- Fog of war and the firing-position cover preview remain the next separate bite.
- No commit or push was performed.

## Recommended repository checks after upload

```bash
node forge/tests/smoke-phase15d-contract.js
node forge/tests/smoke-table-correctness.js
node forge/tests/smoke-token-proxy.js
node forge/tests/smoke-unit-art-automatic.js
node forge/tests/smoke-kit-derive.js
node forge/tests/smoke-starter-kits.js
node forge/tests/smoke-cover-contest.js
node forge/tests/smoke-feed-render.js
node forge/tests/smoke-forge-board.js
node forge/tests/smoke-replay.js
```
