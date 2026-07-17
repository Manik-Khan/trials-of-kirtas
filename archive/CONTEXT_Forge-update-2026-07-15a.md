# CONTEXT Forge update · 2026-07-15a

Supersedes `CONTEXT_Forge-update-2026-07-14f.2.md` as the current concise Forge handoff.

## Current authority and field verdict

Battle Forge Phase 2 is complete through the current structural-bridge foundation and canonical damage pipeline:

- Phase 2a: exact `mapSnapshot` authority with legacy recipe fallback;
- Phase 2b: Forge Map Contract 2.0 and truthful tactical vertical scale;
- Phase 2c: archetype selector and versioned parameter records;
- Phase 2d: independent deterministic ownership for `layout`, `height`, `semantics`, `decor`, and `foes`;
- Phase 2e: bounded elevations plus first-class stairs, ramps, and ledges;
- Phase 2f: multi-cell structural bridges and bridge-aware geometry;
- Phase 2f.2: canonical component damage pipeline shared by the final Forge actions and feed.

The July 15 browser field round confirms that damage components are now visible in the live Forge feed. Caim's Flurry of Blows displayed individual d4 results and the flat modifier separately. The damage-display release gate is therefore closed for newly generated attacks.

Do not reopen the damage formatter unless a new attack loses its component record. The larger architectural goal still stands: the sheet, ordinary Battle page, and Forge should ultimately consume one canonical resolved character-action layer instead of reconstructing class features independently.

## Immediate field findings — correctness wave before more expansion

These are demonstrated field issues, not polish requests.

### 1. Advantage/disadvantage evidence

The current helper rolls two d20s for advantage/disadvantage but returns only the kept result:

```js
function d20a(adv,dis){
  var a=d(20);
  if(adv&&!dis) return Math.max(a,d(20));
  if(dis&&!adv) return Math.min(a,d(20));
  return a;
}
```

The attack event and feed therefore retain only one d20 even when `adv · flanking` is correctly reported.

Required correction:

- record both raw d20 results;
- record which result was kept and which was dropped;
- preserve the pair through multiplayer facts, replay, refresh, correction, and Chronicle feed;
- show both dice compactly in the feed, with the kept die visually clear;
- normal rolls remain one d20;
- advantage and disadvantage cancelling remains one normal d20.

Do not change the flanking ruling merely because only one die is displayed. First prove whether the rules result and the evidence result disagree.

### 2. Ki / Focus resource authority

Caim's Flurry of Blows, Patient Defense, Step of the Wind, and Hand of Healing carry `cost:{ki:1}`, and local `spend()` subtracts action costs. The field round nevertheless showed no Ki decrement.

Trace the complete resource path:

```text
sheet resource
→ ForgeKitDerive aliases
→ final unit `res`
→ canUse
→ publish success
→ spend
→ replay/effect state
→ HUD
```

Required behavior:

- one Ki spent exactly once on successful use;
- no spend on cancelled targeting or failed publication;
- every client and refresh reconstructs the same remainder;
- Ki/Focus aliases resolve to one authoritative pool;
- Flurry's two strikes cost one Ki total, not one per strike.

### 3. Dash and movement-budget reconciliation

Demonstrated sequence:

- move 10 ft from a 30-ft speed;
- Dash reports an enlarged pool such as `60/30`;
- subsequent movement consumes or resets against the pre-Dash remainder;
- the displayed budget and reachable tiles diverge.

Required model:

```text
turn movement capacity
= base speed
+ every authoritative movement bonus this turn

remaining movement
= capacity
- authoritative moved distance
- authoritative extra movement costs
```

The same derived value must drive:

- HUD number;
- movement reach;
- blue movement tiles;
- move validation;
- refresh;
- rewind;
- replay;
- all devices.

Do not maintain a separate visual `moveLeft` pool that can diverge from the event log.

### 4. Movement-highlight lifecycle

Blue movement tiles can disappear and fail to return after:

- moving, attacking, then moving again;
- rewind/correction;
- a state reconciliation.

Required correction:

- one `rebuildMoveReach()`/`drawHi()` reconciliation door after every state-changing event;
- if movement remains and the active unit is controllable, reachable tiles must be present;
- no stale highlight group after rewind, target cancellation, or attack completion.

### 5. Cursor/selection legibility

The currently selected destination tile is difficult to see against some terrain.

Requested behavior:

- selected green tile receives a subtle, reduced-motion-safe pulse;
- pulse changes presentation only;
- legal/illegal movement authority remains unchanged;
- contrast must remain clear across grass, water, stone, lava, and fog.

### 6. Fog-of-war redesign

The current dark veil can cover the area the player is actively trying to read while still communicating too much of the overall map shape.

Desired three-state presentation:

- **currently visible:** normal battlefield rendering;
- **explored but not currently visible:** subdued remembered terrain only;
- **unexplored:** do not render the map geometry at all; show a neutral world-space void/mask without room, wall, height, prop, or light silhouettes.

Additional rules:

