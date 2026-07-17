# Battle Forge Phase 2f.1 — audited field correction

This hotfix supersedes the Phase 2f browser claims about damage evidence and bridge diagnostics. The field screenshots showed that neither release gate had reached the real interface reliably.

## What the audit found

### Damage evidence

The prior evidence helper was tested in isolation, but production mutated the newest feed row **after** `addForgeRow()`. The HUD is allowed to repaint the feed, so that DOM-only mutation could disappear immediately. A second gap existed in the event translator: some resolved facts retained only scalar `dmg`, discarding `dmgParts[]` and `dmgFormula` before rendering.

Phase 2f.1 installs `forge-damage-evidence.js` directly over the `ForgeTableCorrectness` event-to-row seam. Evidence is inserted into the row HTML **before** the HUD receives it. Newly resolved attacks therefore show:

```text
1d8 + 6 Slashing
[actual roll] +6 = total Slashing
```

If a successful event still arrives with only a scalar total, the Table row now says **Damage evidence missing** and the System channel receives a release-gate warning. A total-only result can no longer masquerade as complete evidence.

Dueling is also repaired on the final derived kit that combat consumes, not merely on a transient assembly list. Eligible one-handed weapon attacks and bound Booming Blade/Green-Flame Blade actions receive +2 exactly once; two-handed modes remain excluded.

Historical protocol events that stored only `dmg` cannot recover die rolls that were never published. Use newly resolved attacks for this field gate.

### Bridge and connector diagnostics

Phase 2f generated bridges automatically, but exposed no obvious generation control. The connector overlay existed only in the compact Forge dropdown, making the browser checklist misleading.

The always-visible staff authoring panel now contains:

- **Show connectors** — toggles the vertical geometry overlay;
- **Find bridge seed** — searches the next 48 deterministic root seeds for a generated structural bridge;
- an explicit status line listing stairs, ramps, bridges, and open ledges;
- an explicit `no structural bridge on this seed` result when applicable.

The seed finder re-normalizes each candidate recipe so every root seed receives fresh derived stage seeds; it does not accidentally reuse the current seed’s stage streams.

## Apply over Phase 2f

Replace/add:

- `forge/topography-test-mock.html`
- `forge/forge-damage-evidence.js`

Regression materials:

- `forge/tests/smoke-phase2f1-field-audit.js`
- `forge/tests/smoke-phase2e1-field-sync.js`
- `forge/tests/smoke-phase2f-bridges-damage.js`

No geometry synchronizer is required for this hotfix because canonical geometry and bridge generation are unchanged from Phase 2f.

Hard-refresh after upload. The damage module include is stamped `?v=fde2`.

## Browser release gate

### Damage — first test

1. Start a **new attack** after deploying Phase 2f.1.
2. Hit with Vesperian’s one-handed longsword or Booming Blade.
3. The Table row must visibly contain both the formula and rolled arithmetic, including `+6`.
4. Hit with Cosmere’s Eldritch Blast. The row must show its formula and actual roll arithmetic rather than only `4 dmg`.
5. Refresh/cold-rejoin and confirm the same evidence survives replay for those newly recorded events.
6. If any new hit shows only a total, it must visibly say **Damage evidence missing** and emit a System warning. Do not pass the release gate in that state.

### Bridge diagnostics

1. Before starting combat, locate the **Vertical geometry** block in the left staff panel.
2. Confirm its status lists stairs, ramps, bridges, and open ledges.
3. Press **Show connectors** and verify the overlay appears.
4. When the status says no bridge exists, press **Find bridge seed**.
5. Confirm it either moves to a nearby deterministic bridge-bearing seed or reports that none was found within 48 seeds.
6. On a bridge-bearing map, verify bridge rendering, authored-path movement, rail/slab LoS, and snapshot reload as described in the Phase 2f bridge contract.

### Regression

Recheck party staging, claims, remote combat start, movement remainder after refresh, defeated-token cleanup, optional cover contest, and Table/System/All filtering.

## Validation in this changed-file working set

The following nine runnable suites pass: **289 checks green**.

```bash
node forge/tests/smoke-snapshot-authority.js
node forge/tests/smoke-map-contract-render-truth.js
node forge/tests/smoke-phase2b1-field-round.js
node forge/tests/smoke-phase2c-archetype-params.js
node forge/tests/smoke-phase2d-stage-ownership.js
node forge/tests/smoke-phase2e-elevations-connectors.js
node forge/tests/smoke-phase2e1-field-sync.js
node forge/tests/smoke-phase2f-bridges-damage.js
node forge/tests/smoke-phase2f1-field-audit.js
```

All three executable inline scripts in `topography-test-mock.html` parse. The full historical repository battery and a real two-device Supabase round remain required after integration.
