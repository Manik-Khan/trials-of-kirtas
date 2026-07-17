# CONTEXT_Forge update · 2026-07-13g

Supersedes `CONTEXT_Forge-update-2026-07-13f.md` as the current concise handoff. Earlier records remain authoritative for the features they shipped.

## Phase 1.5g — combat flow and character correctness

### Feed channels

The Forge Game Feed now offers **Table / System / All**. Table is the default player-facing combat stream. Geometry, occluder, discovery, reconnect, protocol, and synchronization diagnostics route to System. Existing rows are retroactively classified; explicit channel metadata wins on new rows.

### Shared roll-modifier spine

New pure module: `forge/forge-combat-rules.js`.

Advantage and disadvantage are collected as named sources, never stacked. One or more of each cancel to a normal roll. The feed can still list every source. Flanking and Prone use this same reducer.

### Flanking

The existing opposite-cell flanking geometry is ported into the production Forge. Downed/incapacitated creatures do not threaten or supply a flank.

Shared rule modes under Forge → Rules/Edit:

- Advantage — default
- +2
- +5
- Off

The rule is written into new encounter envelopes and later changes publish as shared edit facts. Flat bonuses do not enter the advantage pool.

### Prone

Prone is the first fully enforced condition:

- prone attacker: disadvantage;
- attack against prone within 5 ft: advantage;
- farther attack: disadvantage;
- crawl costs double movement;
- Stand spends half speed;
- staff apply/clear through Forge Edit;
- state reconstructs through the persistent effect ledger and replay;
- initiative shows a visible Prone marker.

### Caim / Monk

Caim's malformed class features now compose the canonical Unarmed Strike:

- Martial Arts: one bonus Unarmed Strike after Attack;
- Flurry of Blows: two Unarmed Strikes, one Ki, one bonus action, Attack prerequisite;
- Step of the Wind: one-Ki bonus action with Dash/Disengage choice;
- Patient Defense: one-Ki bonus action applying Dodge;
- Hand of Healing retains valid healing math and canonical Ki cost.

Hand of Harm is explicitly held as a future post-hit rider. It cannot appear as a zero-damage standalone attack. All malformed damaging actions now fail closed and narrate the refusal.

### Toll the Dead

Toll the Dead reads the target's current combat HP immediately before damage: d8 at full HP, d12 below max HP, preserving cantrip dice scaling.

### Direct-attack flow

Token and initiative clicks now select a direct-attack target without rolling. The firing preview paints, then **Confirm attack** commits. Cover Contest remains available in the pre-roll stage. This is the stable door for later AoE/template work.

### Player Undo move

A player can undo their own latest move while it is still the newest consequence. Position and movement budget restore through an ordinary compensating fact. Once an OA, attack, prompt, or later fact occurs, player undo is blocked and DM rewind is required. Staff in Player View use the player rule; Staff View retains authoritative rewind.

## Validation

338 checks across ten cumulative suites are green. Runtime modules and the three executable inline scripts parse. Automated WebGL and live two-device testing remain field requirements.

## Next order

1. Browser/two-device field pass for Phase 1.5g.
2. Repair any field regressions before terrain generation.
3. Begin active Phase 2 generator terrain:
   - archetype parameters and selector;
   - stage-seed ownership;
   - constrained elevations;
   - first-class connectors;
   - semantic spawns and objectives;
   - validation/local repair;
   - graph/height/cover/spawn/connector overlays.
4. Later combat extensions: Hand of Harm post-hit rider; broader condition enforcement; AoE templates and affected-cell preview.

## Deploy rule

M uploads, commits, and pushes through GitHub. Return files with repository paths intact; do not push.