- zooming out must never reveal unexplored topology;
- props, enemies, decals, interactions, badges, and local lights require current visibility;
- explored terrain may remain as dark memory;
- visibility should be calculated per party member and unioned for party-shared discovery;
- darkvision/light radius must become character- and lighting-aware rather than one universal hard radius;
- exact initial darkvision radius remains to be confirmed: M wrote “30 squares”; likely intended values are 60 ft / 12 squares or 30 ft / 6 squares.

This redesign should extend the existing discovery contract rather than restoring cell-volume fog.

### 7. Sanctuary verification

Sanctuary was successfully applied to Líadan in the field round. Its hostile-target Wisdom-save gate is not yet field-confirmed because players cannot directly drive enemy attacks through a full enemy HUD.

Next test must prove:

- hostile attack/action targets a Sanctuary-protected creature;
- Wisdom save is requested/resolved before the attack;
- failed save redirects or wastes the attack according to the settled implementation;
- successful save permits the attack;
- Sanctuary ends on the correct offensive action;
- replay/refresh reconstructs the effect.

Do not mark Sanctuary broken merely because this test has not yet been reachable.

## Immediate product/UI decisions

### Roll Initiative

Rename **Open the Table** to:

> **Roll Initiative**

Supporting copy should make its authority explicit:

> Saves this battlefield and creates the persistent shared encounter. Players can join, claim characters, refresh, and reconnect.

Once the shared encounter exists, the join action may read **Enter the Table** or **Enter the Fight**.

### Grid visibility

- Grid defaults to **50%**, not 0%.
- Grid opacity remains a local presentation control.
- Every user may adjust it during combat without changing map or rules authority.
- The preference should persist locally if the current UI already persists comparable camera settings.

### Bridge controls remain active

Structural bridges, stairs, ramps, ledges, and connector overlays are current Phase 2 work. They remain in the active **Height / Vertical Geometry** section.

They must not be moved into Planned or Experimental.

### Planned tab

Create a separate Workshop-only **Planned** tab to remove dead prototype controls from the active sheet.

Planned cards:

- Asset Library;
- Image-to-Dungeon Import;
- Terrain Annotation / paint and lasso tools;
- Auto-Dress;
- Advanced Visual Profiles;
- full Authoring Inspection tools.

Each card should use a concise description and status. It must not resemble a disabled working control.

### Prototype residue

Classify old controls:

- superseded greyed-out water-fill/heightmap controls: hide or retire, not preserved individually;
- old heightmap upload: superseded by Image-to-Dungeon Import;
- vertical inspection slider: hide during tactical play; expose only in a real Workshop inspection mode;
- Toon/Soft shader experiments: move to Experimental/visual-development tools unless a meaningful supported distinction is authored;
- unbuilt asset selector: remove from active controls and represent as one Planned card.

## Product promotion and naming

The production surface has outgrown `forge/topography-test-mock`.

Preferred public product:

- visible name: **The Forge**
- canonical route: `/forge`
- canonical source: `forge.html` or `/forge/index.html`
- old `forge/topography-test-mock` route: redirect while preserving query/session parameters.

Do not rename in the middle of the current correctness wave.

Promotion gate:

1. advantage evidence;
2. Ki/resource authority;
3. Dash/movement reconciliation;
4. movement highlight restoration;
5. fog presentation correction;
6. one clean two-device stability pass.

Then perform a bounded Forge promotion/cleanup slice before deeper Phase 2 expansion.

## Active Phase 2 order

Bridge work remains the top generator section.

1. Close the current field-correctness wave listed above.
2. Field-verify existing structural bridges and connector overlays.
3. Finish structural bridge UI/state gates:
   - generation discoverability;
   - saved/restored bridge paths;
   - rails and cover;
   - open/closed/broken state;
   - truthful rendering;
   - movement authority.
4. Add doors.
5. Add tunnels.
6. Add fords and hazardous crossings.
7. Place semantic PC/foe/objective spawns.
8. Validate and locally repair:
   - normal-creature connectivity;
   - objective access;
   - melee access;
   - spawn fairness;
   - cover and sightline distribution;
   - elevation advantage;
   - chokepoints.
9. Add graph, critical-path, semantics, height, connector, cover, and spawn-influence overlays.
10. Expand authored tactical props and edge blockers.
11. Perform Forge promotion/cleanup at the gate above if not already completed.
12. Build the top-down image-import/annotation MVP on the completed map contract.

## Scope discipline

Use this field triage:

1. **Blocker:** cannot enter, join, move, attack, save, restore, or continue → stop and fix.
2. **Correctness/trust:** wrong rules, state, replay, geometry, or visual contradiction → fix before claiming the slice.
3. **Product clarity:** misleading names, dormant controls, unclear workflow → place in the bounded promotion/cleanup slice.
4. **Polish:** color, spacing, animation, and convenience → backlog until a presentation milestone.

Working rule:

> Correct enough to trust. Clear enough to test. Then move forward. Polish at milestones.

## Deployment/process rule

M uploads, commits, and pushes through GitHub. Return repository-structured files and guarded patchers. Do not push unless explicitly instructed.

The full repository battery and a real two-device field pass remain required after every multiplayer or geometry change.
