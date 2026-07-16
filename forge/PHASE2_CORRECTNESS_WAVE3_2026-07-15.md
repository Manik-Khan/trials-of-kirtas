# Forge correctness wave 3 + structural bridges 2f.3 · 2026-07-15

Baseline: the uploaded current `main`, with correctness waves 1 and 2 applied.

This slice closes the field defects found after wave 2 and then resumes the active Phase 2 bridge track. It does not promote the mock route to `/forge`, create the Planned tab, or begin doors/tunnels/fords.

## Field findings addressed

### Downed creatures remain present

A creature at 0 HP no longer disappears from Player View merely because the 3D sprite path removed its ordinary token.

- The ordinary body remains in both 3D and top-down views.
- The body is dimmed and desaturated rather than hidden.
- A universal recovery shard appears above the creature as a readable temporary downed marker.
- PC and foe markers use distinct team tones.
- Reduced-motion mode keeps the shard static.
- Healing/revival removes the marker and restores the ordinary presentation.
- True despawn continues through a separate force-removal path.

This avoids requiring bespoke unconscious art for every sprite or monster while keeping the square, identity, and need for healing legible.

### Canonical side authority

Replay units now normalize `side` from either `side` or the older `kind` field. `monster`, `enemy`, `foe`, `hostile`, and `npc-hostile` normalize to the hostile side; unknown/PC aliases normalize to the party side.

This closes the shared cause of two field failures: opportunity attacks and Silvery Barbs could treat hostile units as allies when a session roster supplied `kind:"foe"` but no `side:"foe"`.

### Silvery Barbs restored on Líadan

Líadan's live character record now includes Silvery Barbs as a first-level reaction spell. Forge derives its 60-ft/12-square range and first-level slot cost from the same character record used to construct the live kit.

### Opportunity attacks use the ordinary attack pipeline

An accepted multiplayer opportunity attack now:

1. publishes `reaction_declared`, spending the reaction authoritatively before resolution;
2. checks Sanctuary before the attack;
3. opens a real nested attack through the ordinary shared attack pipeline;
4. allows the existing Silvery Barbs, Shield, and Hellish Rebuke prompts to resolve in their normal priority;
5. publishes the final attack/damage/concentration evidence;
6. resumes and resolves the suspended movement prompt;
7. truncates movement only when the mover is dropped or another rule explicitly stops it.

Prompts are now replayed as a stack. A nested attack-reaction answer removes only its matching prompt and restores the suspended outer OA/movement prompt. Refresh and reconnect can therefore reconstruct a reaction chain at any depth rather than losing the action behind the most recent modal.

### Wall-aware discovery

Party discovery now uses strict eye-to-eye line visibility for perception instead of attack-style leaning/peeking. A sufficiently high wall casts a real discovery shadow. The blocking wall face itself remains visible, while a truthful doorway or open angle reveals the cells beyond it.

This retains wave 2's soft-reality presentation—detailed near vision, subdued distant sight, explored memory, and absent unexplored topology—without allowing sight to pass through tall walls.

## Structural bridges 2f.3

Bridge work remains active Phase 2 and now advances beyond static generation.

### Replayable live state

Every structural bridge can be **Open**, **Closed**, or **Broken**.

- The map snapshot remains the immutable authored baseline.
- The overseer publishes `edit.connector_state` as a live encounter fact.
- Replay stores the latest override per connector.
- Refresh, reconnect, rewind, and correction reconstruct the same state.
- State edits are refused while an action/animation is unsettled.
- Closing or breaking a bridge is refused while any combatant occupies its path.

### Truthful rendering and movement

- **Open:** physical deck, rails, and supports render; movement and rail cover are active.
- **Closed:** no deck or rail authority remains; an amber depth-free route marker communicates the state to staff.
- **Broken:** no deck or rail authority remains; a red broken-route marker communicates the state to staff.
- The Height overlay distinguishes open/closed/broken paths in blue/amber/red.
- Movement checks consume the same state used by rendering; a closed or broken bridge cannot leave an invisible walk surface.

Animated drawbridge transitions and destructible hit points remain deferred. The state change is currently immediate and replayable.

## Validation

### Focused and relevant suites

- wave 3 correctness: **31/31**
- wave 2 correctness: **31/31**
- replay: **35/35**
- protocol: **56/56**
- discovery: **45/45**
- structural bridges/damage: **40/40**
- Phase 2f.1 field audit: **21/21**
- Phase 2f.2 damage pipeline: **39/39**
- effects: **39/39**
- combat rules: **61/61**
- kit derivation: **341/341**
- feed renderer: **66/66**
- table correctness: **29/29**
- Phase 1.5f contract: **49/49**
- Phase 1.5h contract: **28/28**

Modified JavaScript and JSON parse successfully, the canonical and inline geometry copies remain byte-identical, and `git diff --check` is clean.

### Whole Forge smoke battery

Wave-two baseline:

- **50** suites total
- **41** pass
- **8** inherited failures
- **1** inherited timeout

Wave three:

- **51** suites total, including the new wave-three suite
- **42** pass
- **8** inherited failures
- **1** inherited timeout

No common suite changed from pass to fail. The unchanged inherited reds are:

- `forge/smoke-glow-color.mjs`
- `forge/tests/smoke-cover-contest.js`
- `forge/tests/smoke-flora.js`
- `forge/tests/smoke-forge-engine.js`
- `forge/tests/smoke-pick-unit.js`
- `forge/tests/smoke-tiers-rebase.js`
- `forge/tests/smoke-token-rig-contract.js`
- `forge/tests/smoke-unit-art.js`

The unchanged timeout is `forge/tests/smoke-placement.js`.

## Browser/two-device checklist

1. Reduce Líadan to 0 HP while one browser uses Staff/top-down and the other Player/3D. Confirm her dimmed body and recovery shard remain visible in both.
2. Heal Líadan. Confirm the shard disappears and the ordinary presentation returns on both devices and after refresh.
3. Provoke a foe OA against a PC and a PC OA against a foe. Confirm the eligible controller receives the prompt and accepting it spends exactly one reaction.
4. During a successful OA, exercise nested Shield, Silvery Barbs, and Hellish Rebuke where eligible. Confirm the outer movement prompt resumes after each nested answer.
5. Provoke an OA against a Sanctuary-protected target. Confirm the Wisdom gate occurs before the attack and a failed save turns the OA aside while still spending the chosen reaction.
6. Stand behind a tall wall in Player View. Confirm cells beyond remain undiscovered; approach a doorway/open angle and confirm only truthful sight lanes open.
7. Generate a map with a structural bridge. As overseer, switch it Open → Closed → Broken → Open. Confirm movement, meshes, overlay colors, refresh, and the second browser agree.
8. Attempt to close/break a bridge while a creature occupies the span. Confirm the edit is refused and the surface remains authoritative.

A clean completion of this checklist is still required before promotion to `/forge`. After that gate, active Phase 2 proceeds to bridge completion and then doors, tunnels, and hazardous crossings.
