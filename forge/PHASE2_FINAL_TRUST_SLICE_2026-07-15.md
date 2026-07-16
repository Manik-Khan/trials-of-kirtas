# Battle Forge — Phase 2 final trust slice · 2026-07-15

This slice begins from the verified Wave 4 working set and closes the remaining initiative-evidence, Bless-targeting, and player-vision trust gaps before the bounded `/forge` promotion pass.

## Scope

### Canonical initiative evidence

Initiative is no longer stored as an unexplained final number. `forge-initiative.js` resolves and publishes a structured evidence record containing:

- every raw d20 result;
- the kept die and kept index;
- advantage and disadvantage sources;
- named static bonuses;
- rolled modifier dice and their individual results;
- the final total;
- whether the result was rolled digitally, entered as a physical d20, or entered as an opaque final total.

The same evidence survives multiplayer publication, replay, refresh, initiative editing, and Chronicle/feed rendering.

Recognized sources include:

- Dexterity modifier;
- Alert's static initiative bonus;
- Sentinel Shield, Weapon of Warning, Feral Instinct, and authored initiative advantage/disadvantage sources;
- Jack of All Trades, Remarkable Athlete, Hare-Trigger, Tactical Wit, Temporal Awareness, Dread Ambusher, Rakish Audacity, and authored static sources;
- Gift of Alacrity (`1d8`);
- Guidance (`1d4`);
- Bardic Inspiration using the effect's recorded die;
- Oath of the Watchers' Aura of the Sentinel, using the paladin's proficiency bonus and authored aura radius;
- authored `initiativeModifiers` records for static, die, advantage, disadvantage, and aura sources.

A known spell is not treated as active merely because it appears on a character sheet. Gift of Alacrity contributes only when the effect is currently active or when the sheet explicitly seeds an active initiative modifier.

### Physical and manual initiative entry

The initiative lobby now supports three evidence modes:

1. **Digital roll** — Forge rolls and records all dice and modifiers.
2. **Physical d20** — the player enters the physical kept d20; Forge adds known modifiers and records the breakdown.
3. **Manual total** — the overseer enters a finished total, clearly labeled as opaque because component evidence is unavailable.

When advantage or disadvantage applies to a physical roll, the UI warns that Forge can preserve only the entered kept die unless the roll is performed digitally.

### Initiative presentation

The lobby and feed now show the component breakdown rather than only the total. Typical evidence includes:

```text
Vesperian — Initiative 18
D20: 14
DEX: +4
Total: 18
```

```text
Initiative 24
D20s: 7, 16 — kept 16
DEX: +4
Gift of Alacrity: 1d8 → 4
Advantage: Sentinel Shield
Total: 24
```

Opaque manual totals remain editable but are never presented as fully audited rolls.

## Bless targeting authority

Bless targeting now presents all living allies with an explicit eligibility reason:

- selectable, with measured distance;
- out of the spell's 30-foot range;
- blocked by total cover / no clear spell path.

The picker uses the same tactical line-of-sight verdict used by the battlefield rather than silently accepting every ally. Published Bless facts preserve the selected unit, measured distance, and line-of-effect verdict. Level-one target count remains three.

## Personal vision and shared memory

Player-view discovery is now separated into two authorities:

- **personal current sight** from the player's claimed character;
- **party-shared explored memory** accumulated by the group.

The overseer in Player View uses the selected living PC, then the active PC, then a living party fallback. Ordinary players never receive full-detail current sight from a distant ally merely because that ally can see an area.

### Vision shape

Current sight is a 360-degree geometric isovist rather than a facing cone. Walls, closed geometry, elevation, and legitimate openings shape the visible region. A doorway produces a truthful wedge of visibility; tall walls cast sight shadows.

Detailed recognition remains bounded by the character's authored sense radius. Truthfully visible terrain beyond that radius can remain spatially legible but transitions gradually toward a desaturated, hazy distant presentation. Creatures, props, badges, interactions, and other actionable details still require exact current visibility.

### Continuous presentation mask

Rules authority remains cell- and geometry-exact. Presentation no longer displays that authority as isolated hard-edged tiles.

The renderer now:

