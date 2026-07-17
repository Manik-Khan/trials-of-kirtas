# CONTEXT Forge update · 2026-07-14f

Supersedes `CONTEXT_Forge-update-2026-07-14e.1.md` as the current concise Forge handoff. Phase 2f follows the Phase 2e.1 multiplayer stabilization pass.

## Damage evidence is now a release gate

M reported three consecutive field rounds in which damage displayed only a final number. Phase 2f traces and freezes the complete route:

`derived action → damage roller → resolved payload → protocol replay → Table feed`

New attacks carry `dmgParts[]` and `dmgFormula`. The feed permanently shows the source formula and rolled arithmetic rather than requiring a hidden expansion. A separate `forge-damage-evidence.js` module decorates rows even when the deployed legacy feed renderer paints only the total.

The previous runtime repair also targeted the wrong property for Booming Blade. The sheet projects bound weapon cantrips as weapon-shaped `type:"attack"` actions; ForgeKitDerive therefore reads their weapon/style modifier from `dmgBonus`, not the spell-attack `dmgMod` branch. Dueling now adds +2 to eligible one-handed weapons and their bound Booming Blade/Green-Flame Blade actions, while two-handed and ranged modes remain excluded.

Known-answer release case:

```text
Vesperian one-handed longsword / Booming Blade
1d8 + 6 Slashing
[roll] +6 = total Slashing
```

Critical hits double the dice and never the flat +6. Historical events that never stored component rolls cannot reconstruct them; all new Phase 2f events and replayed rows preserve them.

## Phase 2f — multi-cell structural bridges

The height stage now emits deterministic first-class bridges across valid generated pool spans:

- one to four blocked pool cells between open land endpoints;
- full cardinal `path[]` with an elevation for every deck cell;
- 5-ft width, 0.5-ft deck, 2.5-ft rails, and measured clearance;
- movement only along consecutive path segments;
- no side/diagonal entry into the middle span;
- open/closed/broken authority;
- deck slab and rail LoS/cover footprints;
- sight-open clearance beneath the actual slab;
- truthful renderer meshes and blue Height-overlay paths;
- exact snapshot preservation and inclusion in the height fingerprint.

The current occupancy model remains 2.5D: it can trace sight under a bridge, but it cannot hold a second creature beneath another creature at the same `(c,r)`. The record says `supportsUnderpass:false`; under-bridge movement is deferred.

Generator version: `2.0.0-bridges.1`. Parameter version remains 2. No database migration is required.

## Geometry deployment

Canonical `forge/tactics-geometry.js` and the production inline copy are byte-identical. Run:

```bash
node forge/patch-phase2f-geometry-sync.js
```

The guarded patcher upgrades the reference battle mock from known Phase 1.5h or Phase 2e geometry and refuses unknown edited copies.

## Validation

Eight runnable working-set suites are green, including a deterministic bridge battery and an extracted Vesperian +6 known-answer damage roll. Runtime modules, patcher, tests, and all three executable production inline scripts parse. Run the complete repository battery and a real two-device field round after integration.

## Browser release gates

1. Party/staging still boots.
2. Vesperian displays `1d8 + 6` and `[roll] +6 = total` visibly on local, shared, and replayed hits.
3. Critical damage doubles dice only.
4. Table/System/All remain separated.
5. Cover Contest remains optional and cover-gated.
6. Generated bridge path, rails, movement, LoS, overlay, and snapshot reload agree.
7. Refresh/resync retains feed, claims, movement remainder, and defeated visuals.

## Next order

After Phase 2f passes the browser/two-device gate:

1. first-class doors and their open/closed sight/movement edges;
2. tunnels and explicit under/over transitions;
3. fords and water traversal;
4. semantic objectives and spawn influence;
5. validation/local repair and expanded overlays.

M uploads, commits, and pushes. Return repository-structured files and guarded patchers; do not push unless explicitly instructed.
