# Battle Forge Phase 2b.1 — field-round corrections

This patch is incremental on the Phase 2b Map Contract bundle. It responds to the July 14 browser/two-device field report without changing the settled Phase 1.5h geometry or the new Map Contract 2.0.

M remains the committer and pusher. Nothing in this bundle commits or deploys.

## What the field round found

### 1. Damage totals hid their evidence, and Vesperian's Booming Blade used stale damage math

The feed received only the final damage total, so a result such as `5 dmg` could not be audited. The current action pipeline also allowed the saved legacy `Booming Blade` row to coexist with the live derived `Booming Blade · Longsword` row. The saved row has the stable slot id used by the HUD, but its damage modifier is stale; the live derived row should own the attack and damage math.

The fix has four parts:

- `weapon-actions.js` projects the **Dueling** fighting style into eligible one-handed melee attacks and weapon cantrips (+2 damage). Ranged weapons, two-handed weapons, and a versatile weapon used in its two-handed mode do not receive it.
- `forge-kit-derive.js` semantically deduplicates the two weapon-cantrip labels. The live derived action owns the math while adopting the saved legacy id, so existing default HUD slots keep working.
- attack resolution publishes `dmgParts` alongside the total. Critical hits double damage dice, not flat modifiers.
- `forge-feed-render.js` shows the arithmetic by default rather than hiding it behind an undiscoverable tap.

Expected Vesperian example: the feed should expose the longsword die and a **+6** flat modifier (DEX +4 and Dueling +2), rather than merely showing the final total.

### 2. The authoring inspection slider was technically unlocked but unreachable

The local party-selection overlay covered the Forge controls. Entering the battlefield through **Enter the Forge** started combat and correctly locked the vertical scale, so there was no usable authoring state in which to test the slider.

Local mode now has **Inspect map**. It dismisses the party overlay without starting combat, leaves vertical inspection adjustable, and provides **Choose party / start fight** to return. Shared sessions remain tactical and locked at 100%.

### 3. Shared claiming exited after the first character

A successful claim no longer auto-hides the party screen. The player can claim several unclaimed characters and then press **Enter the fight**. The server RPC remains the authority for every claim.

### 4. Refresh repainted full movement and then subtracted the echoed move twice

The event log already retained the correct 10 ft remaining after a 20 ft move. On refresh, `beginTurn()` first painted the full budget and the HUD was not immediately repainted after replay reconciliation. A later echoed `walk` then subtracted its path from the already-reconciled budget a second time, producing `-10/30`.

The fix immediately repaints after `applyLogEconomy()` and never subtracts a session move locally when the shared log already owns that spend. Local sandbox movement retains its direct subtraction.

### 5. Cover Contest appeared for clear shots

The contest control now appears and can pause an attack only when canonical geometry currently reports finite half or three-quarters cover. It is absent for no cover and total cover. A stale armed toggle is cleared if movement removes the cover before confirmation.

A staff cover override is **not** included in this patch. It should be a shared, replayable, one-shot adjudication tied to the current attacker, target, turn, and attack—not a local right-click state or a persistent edit to the target's base AC. That design remains the next small rules specification.

## Apply

### Replace

- `forge/topography-test-mock.html`

### Add and run once from the repository root

- `forge/patch-phase2b1-field-round.js`

```bash
node forge/patch-phase2b1-field-round.js
```

The guarded patcher updates the current repository copies of:

- `weapon-actions.js`
- `forge/forge-kit-derive.js`
- `forge/forge-table-correctness.js`
- `forge/forge-feed-render.js`

It validates all four source shapes before writing any file, so a stale source cannot leave the repository half-patched. A second run is safe and reports the files unchanged.

### Add regression test

- `forge/tests/smoke-phase2b1-field-round.js`

## Focused validation

```bash
node forge/tests/smoke-phase2b1-field-round.js
node forge/tests/smoke-snapshot-authority.js
node forge/tests/smoke-map-contract-render-truth.js
```

Then run the complete repository Forge battery before committing.

## Browser/two-device checklist

1. In local mode, press **Inspect map** before choosing the party. Move Vertical inspection above and below 100%; confirm the terrain preview changes. Return with **Choose party / start fight**.
2. Start combat. Confirm the scale resets to `100% · tactical` and locks.
3. With Vesperian, use **Booming Blade · Longsword**. Confirm the damage row exposes die arithmetic and a +6 flat modifier. Repeat on a critical and confirm only dice double.
4. In a shared session, claim two or more characters without refreshing. Confirm the overlay remains until **Enter the fight** is pressed.
5. Move 20 ft of a 30 ft turn, attack, and refresh both devices. Both must immediately show 10/30 remaining. Move the final 10 ft and confirm 0/30, never a negative value.
6. Target a creature with no cover: no Cover Contest control. Target half/three-quarters cover: the control appears and the DM ruling path still works. Total cover remains untargetable.
7. Confirm party sheets, `topo:ready`, discovery fog, snapshot loading, and the 100% tactical scale remain intact.

## Validation completed in this handoff

- Phase 2b.1 field-round contract: **30 green**
- Snapshot authority: **24 green**
- Map Contract/render truth: **23 green**
- all three executable inline scripts in the production HTML parse
- runtime boot-order assertions for `DISCOVERY_RENDER` and `SESSION_ID` remain green
- patcher and focused smoke parse with Node

Not claimed here: the complete historical Forge battery, a live Supabase field round after the patch, or a real browser rendering automation.
