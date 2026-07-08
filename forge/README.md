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

## Modules (runtime — load these in the browser)

- **forge-dungeon.js** — the procedural dungeon generator (rooms, corridors,
  pools, depth), extracted verbatim from the topography mock. MIT attribution
  retained inside; core adapted from majidmanzarpour/threejs-procedural-dungeon.
  Global: `window.ForgeDungeon`.
- **forge-engine.js** — control + completion + reliability. One call,
  `ForgeEngine.generate(params)`, returns a finished, verified combat map:
  walls + per-tile heights + PC/foe spawns. Depends on forge-dungeon + map-bridge.
  Global: `window.ForgeEngine`.
- **map-bridge.js** — the seam. Converts generator output (dungeon grid or
  topography heightfield) into the combat map contract `{cols, rows, h[], wall[]}`.
  Global: `window.MapBridge`.
- **tactics-geometry.js** — the combat rules module (movement, cliffs, LOS,
  ranges). The **canonical source of truth** for this file. Global: `window.TacticsGeo`.

All four are dual-export (browser `window.*` **and** Node `module.exports`), so
the Node test harness and the browser game share the exact same code.

### `ForgeEngine.generate(params)` — the DM controls

| param        | default   | meaning                                          |
|--------------|-----------|--------------------------------------------------|
| `seed`       | random    | reproducible when set                            |
| `themeKey`   | random    | biome: ancient · molten · frost · grim · verdant |
| `roomCount`  | 8         | dungeon size                                     |
| `heightMode` | "tiered"  | "tiered" (depth → elevation) or "flat"           |
| `verticality`| 5         | feet per height tier (5 = one walkable step)     |
| `party`      | 4         | number of PC spawns                              |
| `foes`       | 5         | number of foe spawns                             |

Every returned map is verified: valid contract, spawns on open floor, and
PC↔foe mutually reachable. A failing seed is retried; a broken map is never
returned.

## ⚠ Inline-copy sync rule

`tactics-geometry.js` is **also inlined** inside `battle-tactics-geo-mock.html`
(the combat game loads it as a classic `<script>` block, not a module). The
inlined copy MUST stay **byte-identical** to `forge/tactics-geometry.js`.
When you change one, change both. The combat mock's validation step asserts
this equality — keep it green.

## Tests (dev-time only — Node, not shipped)

```
cd forge/tests
node smoke-forge-engine.js       # engine: reliability, control, completion, combat consumption
node smoke-map-bridge.mjs        # seam: generator payload → combat rules honour it
node smoke-tactics-geometry.mjs  # geometry: cliffs, LOS, movement budget
```

The combat-rules smoke (reactions, rewind, action economy) lives with the
combat mock, not here — it validates the game surface, not the map subsystem.
