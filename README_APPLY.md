# Battle Forge — Phase 1.5d table-correctness build

This bundle is based on the exact `topography-test-mock.html` uploaded after the successful 3D/top-down and token-rig field test. Everything else was treated as current `main`.

## What this bite fixes

### Local Staff View / Player View

The **Forge** button now opens a compact menu:

- **Forge controls** — show or hide the authoring chrome.
- **Presentation: Staff View / Player View** — available only to staff/DM/overseer accounts.

This is a local presentation mask only. It does not change the signed-in role, claimed characters, protocol permissions, or session authority.

- Real players are always in Player View and cannot escape it.
- In Player View, an active enemy has no BG3 action/stat HUD.
- Enemy HP is omitted from the initiative strip.
- Hidden foes are omitted through the existing `foeVisible()` seam.
- The overseer toolbar is absent in Player View.
- Staff View retains complete DM tools and enemy internals.

### Automatic bestiary token art

- Generic test goblins now carry the canonical `Goblin` / `MM` bestiary identity.
- Picked and saved monsters preserve name/source identity through roster → session → combat unit.
- Top-down tokens first request art through a fixed-path same-origin Netlify function, then retry the direct 5e.tools image, then fall back to initials.
- Existing per-combatant and creature/character-default custom art still outranks automatic art.

### Reinforcement picker

- The add-foe browser now owns the viewport above the combat HUD.
- Search results and shelf sections scroll independently.
- Picked foes and the footer remain reachable.
- The HUD beneath is dimmed and does not intercept input while the modal is open.

### Ki resource bridge

`classFeatures.kiPoints` remains the raw sheet/storage key, but the Forge kit now exposes the canonical combat resource `ki`. Caim's action costs therefore read and spend the same full pool shown by the sheet.

### Leveled spell-slot chooser

Every leveled spell asks which eligible slot to spend when more than one slot level is available, including spells with no upcast benefit. Non-scaling spells explicitly say:

> No additional effect at higher levels.

This fixes Sanctuary silently choosing a 2nd-level slot. **Sanctuary's persistent ward and Wisdom-save attack interception are not part of this bite; they are Phase 1.5e.**

### Cover Contest restored

The existing pre-roll adjudication system is restored to the BG3 HUD as **Contest next shot**:

1. arm the toggle;
2. choose the target;
3. the attack pauses before rolling;
4. the DM rules no / half / three-quarters / total cover;
5. after 20 seconds without a ruling, the grid verdict stands.

### Structured Forge feed

Resolved attacks and abilities now paint through `ForgeFeedRender` with:

- attacker, target, action, d20 math, advantage/disadvantage, cover word, verdict and damage;
- no enemy AC;
- soft green hit, soft red miss, muted gold critical, blue-grey save and teal healing row treatments;
- authoritative echoed session facts, so every device sees the same result without predictive duplicates;
- local-sandbox attacks, saves and healing using the same presentation.

## Upload through GitHub's browser

Upload these repository files with their folder paths intact:

### Replacements

- `forge/topography-test-mock.html`
- `forge/forge-unit-art.js`

### New runtime files

- `forge/forge-table-correctness.js`
- `netlify/functions/forge-token-art.js`

### New regression tests

- `forge/tests/smoke-phase15d-contract.js`
- `forge/tests/smoke-table-correctness.js`
- `forge/tests/smoke-token-proxy.js`
- `forge/tests/smoke-unit-art-automatic.js`

The documentation files and `SHA256SUMS.txt` are helper artifacts and do not need to be deployed.

## Browser field checks

1. Start a session as overseer/staff and open **Forge → Presentation**.
2. Switch to Player View while Vesperian is active:
   - PC HUD remains;
   - enemy HP is absent from the initiative strip;
   - overseer toolbar is absent.
3. Advance to a goblin turn:
   - the active enemy BG3 bar is completely absent in Player View;
   - switch back to Staff View and confirm the complete enemy HUD returns.
4. Enter top-down view and confirm generic, saved, and newly picked goblins load token art rather than `G`.
5. Open **Add foe**, scroll to the bottom, pick a monster, and complete the modal without the HUD covering its footer.
6. On Caim's turn, spend a Ki action and confirm a full pool can be used and decrements correctly.
7. Cast Sanctuary while level-1 and level-2 slots are available; select either level and confirm the chosen pool is spent.
8. Arm **Contest next shot**, target a covered creature, and confirm the DM ruling appears before the roll.
9. Make a hit, miss, critical, save and healing action; confirm the right-side feed includes full math and damage with subtle verdict tinting and no AC.
10. Refresh both staff and player devices once mid-turn and confirm viewer masking and action economy remain stable.

## Deliberate next boundaries

- **Phase 1.5e:** replayable effect ledger, Sanctuary ward, visible effects, Wisdom-save attack interception, duration and break conditions.
- **Phase 1.5f:** party-shared world-space fog and the direct-attack firing-position preview (green / yellow / orange / dark-hatched).
- **Phase 2 terrain:** active archetypes, elevations, connectors, semantic spawns/objectives, validation and repair.

No commit or push is performed by this bundle.
