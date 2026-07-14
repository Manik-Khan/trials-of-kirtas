# Battle Forge Phase 1.5g — apply and field-check

This bundle is based on the exact Phase 1.5f production `forge/topography-test-mock.html` supplied by M on July 13, 2026. The remaining Forge modules are expected to be the current copies on `main`.

No database migration, commit, or push is included.

## Upload through GitHub

Replace:

- `forge/topography-test-mock.html`
- `forge/forge-table-correctness.js`

Add:

- `forge/forge-combat-rules.js`

The HTML already loads the new module as:

```html
<script src="forge-combat-rules.js?v=fcr1"></script>
<script src="forge-table-correctness.js?v=fg1"></script>
```

The files under `forge/tests/` are validation artifacts. Uploading them is recommended but is not required for the browser runtime.

## Quick browser field pass

### Feed

1. Open **Table**, **System**, and **All** in the Game Feed.
2. Confirm attacks, damage, healing, spell effects, and chat stay in **Table**.
3. Confirm geometry/occluder, discovery, transport, and resync diagnostics move to **System**.
4. Confirm older rows already present when the HUD initializes are classified too.

### Caim

1. Spend Ki on **Step of the Wind** and choose both Dash and Disengage in separate turns.
2. Confirm it spends the **bonus action**, not the action.
3. Attack first, then use **Flurry of Blows**.
4. Confirm two separate attack rolls, Caim's normal Unarmed Strike bonus, non-zero damage, one Ki spent, and one bonus action spent.
5. Confirm **Martial Arts** uses one canonical Unarmed Strike after Attack.
6. Confirm **Patient Defense** applies Dodge and attacks against Caim receive disadvantage.
7. Confirm malformed damaging actions visibly refuse rather than resolving for zero damage.

`Hand of Harm` is deliberately shown as an unavailable post-hit rider in this bite. It is not misrepresented as a standalone attack; its post-hit target/rider prompt remains a later class-action extension.

### Toll the Dead

1. Target a creature at full HP: use the d8 damage die.
2. Damage it first, then cast again: use the d12 damage die.
3. Confirm the current authoritative HP is used immediately before resolution.

### Targeting and preview

1. Arm a direct attack.
2. Click a visible token or its initiative chip.
3. Confirm the click selects the target and paints the preview without rolling.
4. Use **Confirm attack** to commit the roll.
5. Confirm **Contest next shot** remains available before commitment.

### Undo movement

1. Move a player-controlled active unit and confirm **Undo move** appears.
2. Undo immediately and confirm position and movement budget restore on every device.
3. Move again, then create another consequence such as an attack or opportunity attack.
4. Confirm player undo is no longer offered and the DM must use full rewind.
5. As staff, enter Player View and confirm the same player-side rule; Staff View retains DM rewind.

### Flanking

Under **Forge → Rules / Edit**, cycle:

- Advantage — default
- +2
- +5
- Off

Confirm the selection is shared through the encounter log, applies symmetrically to PCs and foes, and updates after movement/downing. Multiple advantage sources do not stack; any advantage plus any disadvantage becomes a normal roll. Downed or incapacitated creatures do not provide a flank.

### Prone

1. Select a unit and use **Forge → Apply Prone**.
2. Confirm the condition appears in the initiative strip and survives refresh/reconnect.
3. Confirm the prone creature's attacks have disadvantage.
4. Confirm attacks from within 5 feet gain advantage against it, while attacks from farther away have disadvantage.
5. Confirm crawling costs double movement.
6. Confirm **Stand up** appears and spends half the creature's speed.
7. Confirm clearing/standing removes Prone on every device.

## Headless checks

From the repository root:

```bash
node forge/tests/smoke-forge-combat-rules.js
node forge/tests/smoke-phase15g-contract.js
node forge/tests/smoke-table-correctness.js
```

The retained Phase 1.5d/e/f tests are also included for cumulative checking.
