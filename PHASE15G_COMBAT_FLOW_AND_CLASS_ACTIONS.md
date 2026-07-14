# Battle Forge Phase 1.5g — combat flow and class actions

## Purpose

Phase 1.5g closes the known combat-flow and character-action defects before active Phase 2 map generation adds more complicated terrain, connectors, and positioning.

## Shared combat-rules seam

`forge-combat-rules.js` is a pure browser/Node module. It owns:

- non-stacking advantage/disadvantage source reduction;
- flanking geometry and rule variants;
- Prone attack and movement consequences;
- Monk action composition;
- Toll the Dead's wounded-target die;
- fail-closed damage validation;
- feed-channel classification;
- replay adjustment for nonstandard movement costs.

The visual surface consumes these decisions. It does not maintain a competing copy of the rules.

## Advantage and disadvantage

Every rule contributes a named source. The reducer produces exactly one of three outcomes:

- one or more advantage sources, no disadvantage: advantage;
- one or more disadvantage sources, no advantage: disadvantage;
- at least one of each: normal roll.

Additional sources never stack into extra dice and never overpower cancellation. The feed may list all reasons even when the final roll is normal.

## Flanking

The existing opposite-cell table geometry is retained. A creature must threaten the target in melee, and the opposite ally must also threaten it. Downed or incapacitated creatures cannot establish a flank.

The shared encounter rule is:

- `advantage` — default;
- `plus2`;
- `plus5`;
- `off`.

The selected mode is saved in the encounter envelope and later edits are ordinary shared facts. The +2/+5 variants are numerical attack modifiers and do not enter the advantage/disadvantage pool.

## Prone

Prone is the first fully enforced general condition:

- a prone creature's attacks have disadvantage;
- attacks against it from within 5 feet have advantage;
- attacks against it from farther than 5 feet have disadvantage;
- crawling costs two feet of movement per foot traveled;
- standing spends half the creature's speed;
- staff can apply or clear it from Forge Edit;
- it is represented through the existing persistent effect ledger and reconstructs through replay.

Other condition names may exist in inherited UI/data, but this bite does not claim complete mechanical enforcement for every condition.

## Monk composition

Caim's class actions now compose the canonical Unarmed Strike rather than carrying incomplete independent math:

- **Martial Arts:** one bonus-action Unarmed Strike after taking Attack.
- **Flurry of Blows:** two sequential Unarmed Strikes, one Ki, one bonus action, requires Attack first.
- **Step of the Wind:** one Ki and one bonus action; choose Dash or Disengage.
- **Patient Defense:** one Ki and one bonus action; applies Dodge for the turn.
- **Hand of Healing:** retains valid sheet healing math and spends canonical Ki.

`Hand of Harm` is explicitly held as a post-hit rider until its post-hit prompt is implemented. It is not allowed to degrade into a zero-damage direct attack.

Any damaging action with no valid damage expression now refuses loudly. Missing action data can no longer silently deal zero damage.

## Toll the Dead

The damage expression is selected at resolution from the target's current combat HP:

- target at maximum HP: d8;
- target below maximum HP: d12.

The number of dice already present in the cantrip's expression is preserved, so later scaling becomes `2d8`/`2d12`, etc.

## Direct-attack flow

A direct attack now has an explicit commitment stage:

1. arm the attack;
2. click a token or initiative chip to select the target;
3. inspect current-cell legality and the firing-position preview;
4. optionally arm Cover Contest;
5. press **Confirm attack** to roll.

Target selection never rolls by itself. This becomes the stable pre-resolution door for cover rulings, Sanctuary, reactions, and later area-template workflows.

## Player movement undo

A player may retract their own most recent move only while it remains the latest consequential fact. The compensating move restores the pre-move cell and movement budget.

Once an attack, opportunity attack, prompt, or any other consequence follows, player undo is blocked and the DM must use authoritative rewind. Staff using Player View experience the same player rule; Staff View retains full rewind authority.

## Feed channels

- **Table:** chat, attacks, saves, damage, healing, effects, rulings, and concise refusals.
- **System:** geometry, discovery, transport/reconnect, protocol, and synchronization diagnostics.
- **All:** both streams.

Rows that predate installation of the channel decorator are inferred and classified. Explicit channel metadata always wins for new rows.
