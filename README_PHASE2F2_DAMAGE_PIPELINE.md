# Battle Forge Phase 2f.2 — canonical damage pipeline

## Why Phase 2f.1 still failed

The field screenshots showed that the evidence layer was finally displaying what it received, but the **action itself was still wrong before the roll happened**:

- Vesperian entered combat as `1d8 + 4`; Dueling was absent.
- Cosmere entered combat as `1d10 + 0`; Agonizing Blast was absent.
- A critical event could still carry only one damage die in some paths.
- The Forge feed duplicated a scalar total, formula, arithmetic, and a technical checksum instead of using the existing Battle HUD convention.

The previous repair recognized generated IDs. The real browser can retain a saved legacy ID after live-action deduplication, so that test was not authoritative.

## Runtime replacements

Upload all four runtime files:

- `forge/topography-test-mock.html`
- `forge/forge-action-damage.js` **new**
- `forge/forge-feed-render.js`
- `forge/forge-damage-evidence.js`

No geometry patcher is required. Hard-refresh once after upload.

## What now owns damage

`forge-action-damage.js` repairs the **final action tiles used by combat**, then performs one canonical component roll.

It recognizes both live and legacy-shaped final actions through semantics and source metadata:

- Dueling: eligible one-handed melee weapon/weapon-cantrip damage becomes ability modifier + item bonus +2.
- Agonizing Blast: Eldritch Blast adds the character's CHA modifier.
- Two-handed weapon modes remain excluded from Dueling.
- Re-running the repair is idempotent.
- Critical hits double dice and add the flat modifier once.

The final event records:

- source dice;
- rolled dice after critical doubling;
- every individual result;
- flat modifier;
- damage type;
- component total;
- combined total.

`forge-feed-render.js` is now the canonical presentation path. It follows the existing site Battle HUD style directly:

```text
Dmg: [5] +6 = 11 Slashing
Crit dmg: [4][5] +6 = 15 Slashing
```

A small formula line remains beneath it (`1d8 + 6` or `2d8 + 6`). A single-component attack no longer repeats a separate scalar `15 dmg` header.

`forge-damage-evidence.js` is only the event-transport bridge. It preserves component data through the older table translator and warns on scalar-only new events.

## Grounded known-answer gates

The suite uses the current saved character shapes:

- Vesperian: DEX +4, PB +2, Dueling, saved `bb_vesperian`/`ls_1h` IDs.
- Cosmere: CHA +3, PB +2, Agonizing Blast, saved Eldritch Blast with hit +5 and damage modifier 0.

Expected results:

- Vesperian Booming Blade / one-handed Longsword: `1d8 + 6`.
- Vesperian critical: `2d8 + 6`, not `1d8 + 4` and not `2d8 + 12`.
- Cosmere Eldritch Blast: `1d10 + 3`.

## Browser release gate

Use attacks created **after** this upload.

1. Vesperian one-handed Longsword or Booming Blade must visibly show `+6`.
2. A normal hit must show the actual die, for example `Dmg: [5] +6 = 11 Slashing`.
3. A critical must show two die results and one modifier, for example `Crit dmg: [4][5] +6 = 15 Slashing`.
4. Cosmere Eldritch Blast must show its actual d10 and `+3` Agonizing Blast modifier.
5. Refresh and confirm the exact same die results remain in the feed.
6. Table/System/All filtering must remain intact.
7. Do not pass the release if a new hit displays only a scalar total or says that the dice record is missing.

## Validation

328 runnable checks green across the accumulated working-set suites. Runtime modules and the production inline scripts parse. A real browser attack remains the final release gate.

## Scope

No bridge, geometry, snapshot, terrain-generation, or multiplayer authority rules changed in this correction.