- supersamples the visibility mask;
- removes disconnected visual specks without revealing hidden cells;
- feathers the visual boundary;
- applies a deterministic cloudy field to unexplored space;
- renders the void at ground level instead of as an overhead dark slab;
- keeps explored terrain as subdued memory while withholding current entities and details.

Smoothing changes presentation only. It does not grant targeting, discovery, movement, or creature visibility through an occluder.

## Files added

- `forge/forge-initiative.js`
- `forge/tests/smoke-forge-initiative.js`
- `forge/tests/smoke-phase2-final-trust.js`
- `forge/PHASE2_FINAL_TRUST_SLICE_2026-07-15.md`

## Principal files updated

- `FORGE_PROTOCOL.md`
- `forge/forge-discovery.js`
- `forge/forge-effects.js`
- `forge/forge-kit-derive.js`
- `forge/forge-pipeline.js`
- `forge/forge-replay.js`
- `forge/forge-table-correctness.js`
- `forge/topography-test-mock.html`
- related smoke and contract tests

## Automated validation

### Focused and contract suites

- Final trust slice: **18/18**
- Initiative evidence: **16/16**
- Wave 1 correctness: **22/22**
- Wave 2 correctness: **31/31**
- Wave 3 correctness: **31/31**
- Wave 4 correctness: **17/17**
- Replay: **35/35**
- Protocol: **56/56**
- Kit derivation: **341/341**
- Feed renderer: **66/66**
- Table correctness: **31/31**
- Discovery: **48/48**
- Effects: **42/42**

All modified JavaScript files and all inline executable scripts in `topography-test-mock.html` pass syntax validation. `git diff --check` is clean.

### Whole Forge battery comparison

Wave 4 baseline:

- **41 passing**
- **7 inherited failures**
- **1 inherited timeout**
- **49 suites total**

Final trust slice:

- **43 passing**
- **7 inherited failures**
- **1 inherited timeout**
- **51 suites total**

No previously passing suite became a failure. The unchanged inherited non-passing suites are:

- `smoke-cover-contest.js`
- `smoke-flora.js`
- `smoke-forge-engine.js`
- `smoke-pick-unit.js`
- `smoke-tiers-rebase.js`
- `smoke-token-rig-contract.js`
- `smoke-unit-art.js`
- `smoke-placement.js` (timeout)

## Required browser field pass

### Initiative

1. Roll Vesperian normally and confirm the feed identifies the d20 and `DEX +4` rather than an unexplained total.
2. Equip or seed Sentinel Shield initiative advantage and confirm two d20s plus the named source.
3. Apply/seed Gift of Alacrity and confirm a recorded `1d8` component.
4. Test Aura of the Sentinel with a Watchers paladin both inside and outside the authored aura radius.
5. Enter a physical d20 and confirm Forge adds known modifiers while labeling the input mode.
6. Enter an overseer manual total and confirm it remains explicitly opaque.
7. Refresh both browsers and confirm every evidence component and initiative order remain identical.

### Bless

1. Confirm an ally inside 30 feet is selectable.
2. Confirm an ally outside 30 feet is visible in the picker but disabled with distance feedback.
3. Confirm an ally behind total cover is visible but marked as blocked.
4. Confirm only three level-one targets can be published.

### Vision

1. Compare top-down and 3D player views from the same claimed character.
2. Confirm a high wall blocks the room beyond it.
3. Open or approach a doorway and confirm visibility expands through the opening without revealing the whole room automatically.
4. Confirm no isolated distant tiles appear without a connected line-of-sight region.
5. Confirm distant visible terrain becomes hazier rather than snapping into a hard radius.
6. Confirm party-explored terrain remains as subdued memory while creatures and current details disappear outside personal sight.
7. Zoom out and confirm unexplored topology remains absent beneath the cloudy void.

## Remaining boundary

This slice does not claim a complete authored lighting simulation. Current sight combines exact wall/elevation geometry, character sense/detail radius, and broad geometric daylight visibility. A later lighting slice may add authored light sources, darkness levels, dim light, magical darkness, and full darkvision color rules without changing the personal-sight/shared-memory contract established here.

## Promotion gate

After the browser checks above and one clean two-device refresh/reconnect pass, the bounded Forge promotion/cleanup milestone may proceed without waiting for the remainder of Phase 2. Structural bridges and connector development remain active Phase 2 work after that milestone.
