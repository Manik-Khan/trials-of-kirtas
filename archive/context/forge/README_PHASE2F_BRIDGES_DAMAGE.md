# Battle Forge Phase 2f — Structural bridges + damage evidence

## Apply

Replace/add these repository files:

- `forge/forge-generator-foundation.js`
- `forge/forge-engine.js`
- `forge/tactics-geometry.js`
- `forge/forge-damage-evidence.js` **NEW**
- `forge/topography-test-mock.html`
- `forge/patch-phase2f-geometry-sync.js` **NEW**
- `forge/tests/smoke-phase2f-bridges-damage.js` **NEW**
- `forge/tests/fixtures/tactics-geometry-phase2e.js` **NEW test fixture**
- `forge/FORGE_STRUCTURAL_BRIDGES_1.md` **NEW**

Then, from the repository root:

```bash
node forge/patch-phase2f-geometry-sync.js
```

The patcher updates the inlined geometry in `battle-tactics-geo-mock.html`. It accepts only the known Phase 1.5h or Phase 2e copies and aborts before writing if it finds an unknown edit.

Hard-refresh once after deployment. `forge-generator-foundation.js`, `forge-engine.js`, `weapon-actions.js`, and the new evidence module are cache-busted in the production HTML.

## Release blocker: damage evidence

This slice does not treat the damage total as sufficient.

Every newly resolved damaging attack now publishes:

```js
{
  dmg: 9,
  dmgFormula: "1d8+6 Slashing",
  dmgParts: [
    { dice: "1d8", rolls: [3], bonus: 6, type: "Slashing", total: 9 }
  ]
}
```

The Table feed permanently displays both source and result:

```text
1d8 + 6 Slashing
[3] +6 = 9 Slashing
```

The fix is enforced in three places:

1. the roller emits component evidence;
2. resolved local/shared facts retain it;
3. `forge-damage-evidence.js` decorates the feed even when an older external feed module shows only the total.

The prior field patch also targeted the wrong property for a bound Booming Blade action. Weapon cantrips are weapon-shaped `type:"attack"` rows, so Dueling belongs in `dmgBonus`, the same property used by the bound longsword. Spell-attack cantrips use `dmgMod` and do not receive Dueling.

A known-answer regression freezes Vesperian's one-handed longsword/Booming Blade as:

```text
1d8 + 6 Slashing
```

with critical damage doubling the die while applying `+6` once.

Old protocol rows that contain only `dmg` cannot be reverse-engineered into lost die rolls. New rows and refreshed/replayed Phase 2f rows retain the evidence.

## Structural bridges

Phase 2f adds deterministic multi-cell bridges across one-to-four-cell generated pool spans. Each bridge owns:

- every deck cell in `path[]`;
- deck elevation and half-foot slab thickness;
- 5-ft width;
- 2.5-ft rails;
- optical under-clearance;
- open/closed/broken state;
- snapshot and height-stage fingerprints.

Movement follows the authored path. Side entry into a middle span is refused. The slab and rails are real LoS/cover geometry; empty clearance beneath the slab remains sight-open.

Current limitation: the 2.5D occupancy model cannot seat another creature under the same bridge cell. Sight beneath the bridge is modeled; under-bridge movement is deferred.

## Browser checklist

### Damage — do not pass the release without this

1. Use Vesperian's one-handed longsword or Booming Blade.
2. Confirm the action derives **+6 damage** from DEX +4 and Dueling +2.
3. On a hit, confirm the Table feed visibly shows both:
   - `1d8 + 6 Slashing`
   - `[actual roll] +6 = total Slashing`
4. Confirm the evidence is visible without tapping or expanding the row.
5. Confirm a critical hit shows two d8 rolls and only one `+6`.
6. Repeat once in a shared session and once after refresh/cold replay.
7. Confirm System diagnostics do not replace or duplicate the Table damage row.

### Bridge generation and rendering

1. Generate several maps containing pool spans; not every seed is required to have a valid bridge.
2. Use **Forge → Height → Show connectors** and confirm bridge paths are blue.
3. Confirm the deck, rails, token elevation, and sight lines remain on the truthful 100% tactical scale.
4. Walk along the full bridge path.
5. Confirm an interior bridge square cannot be entered from the side or diagonally.
6. Confirm a broken/closed bridge has no walk surface if state is changed in diagnostics.
7. Check a ray through the slab/rail and a shallow ray below the deck clearance.
8. Save/open the table and confirm the same bridge path and dimensions survive snapshot load.

### Regression

1. Party cards and **Enter the Forge** load.
2. A waiting player receives the DM's start without refresh.
3. Claimed characters remain claimed through cold catch-up.
4. Movement remainder survives refresh without double subtraction.
5. Defeated units are removed after refresh/resync.
6. Cover Contest appears only for half or three-quarters cover and pauses only when explicitly armed.
7. Table/System/All remain genuinely filtered.

## Validation in this working set

Run:

```bash
node forge/tests/smoke-snapshot-authority.js
node forge/tests/smoke-map-contract-render-truth.js
node forge/tests/smoke-phase2b1-field-round.js
node forge/tests/smoke-phase2c-archetype-params.js
node forge/tests/smoke-phase2d-stage-ownership.js
node forge/tests/smoke-phase2e-elevations-connectors.js
node forge/tests/smoke-phase2e1-field-sync.js
node forge/tests/smoke-phase2f-bridges-damage.js
```

Also run the complete repository Forge battery after integration. The reduced working set does not include every historical runtime dependency.
