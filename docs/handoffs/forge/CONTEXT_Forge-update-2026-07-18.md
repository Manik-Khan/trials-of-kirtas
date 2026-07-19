# CONTEXT Forge update · 2026-07-18

Supersedes `CONTEXT_Forge-update-2026-07-16c.md` as the current concise Forge authority. Read with `CONTEXT.md`, `CONTEXT_Forge.md`, and `forge/FORGE_TEMPLE_TERRACES_1.md`.

## Current field verdict

Temple Terraces is implemented as the first intent-owned Forge archetype and is deliberately labeled **preview**.

Implemented in this slice:

- generator `2.1.0-temple.1` and profile `intentional-archetype`;
- deterministic axial, switchback, and ring Temple variants;
- broad approach/lower/upper/summit regions at 0/5/10/15 feet;
- required primary ascent and optional nonduplicate secondary route;
- multi-point stairs cut through declared retaining-wall gaps;
- exact connector-purpose, region, route, construction-profile, and stage-fingerprint records;
- Temple/Druidic/Tundra/Volcanic/Cavern/Grass/Swamp construction materials;
- real engine, renderer, Vertical Geometry diagnostics, snapshot, and cache-stamped production integration;
- no Temple bridges and no automatic combatant placement;
- one narrated preview gate for local combat, Roll Initiative, and Save for later;
- staged legacy generation no longer samples decorative 5-ft connectors or selects structural bridges;
- bridge identity/movement/cover/state/replay/audit and explicit selection remain intact for a future bridge-owned archetype.

The approved browser mock preceded implementation. At M's direction, no additional web preview was opened for this non-mock implementation pass. The field checklist below remains required before promotion.

## Exact preview boundary

Temple returns `spawns: []`. `window.__forgeDeploymentReady` is intentionally absent/false in this slice, so `templeDeploymentPending()` refuses all encounter-promotion doors while leaving the Workshop terrain and controls visible.

DM deployment flags are **not implemented here**. Do not replace the gate with highest-tier, lowest-tier, visibility-band, or random placement. The next slice must support any number of Party, Ally/NPC, and Enemy groups, each positioned by a DM flag and deterministically formed around that flag.

Old records remain safe:

- explicit historical generator profiles are retained;
- version-1 snapshot-less recipes keep monolithic legacy regeneration;
- exact map snapshots remain authoritative;
- Temple intent, construction profile, and connector purpose round-trip through snapshots.

## Validation

Focused results:

- Temple Terraces: **35/35**;
- parameter/archetype record: **46/46**;
- stage ownership: **36/36**;
- elevations/connectors: **40/40**;
- structural bridge completion: **37/37**;
- bridge/damage: **40/40**;
- snapshot authority: **27/27**;
- unified Forge panel: **16/16**;
- map bridge: **16/16**;
- tactics geometry: **26/26**;
- line of sight/cover: **50/50**;
- placement: **19/19**.

An additional matrix validated **2,520** pure Temple scenes across 120 roots,
all seven construction themes, and 40/44/52-cell map sizes.

The Forge engine remains at its inherited **13/14** result with only `flat mode is level ground` red. Flora remains the inherited extracted-harness failure `Forge stage-owned engine did not load`.

The July 16 handoff recorded 47 passing suites, 7 inherited failures, and 1 timeout. A fresh measurement of the actual base revision on 2026-07-18 produced **49 pass / 8 fail / 0 timeout / 57 total**. The additional inherited red is `smoke-phase2b1-field-round.js`; the prior placement timeout completed green in this environment.

The Temple candidate produces **50 pass / 8 fail / 0 timeout / 58 total**. Its red suite names are identical to the freshly measured base:

- `smoke-cover-contest.js`;
- `smoke-flora.js`;
- `smoke-forge-engine.js`;
- `smoke-phase2b1-field-round.js`;
- `smoke-pick-unit.js`;
- `smoke-tiers-rebase.js`;
- `smoke-token-rig-contract.js`;
- `smoke-unit-art.js`.

No new whole-battery failure remains.

## Required field checklist

1. Select Temple Terraces and confirm `preview` plus the deployment note.
2. Inspect known axial, switchback, and ring seeds.
3. Confirm broad platforms, continuous stair runs, and usable landings.
4. Match each stair's purpose diagnostic to the visible regions.
5. Compare Temple, Druidic, Tundra, and Volcanic construction.
6. Confirm Temple and generic legacy maps produce no bridge.
7. Confirm legacy maps no longer receive decorative 5-ft stairs/ramps.
8. Attempt local combat, Roll Initiative, and Save for later; confirm each narrates the deployment dependency.
9. Save/reload a legacy encounter and confirm historical behavior is unchanged.

## Immediate execution order

1. Field-test Temple scene variants and purposeful stair rendering.
2. Implement DM deployment groups and flags.
3. Integrate exact deployment into save/session start.
4. Promote Temple from `preview` to `active` only after those checks pass.
5. Build `bridge-crossing` on the same intent contract.

Do not begin `bridge-crossing` by re-enabling random legacy bridge selection. Purpose and archetype ownership come first.

## Deployment discipline

M reviews, commits, and pushes. Codex does not push. Cache-stamped runtime files in this slice are `forge-generator-foundation.js?v=g2g1`, `forge-temple-terraces.js?v=tt1`, and `forge-engine.js?v=fe9`.
