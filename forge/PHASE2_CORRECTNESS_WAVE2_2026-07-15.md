# Forge Phase 2 correctness wave 2 · 2026-07-15

This slice begins from the uploaded current `main` archive and the already-applied July 15 Phase 2 correctness-wave-1 handoff.

## Baseline

- uploaded archive: `trials-of-kirtas-main.zip`
- archive SHA-256: `0834bd54245977ab90c976fc36f288424999be61b1ffcb7bd193313412d2d3fd`
- canonical surface remains: `forge/topography-test-mock.html`
- public promotion to `/forge` remains gated on the browser and multiplayer field pass below
- structural bridges and connector work remain active Phase 2 after this correctness gate

## Field issues closed in code

### Sanctuary hostile-target gate

Enemy attacks now enter the Sanctuary gate as explicit attack actions before hit resolution. The shared effect rule also defensively recognizes legacy/raw attack records without misclassifying healing dice as hostile damage.

Sanctuary now applies to ordinary foe attacks and opportunity attacks. A failed Wisdom save prevents the attack; a successful save permits it. The existing offensive-action removal path remains intact.

### Reducer-enforced one-payment resources

Every authoritative resource payment can carry a `resource_spend_id`. Replay records applied payment identifiers and ignores a duplicate fact carrying the same identifier.

This closes the Flurry of Blows concern at the reducer level: even if both strike publications accidentally repeat the same activation payment, the activation spends one Ki total. A later activation receives a new identifier and spends normally.

### Kept and reaction die presentation

The Chronicle renderer now styles its existing evidence classes:

- `ffr-keep` receives an explicit restrained kept-die marker;
- dropped dice remain visibly struck through;
- reaction dice and their label receive dedicated spacing and presentation.

### Spell-slot authority and Cosmere

Cosmere's sheet now carries:

- two first-level Pact Magic slots;
- two first-level Sorcerer spell slots.

Forge derivation preserves those as separate authoritative pools. Eligible spells can choose between an ordinary slot and a Pact slot, and the selected pool travels in the spend fact. Hex is represented as a replayable concentration effect rather than a generic buff.

### 2014 bonus-action spell restriction

Spell facts now record level and casting-time economy. Turn legality enforces the 2014 bonus-action spell restriction rather than a blanket one-leveled-spell rule:

- action Bless followed by bonus-action Sanctuary is illegal;
- bonus-action Sanctuary followed by an action cantrip is legal;
- bonus-action Sanctuary followed by a leveled action spell is illegal;
- multiple action spells remain possible when another feature supplies the action.

### First-class Bless

Bless now:

- selects up to three allies at first level, plus one per upcast level;
- creates replayable concentration effects for each selected target;
- rolls and records an independent d4 on affected attacks and saving throws;
- exposes the d4 in attack/save evidence and Chronicle math;
- ends when concentration is replaced or broken.

Concentration checks use `max(10, floor(damage / 2))`. Falling unconscious from damage breaks concentration without a save.

### Multiplayer opportunity attacks

Shared movement now detects each path transition that leaves a hostile creature's melee reach. The actual controller receives the opportunity-attack prompt, with overseer fallback for an unclaimed unit.

The reaction is spent authoritatively and resolves before movement continues. Disengage suppresses the prompt. If the reaction drops the mover, the resolved path is truncated at the provoking boundary and every client animates and replays that same interrupted path.

### Manual initiative authority

The overseer can enter physical initiative results and edit the current order with explicit up/down controls. Mid-combat edits preserve the current active creature and do not refund spent action, bonus action, movement, or reaction state.

### Soft-reality discovery presentation

Player discovery now separates:

1. detailed current perception — normal color and tactical detail;
2. broader legitimate line of sight — desaturated, lower-contrast distant terrain;
3. explored memory — dark subdued terrain without current tactical entities;
4. unexplored space — topology absent.

The old opaque overhead veil has been replaced by a ground-level neutral void mask, preventing the large dark roof seen in the July 15 3D field screenshot. Enemies, props, badges, interactions, and local tactical details still require detailed current perception.

## Validation

### Focused and module suites

- `smoke-phase2-correctness-wave2.js`: **31 passed, 0 failed**
- `smoke-forge-effects.js`: **39 green**
- `smoke-forge-combat-rules.js`: **61 green**
- `smoke-feed-render.js`: **66 passed, 0 failed**
- `smoke-table-correctness.js`: **29 green**
- changed JavaScript files: `node --check` clean
- executable inline HTML scripts: syntax clean
- updated Phase 1.5d–h contracts: green
- updated Phase 2b.1 and Phase 2f.2 field/static contracts: green

### Repository-wide comparison

Wave-1 baseline:

- **48** smoke scripts
- **38 pass**
- **9 fail**
- **1 timeout**

Wave 2:

- **49** smoke scripts
- **41 pass**
- **7 fail**
- **1 timeout**

No new repository-wide failure was introduced. The two stale Phase 1.5 contract failures were corrected, and the new wave-2 focused suite passes.

Inherited remaining failures:

- `smoke-cover-contest.js`
- `smoke-flora.js`
- `smoke-forge-engine.js`
- `smoke-pick-unit.js`
- `smoke-tiers-rebase.js`
- `smoke-token-rig-contract.js`
- `smoke-unit-art.js`

Inherited timeout:

- `smoke-placement.js`

These remain separately tracked baseline harness/calibration work and are not regressions from this slice.

## Known boundary

Opportunity attacks currently resolve as one authoritative movement reaction. They do **not** yet open a nested Shield, Silvery Barbs, or Hellish Rebuke reaction chain. The current protocol owns one pending prompt at a time; nested reactions require a deeper reaction-stack slice rather than another local exception.

General non-damage incapacitation does not yet comprehensively terminate concentration. Damage, failed concentration saves, unconsciousness from damage, replacement concentration, replay, and refresh are covered here.

## Required browser field pass

1. Cast Sanctuary on Líadan and target her with a hostile goblin attack. Confirm the Wisdom save occurs before the attack on both clients; test both failure and success, then refresh.
2. Use Flurry of Blows and confirm exactly one Ki is spent for both strikes on both clients. Use it again and confirm the new activation spends one additional Ki.
3. Cast Bless, select three allies, and confirm separate d4 evidence on attacks and saving throws. Damage the caster and verify held/broken concentration plus refresh reconstruction.
4. Confirm Bless followed by bonus-action Sanctuary is rejected; confirm Sanctuary followed by an action cantrip is permitted.
5. Confirm Cosmere displays two Pact and two Sorcerer first-level slots. Cast Hex using each pool in separate tests.
6. Walk out of hostile reach and confirm the reaction prompt, reaction spend, Chronicle result, refresh, and rewind. Confirm Disengage suppresses it and a downing hit interrupts movement.
7. Enter physical initiative values, reorder mid-combat, and confirm the active creature retains spent action, movement, and reaction state.
8. Inspect top-down and 3D fog: detailed nearby terrain, grey/soft distant line of sight, subdued explored memory, no unexplored topology, and no overhead dark slab.
9. Confirm the kept advantage die has an explicit visual marker in addition to the discarded die strike-through.
10. Complete one clean two-browser claim, move, attack, cast, refresh, reconnect, rewind, and replay round.

Do not promote the route to `/forge` until this pass is clean.
