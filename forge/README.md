# forge/ — Battle Forge map subsystem

Procedural battle-map generation for Trials of Kirtas, and the seam that
lets a generated map become a rules-enforced combat encounter. This is an
**optional** layer that extends theatre-of-the-mind play — it never replaces it.

## Pipeline

```
params ─▶ forge-engine ─▶ (map-bridge contract) ─▶ tactics-geometry ─▶ combat
             │
             ├─ uses forge-dungeon (staged legacy grammar)
             └─ uses forge-temple-terraces (intentional Temple grammar)
```

`map-bridge.js` bridges the generator to the **map document**. It does *not*
bridge the generator to the **combat system**. That port — flanking, opportunity
attacks, badges, hit flash, damage floaters, Ready-an-action — is a separate,
unfinished job, tracked in `CONTEXT_Forge.md` §3.

## Modules (runtime — load these in the browser)

- **forge-dungeon.js** — the procedural dungeon generator (rooms, corridors,
  pools, depth), extracted from the original topography prototype and now consumed by the canonical Forge surface. MIT attribution
  retained inside; core adapted from majidmanzarpour/threejs-procedural-dungeon.
  Global: `window.ForgeDungeon`. Its `THEMES` keys **are** the biome names.
- **forge-engine.js** — control + completion + reliability. One call,
  `ForgeEngine.generate(params)`, returns a finished, verified map. Legacy
  profiles include PC/foe spawns; intentional Temple preview deliberately
  returns none until the DM deployment slice. Depends on forge-dungeon,
  forge-temple-terraces, map-bridge, and forge-generator-foundation.
  Global: `window.ForgeEngine`.
- **forge-temple-terraces.js** — pure intent-owned Temple generator. Produces
  broad 0/5/10/15-ft regions, axial/switchback/ring variants, route-owned
  multi-point stairs, construction profiles, and semantic validation. It never
  places combatants or bridges. Global: `window.ForgeTempleTerraces`.
- **map-bridge.js** — the seam. Converts generator output (dungeon grid or
  topography heightfield) into the combat map contract. Global: `window.MapBridge`.
- **tactics-geometry.js** — the combat rules module (movement, cliffs, LoS,
  cover, ranges). The **canonical source of truth** for this file.
  Global: `window.TacticsGeo`.

All five are dual-export (browser `window.*` **and** Node `module.exports`), so
the Node test harness and the browser game share the exact same code.

## The map document

```js
{ cols, rows,
  h:    Int[rows*cols]   // terrain height in FEET (0, 5, 10, 15 …)
  wall: bool[rows*cols]  // MOVEMENT blocker (impassable)
  occ:  Int[rows*cols]   // occluder height in FEET *above* h[]
  spawns, props, meta }  // passthrough for the renderer / turn setup
```

**Sight is height, and only height.** Nothing is opaque by type. `occ[i]` is
whatever stands on cell `i`: `0` for open ground, `4.5` for a boulder, `10.5`
for a temple wall, `Infinity` for off-map rock. `losVerdict` traces the 5e
corner lines through 3D and asks whether anything rises above the ray — so a
pit can never block, and a rise always can. Both facts fall out of the
arithmetic; no clause enforces either.

When `occ[]` is **absent**, the module falls back to the v1 rule (a wall is
full-height opaque), so pre-`occ[]` maps keep their exact behaviour.

Cover is graded over 8 corner-lines (4 corners × head/feet):
`0 → none · 1–4 → half (+2) · 5–7 → three-quarters (+5) · 8 → total`.

Occluder heights come from the generator, not from thin air:
`map-bridge.BIOME_WALL_UNITS` mirrors the biome renderer's `SKINS.wallH` × 5 ft.

### `ForgeEngine.generate(params)` — the DM controls

| param         | default  | meaning                                                        |
|---------------|----------|----------------------------------------------------------------|
| `seed`        | random   | reproducible when set                                          |
| `themeKey`    | random   | biome: `grass` `druidic` `tundra` `swamp` `temple` `cavern` `volcanic` |
| `roomCount`   | 8        | dungeon size                                                   |
| `heightMode`  | "tiered" | "tiered" (depth → elevation) or "flat"                         |
| `verticality` | 5        | feet per height tier (5 = one walkable step)                   |
| `party`       | 4        | number of PC spawns                                            |
| `foes`        | 5        | number of foe spawns                                           |

The biome names were renamed once (`ancient/molten/frost/grim/verdant` →
the list above). An unrecognised `themeKey` currently dies with a `TypeError`
deep inside `forge-dungeon.js` rather than narrating. Worth a guard.

Every staged legacy combat map is verified: valid contract, spawns on open
floor, and PC↔foe mutually reachable. A failing seed is retried; a broken map
is never returned. Intentional Temple preview uses its own scene validator and
requires zero generated spawns.

### Temple Terraces preview

Fresh `temple-terraces` records select generator version
`2.1.0-temple.1` and profile `intentional-archetype`. Workshop renders the
purpose-built terrain and labels it `preview`; local combat, Roll Initiative,
and Save for later narrate that DM deployment groups are still required.
Temple returns `spawns: []`. Explicit old recipe profiles and saved snapshots
retain their historical authority. Full contract: `FORGE_TEMPLE_TERRACES_1.md`.

Staged legacy generation no longer decorates ordinary 5-ft edges with stairs
or forces pool bridges. The proven bridge substrate remains available for a
future intent-owned `bridge-crossing` archetype.

## Canonical product surface

