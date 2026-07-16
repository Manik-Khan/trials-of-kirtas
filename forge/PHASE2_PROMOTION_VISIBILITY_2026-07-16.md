# The Forge promotion and visibility cleanup · 2026-07-16

This slice follows the reaction/hidden-information hardening build. It closes the final field issues around initiative presentation and long-range creature recognition, then begins the bounded product promotion milestone recorded in the July 15 roadmap.

## Field issues closed

### Initiative modal and input density

- The initiative lobby now sits above the combat HUD and scrolls within the viewport.
- Opening initiative dims and disables the HUD/feed beneath it rather than allowing them to cover the final rows or controls.
- The separate physical-d20 input and **Use d20** button have been removed from the visible interface.
- A controller may either:
  - use **Roll** for a digital roll with complete component evidence; or
  - enter one final physical/manual total and press **Enter**.
- Manual totals are explicitly opaque totals; Forge does not pretend it knows their component evidence.
- The lobby uses higher-contrast text, inputs, controls, and initiative evidence.

### Jack of All Trades

Initiative derivation now reconciles recognized initiative features against the sheet's declared/cached initiative total.

- Jack of All Trades contributes half proficiency, rounded down, when the character is not already adding proficiency to initiative.
- Remarkable Athlete shares the same half-proficiency group so the two cannot stack accidentally.
- An explicit feature is not silently lost merely because a stale sheet total omitted it.
- When Forge repairs such a stale total, the initiative evidence records a warning explaining what was added.

For the current Liadan record, ordinary initiative should show:

```text
DEX +1
Jack of All Trades +1
```

before any active rolled bonus such as Gift of Alacrity.

### Long-range creature recognition

The former 60-foot detail radius was incorrectly serving as a hard creature-visibility cutoff. Creature recognition now consumes broad, wall-aware current line of sight instead.

- A foe in truthful, unobstructed personal line of sight remains visible and targetable beyond 60 feet.
- Full creature clarity is retained through 100 feet.
- From 100 to 240 feet, hostile creatures gradually desaturate, lose opacity, and shed their shadow.
- Beyond 240 feet, they remain a subdued silhouette rather than vanishing solely because of distance.
- Walls, closed geometry, unexplored topology, and lack of personal line of sight still hide the creature completely.
- Weapon and spell range remain separate rules checks; seeing a creature does not make an attack legal.
- Props, badges, interactions, and fine terrain detail continue to require the tighter detail-vision mask.

This is a visual-recognition rule for the current bright/open presentation. A complete authored lighting and darkvision simulation remains a later capability.

## Bounded Forge promotion begun

### Canonical surface

- Canonical implementation: `/forge/` via `forge/index.html`.
- Visible product name: **The Forge**.
- The masthead identifies **Workshop** before a shared encounter and **Table** inside one.
- `forge/topography-test-mock.html` is now a compatibility redirect that preserves the query string and hash, including existing session/join parameters.
- Runtime tests and supported patch tools now target the canonical implementation.

### Active and Planned panels

The Workshop panel now separates supported controls from future product work.

**Active** retains:

- biome and dungeon generation;
- archetype, room, loop, decor, and foe controls;
- encounter creation and bestiary setup;
- camera and token presentation;
- grid opacity;
- current height, connector, bridge, cover, and supported diagnostic controls.

**Planned** contains cards for:

- Asset Library;
- Image-to-Dungeon Import;
- Terrain Annotation;
- Auto-Dress;
- Advanced Visual Profiles;
- Authoring Inspection.

Superseded heightmap/type-map controls, dead height/water experiments, shader prototypes, the unfinished asset selector, and tactical vertical inspection residue are hidden rather than presented as broken working controls.

## Validation

Focused checks:

- promotion/visibility smoke: 17/17;
- initiative evidence: 16/16;
- final trust: 18/18;
- reaction/hidden-information hardening: 14/14;
- discovery: 48/48;
- Phase 1.5f contract: 49 green;
- Phase 1.5g contract: 76 green;
- Wave 4: 17/17;
- snapshot authority: 24 green;
- map-contract render truth: 23 green.

Whole Forge battery comparison:

- prior reaction-hardening baseline: 44 pass, 7 inherited failures, 1 inherited timeout;
- promoted build: 45 pass, 7 inherited failures, 1 inherited timeout.

The additional passing result is the new promotion/visibility suite. No previously passing suite remains regressed.

The inherited red results remain the existing cover-contest, flora, engine, pick-unit, tiers-rebase, token-rig, and unit-art harness failures plus the placement timeout.

## Browser field checklist

1. Open initiative at a 1440×900 viewport and at a shorter viewport; confirm the final row and footer remain reachable above the HUD.
2. Confirm the visible row contains **Roll**, one final-total input, and **Enter**, with no duplicate d20 input.
3. Roll Liadan digitally and confirm `DEX +1` and `Jack of All Trades +1` appear separately.
4. Enter a physical/manual final total and confirm it is labeled as a manual total without invented components.
5. Place an enemy 65–100 feet away in open personal line of sight; confirm it remains fully visible.
6. Move it beyond 100 feet; confirm it softens gradually rather than disappearing.
7. Put the same enemy behind a sufficiently tall wall; confirm it vanishes despite being inside nominal distance.
8. Confirm exact hostile AC remains absent in Player View.
9. Open `/forge/` directly and confirm the canonical surface boots.
10. Open an old `topography-test-mock.html?session=...` URL and confirm it redirects while preserving the session.
11. Confirm bridge and connector controls remain in Active, while future tools appear as Planned cards.

## Next active Phase 2 work

After this browser pass, continue structural bridge completion and field verification:

1. generation discoverability and counts;
2. deterministic bridge candidate selection;
3. saved/restored path identity;
4. rail cover and movement authority;
5. open/closed/broken state synchronization;
6. bridge-specific validation and staff overlays.

Then proceed to doors as the next connector type.
