# forge/ — Battle Forge map subsystem

Procedural battle-map generation for Trials of Kirtas, and the seam that
lets a generated map become a rules-enforced combat encounter. This is an
**optional** layer that extends theatre-of-the-mind play — it never replaces it.

## Pipeline

```
params ─▶ forge-engine ─▶ (map-bridge contract) ─▶ tactics-geometry ─▶ combat
             │
             └─ uses forge-dungeon (the generator core)
```

`map-bridge.js` bridges the generator to the **map document**. It does *not*
bridge the generator to the **combat system**. That port — flanking, opportunity
attacks, badges, hit flash, damage floaters, Ready-an-action — is a separate,
unfinished job, tracked in `CONTEXT_Forge.md` §3.

## Modules (runtime — load these in the browser)

- **forge-dungeon.js** — the procedural dungeon generator (rooms, corridors,
  pools, depth), extracted verbatim from the topography mock. MIT attribution
  retained inside; core adapted from majidmanzarpour/threejs-procedural-dungeon.
  Global: `window.ForgeDungeon`. Its `THEMES` keys **are** the biome names.
- **forge-engine.js** — control + completion + reliability. One call,
  `ForgeEngine.generate(params)`, returns a finished, verified combat map:
  walls + per-tile heights + occluders + PC/foe spawns. Depends on
  forge-dungeon + map-bridge. Global: `window.ForgeEngine`.
- **map-bridge.js** — the seam. Converts generator output (dungeon grid or
  topography heightfield) into the combat map contract. Global: `window.MapBridge`.
- **tactics-geometry.js** — the combat rules module (movement, cliffs, LoS,
  cover, ranges). The **canonical source of truth** for this file.
  Global: `window.TacticsGeo`.

All four are dual-export (browser `window.*` **and** Node `module.exports`), so
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

Every returned map is verified: valid contract, spawns on open floor, and
PC↔foe mutually reachable. A failing seed is retried; a broken map is never
returned.

## ⚠ Inline-copy sync rule

`tactics-geometry.js` is **inlined in two mocks** — `battle-tactics-geo-mock.html`
and `topography-test-mock.html` — because they load it as a classic `<script>`
block, not a module. Three copies exist. **The code must stay identical in all
three; change one, change all three.**

The rule used to say *byte*-identical. It isn't, and hasn't been: the two
inlined copies still carry an older header comment. The code matches exactly.
An invariant nobody can satisfy is one nobody checks — so the rule is
**code-identical** (comments stripped), which the harness can actually assert.

## The four mocks (none supersedes another)

| file | what it is |
|---|---|
| `topography-test-mock.html` | **the surface.** Heightfield, LoS/cover, reactions, rewind, sprites, shadow map, per-instance AO |
| `battle-tactics-geo-mock.html` | flat box-tile combat. **The port source** for the combat system + feel layer |
| `battle-forge-mock.html` | generator → tactics diorama. Source of the pixel sprites + portraits |
| `battle-forge-biome-mock.html` | source of the biome art direction — `SKINS`: `wallH`, fog, light rigs, particles |
| `r185-probe-mock.html` | renderer migration gate. Not a feature; answers one question and refuses others |

## three.js

`topography-test-mock.html` runs **r185**, loaded as ESM through an import map.
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

`topography-test-mock.html` runs its renderer in a `type="module"` block. That block
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
```

102 assertions, all green. `smoke-placement.js` **extracts `clusterAround` and
`foeAnchor` from the mock at test time** rather than copying them, and runs them over
40 real `ForgeEngine.generate()` fields — a copy would pass while the mock stayed broken. `smoke-los-cover.js` is the arbiter: if a change
breaks it, the change is wrong until argued otherwise.

The combat-rules smoke (reactions, rewind, action economy) lives with the
combat mock, not here — it validates the game surface, not the map subsystem.

**A headless test that passes while the browser stays broken is not proof.**
Extract the real functions and run them on the real generated field.