- **`forge/index.html`** — the canonical **The Forge** implementation, served at `/forge/`.
- **`forge/topography-test-mock.html`** — compatibility redirect only. It preserves query/hash parameters so existing session and join links continue to work.
- **Workshop** is the pre-session authoring mode; **Table** is the persistent shared encounter mode.
- Supported controls live in the **Active** tab. Future work is represented by descriptive cards in **Planned**, not disabled fake controls.

Historical mocks remain useful as design and port references, but none is a second production surface.

| file | current role |
|---|---|
| `index.html` | canonical 3D Forge product surface |
| `topography-test-mock.html` | query-preserving legacy redirect |
| `battle-tactics-geo-mock.html` | flat combat/feel reference |
| `battle-forge-mock.html` | generator/token-art reference |
| `battle-forge-biome-mock.html` | biome art-direction reference |
| `r185-probe-mock.html` | renderer migration diagnostic |

## three.js

`index.html` runs **r185**, loaded as ESM through an import map.
It was on r128 (cdnjs UMD). three has shipped no browser UMD build since ~r160
and deleted `examples/js/` at r148, so a classic `<script src>` tag can reach
neither a modern version nor any addon — the import map is the only door.

The other three mocks are still r128 on purpose. They are reference sources for
the port, not surfaces; migrating them buys nothing and risks the originals.

Light intensities are restored by **×π** (`LEGACY_PI`). r128 applied that π in the
shader; r155 moved it to `WebGLLights.scaleFactor` behind `useLegacyLights`; r165
deleted it. Same multiply, identical image. It does **not** cover `PointLight` /
`SpotLight` — r155 also changed `decay` and distance falloff, so torches need
their own pass.

Post-processing (N8AO, bloom) is **not** wired yet. Pins, when it is:
`postprocessing@6.39.2` requires `three >=0.168 <0.186`, so r185 is the ceiling;
`n8ao@1.10.3` imports **three** bare specifiers — `three`, `postprocessing`, and
`three/examples/jsm/postprocessing/Pass.js`. The last is a different prefix from
`three/addons/` despite resolving to the same directory. All three must be in the
import map, or the browser throws `Failed to resolve module specifier`.

### Flora and walls

`FLORA[biome]` decides what grows. `kinds` is read at **build** time, because a kind
carries an occluder height (`PROP_FT`, mirrored from `map-bridge` `PROP_UNITS` × 5 ft)
and sight is decided by `tier*5 + occ` — species therefore change on a re-forge, not on
a biome click. `pal` is read at **render** time, so a click retints immediately. Add a
kind without adding its height and it will occlude nothing, silently; `smoke-flora.js`
fails if you do.

`T_ROCK` is a wall: impassable in `combatMapFromF`, excluded from `walkableCells`,
`occ = WALL_FT`. Nothing spawns in one. Flora is kept off wall-adjacent cells because a
camera-facing sprite quad is wider than its cell and clips into the box next door — an
artifact of billboards, not of the rules.

Every **upright** sprite must set `alphaTest` (`ALPHA_CUT = 0.15`). `SpriteMaterial`
defaults `depthWrite:true`, so a transparent sprite without it writes depth across its
whole quad and silently swallows anything behind it — a tree became an invisible
tile-wide wall. Ground shadows are the one exception: `depthWrite:false`, never occluding.

### The 5-ft grid

The caps are already one 1×1 instance per cell, so a 1×1 quad on each cap top *is* the
5-ft square. One instanced transparent plane, a texture that is only a border, and
`setGridOpacity()` writes `material.opacity` — the slider never rebuilds the field.

`index.html` runs its renderer in a `type="module"` block. That block
is **deferred**, and its top-level `var`s are no longer globals. It exports `CHAR`
and `__placeRoster` / `__enterForge` / `__startCombat` on `window`, and fires a
`topo:ready` event that the classic party-select block waits for before painting.

## Tests (dev-time only — Node, not shipped)

```
cd forge/tests
node smoke-forge-engine.js       # engine: reliability, control, completion, combat consumption  (14)
node smoke-map-bridge.mjs        # seam: generator payload → combat rules honour it              (16)
node smoke-tactics-geometry.mjs  # geometry: cliffs, LoS, movement budget                        (26)
node smoke-los-cover.js          # heightfield LoS + graded cover, one case per stated rule      (27)
node smoke-placement.js          # spread rule: no blobs, no stacking, foes in the 40-90 ft band (19)
node smoke-flora.js              # walls hard, flora clears them, every kind has a height + depth (22)
node smoke-temple-terraces.js    # intentional variants, routes, rendering, preview safety (35)
```

124 assertions, all green. `smoke-placement.js` **extracts `clusterAround` and
`foeAnchor` from the canonical surface at test time** rather than copying them, and runs them over
40 real `ForgeEngine.generate()` fields — a copy would pass while the product surface stayed broken. `smoke-los-cover.js` is the arbiter: if a change
breaks it, the change is wrong until argued otherwise.

The combat-rules smoke (reactions, rewind, action economy) lives with the
combat mock, not here — it validates the game surface, not the map subsystem.

**A headless test that passes while the browser stays broken is not proof.**
Extract the real functions and run them on the real generated field.

## Protocol (multiplayer spine)

`forge-protocol.js → forge-replay.js → forge-bus.js → forge-pipeline.js`.
Design: `FORGE_PROTOCOL.md` (repo root). State is derived by replaying the
append-only `forge_events` log; the bus is swappable (memory in smokes,
Supabase live); RLS enforces identity only — turn order is client-gated.
Smokes: `tests/smoke-protocol.js`, `tests/smoke-replay.js`.
