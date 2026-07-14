# CONTEXT — Battle Forge — updated 2026-07-13, PHASE 1.5h COMPLETE (camera, token rigs, feed/effects, discovery, combat-flow corrections, calibrated body-cover geometry, and non-leaking fog renderer shipped in bundles; current handoff: `CONTEXT_Forge-update-2026-07-13h.md`)

> This doc exists because the same failure kept happening: a session would read
> *part* of the material, conclude a feature "was never there," and rebuild
> something the repo already had. The sprites were the worst case — they had
> been sitting in `battle-forge-mock.html` in the repo the whole time.
>
> **The fix is not better prompting from M. It is the protocol in §0.**

---

## CURRENT ADDENDUM · 2026-07-13h — read before the older sections

Phase 1.5 is complete through the field-driven geometry/fog calibration. The current
production line now includes:

- approved storybook sky + horizon, 3D/top-down camera modes, follow/focus/pair/free
  camera behavior, and player-safe camera bounds;
- dual 3D standee/top-down token rigs, 5e.tools bestiary art, and local per-unit/per-kind
  token-art overrides;
- Staff View ↔ Player View, enemy disclosure privacy, Table/System/All feed, structured
  roll/damage rows, Cover Contest, reinforcement modal, slot chooser, and Ki aliases;
- replayable effects with Sanctuary; party-shared world-space discovery; direct-ranged
  firing-position preview; Monk composition; Toll the Dead d12; target→preview→confirm;
  player move undo; flanking variants; source-aware advantage/disadvantage; Prone;
- generator foundation `2.0.0-foundation.2`: exact snapshots/fingerprints, graph metadata,
  archetype keys, deterministic stage seeds, and guarded save integration;
- **Phase 1.5h geometry:** twelve body samples instead of eight head/feet rays,
  target-side grading, sub-cell `coverShape[]`, intervening-creature cover, staff cover audit;
- **Phase 1.5h fog:** per-instance terrain state plus one continuous unexplored veil;
  the overlapping fog boxes that caused triangle/checker z-fighting and hidden-room
  silhouette leaks are removed.

**Current validation:** 426 cumulative checks green in the handoff bundle. Browser/WebGL
and live two-device testing remain field gates.

**Current next phase:** active Phase 2 generator terrain. Do not restart Phase 1.5 design
unless a real browser field report demonstrates a regression. See §8 and
`CONTEXT_Forge-update-2026-07-13h.md`.

---

## §0 · READ THIS FIRST — the protocol

Before writing a single line of code, and before claiming *anything* is
missing, absent, unimplemented, or "was never built":

1. **Read every uploaded file.** Files on disk at `/mnt/user-data/uploads/`
   count even when they are not pasted into the conversation. `CONTEXT.md` was
   skipped for four turns for exactly this reason.
2. **Enumerate the repo.** `Manik-Khan/trials-of-kirtas` is public. Pull it:
   `curl https://raw.githubusercontent.com/Manik-Khan/trials-of-kirtas/main/<path>`
   The GitHub tree API rate-limits from the sandbox; fetch files directly.
   `forge/README.md` is canonical and is usually the answer.
3. **Grep before you assert.** "X doesn't exist" is a claim about the repo, not
   about your context window. Prove it with a search across all four mocks.
4. **Consult §2 (the file map) and §3 (the port manifest).** If a feature is
   listed as present in a mock, it is present. Port it; do not reinvent it.

**Never say "we never had X" without having run step 3.**

5. **And the mirror image, learned 2026-07-08:** the repo is not M's working copy.
   `main` was ~5 files behind — no `occ[]` in `forge/tactics-geometry.js`, no
   `smoke-los-cover.js`, and a `topography-test-mock.html` 366 lines short of the
   one on M's disk (no sprites, no shadow map, no AO). A session that greps only
   GitHub will conclude features are missing that M is looking at. So: grep the
   repo before claiming absence, **and ask M for the file before editing it.**
   "Present in the repo" and "current" are different claims.

6. **The mirror of the mirror, learned 2026-07-11:** THIS DOC's header goes stale
   too. A session asserted "the repo is 5 files behind" straight from rule 5's
   example and the then-current header ("STAGED, not yet committed") — M had
   committed; `main` and M's uploads were byte-identical. Rule 5 is about *asking
   for files*, not a standing fact about the repo. **Currency is verified by
   `diff`, never recited from this doc.** When M uploads a file, diff it against
   the repo copy before claiming either is ahead.

---

## §1 · WHAT THE FORGE IS

A generated-dungeon → 3D tactical-combat game mode for **Trials of Kirtas**, a
D&D 5e VTT. Vanilla JS/HTML/CSS + Supabase + Netlify + three.js. Repo
`Manik-Khan/trials-of-kirtas` (public). Deploy `trials-of-kirtas.netlify.app`.
Deploy workflow is §7's 2026-07-10 rule: **M pushes; C commits only on M's
explicit ask, and never pushes** (the two 2026-07-11 pushes were M's direct
instruction each time — an exception on order, not a new default).

The architecture, from an earlier session and still correct:

> One map document, three renderers. The generator emits a tile grid, room
> metadata, spawn marks, props and torches — deterministic from a seed. The
> tactics diorama consumes exactly that. `{seed, theme, sliders}` in a Supabase
> row regenerates an identical map on every client.

**The word "bridge" has been the source of a persistent misunderstanding.**
`forge/map-bridge.js` bridges the generator to the *map document*. It does NOT
bridge the generator to the *combat system*. The combat system is the thing in
§3, and porting it is a separate, unfinished job.

Party (live via `CharacterData`/Supabase): **Caim** (Monk), **Cosmere Runestar**
(Warlock 2/Sorc 1), **Líadan Luchóg** (Bard 3/Cleric 1), **Vesperian Vale**
(Fighter 4). **Chonkalius** and **The Wiz** have no combat sheet — they are
greyed out in the select and must never be silently dropped.

---

## §2 · FILE MAP — where everything actually lives

| file | what it holds | status |
|---|---|---|
| `forge/tactics-geometry.js` | **canonical rules module.** Chebyshev, movement, 3D LoS, twelve-sample body cover, target-side attribution, sub-cell `coverShape[]`, intervening creatures, ledge/parapet eyes, cover audit | canonical · Phase 1.5h |
| `forge/map-bridge.js` | generator/heightfield → MAP document `{cols,rows,h,wall,occ,spawns,props}` | canonical |
| `forge/forge-dungeon.js` | generator. **THEMES keys are the biome names**: `grass druidic tundra swamp temple cavern volcanic` | canonical |
| `forge/forge-engine.js` | seeded generate → validated map | canonical |
| `forge/forge-board.js` | translator: wire↔board verbs (turn loop, prompt routing, initiative, overseer toolbar incl. GOD MODE/rewind/Add-foe). Move verbs self-contained: walk prefers the declared path, falls back to `payload.path` (2026-07-11). `deadFoeSkip(state)` — pure dead-foe-holds-the-turn decision; the mock's overseer device publishes the skip (`?v=fb5`) | canonical |
| `schema_delta_forge_board.sql` | append-only migration: `forge_claim_unit()` claim RPC + session visibility for players | **presumed applied to live Supabase** (M's bite-1 field rounds ran two-device, which needs it — confirm with M, do not assert) |
| `forge/tests/smoke-tiers-rebase.js` | rebase smoke: canonical `ForgeEngine.generate()` on real seeds, §4-geometry invariants hold | canonical |
| `forge/tests/smoke-forge-board.js` | known-answer: scripted logs → board-verb sequences (move/attack/turn/prompt/timeout/restore/edit/add_unit/claim-gate) + `deadFoeSkip` decision cases | canonical |
| `forge/tests/smoke-starter-kits.js` | starter action bar from live sheet stats, generic-kit fallback, CHAR alias | canonical |
| `forge/tests/smoke-cover-contest.js` | known-answer: the Cover Contest end-to-end over MemoryBus — ruling/timeout/total flows, replay determinism, culprit geometry, and the overseer-only gate twin (a player forging `prompt_answered{unit:"__overseer"}` is rejected) | canonical |
| `forge/tests/*` | historical battery plus the cumulative Phase 1.5 bundle. Phase 1.5h bundle: **426 checks green** across 14 suites, including los-cover 50, focused cover calibration 15, discovery 41, effects 31, combat-rules 56, Phase 1.5d/e/f/g/h contracts, geometry byte-sync, table-correctness, token-art and proxy. Run the full repo battery after integration. | canonical |
| `topography-test-mock.html` | **THE surface.** Heightfield + all the geometry + combat loop | active |
| `forge/assets/topography-art/` | biome decal atlas + first-pass horizons used by the 2026-07-13 visual pass | active assets |
| `forge/assets/forge-horizons/` | six painterly biome horizon plates | active assets |
| `forge/assets/forge-skies-storybook/` | six stronger storybook sky plates | active assets |
| `forge/assets/forge-parallax/` | experimental far/mid/near cards; current extracted files have baked matte/checkerboard masking | **parked; default off** |
| `forge/assets/forge-landmarks/` | experimental background landmark cards; same masking issue | **parked; default off** |
| `battle-tactics-geo-mock.html` | flat box-tile combat mock. **The source of the combat system and the feel layer.** NOT superseded — it is the port source | reference |
| `battle-forge-mock.html` | *"the dream one."* generator → tactics diorama. **Source of the pixel sprites + portraits** | reference |
| `battle-forge-biome-mock.html` | **source of the biome art direction.** `SKINS` table: `wallH`, fog, light rigs, particles, flavour scatter | reference |
| `forge/forge-kit-derive.js` | **sheet→actions derivation** (the BG3 HUD's engine): `derive(charData)` → kit with `tabs` (attacks/spells/items/feats/bonus/actions), flat pipeline actions, res pools, reactions. `spellGroupsFrom` reads BOTH spell shapes (forged `spellcasting.groups` + legacy level-keyed `structural.spells` with inconsistent keys); SPELL_COMBAT projection table (~70 spells, label decides the kind); dedupe (derived wins, sheet folds to `_folded`); Disciple of Life; `upcastDmg` + `per` scaling; legacy `classFeatures` slot/resource ledger fallback; 5etools item-type codes | canonical |
| `forge/forge-feed-render.js` | Chat Feed renderer (headless): roll rows, full math, verdict badges, NO AC EVER | canonical |
| `forge/forge-hud.js` | the BG3 bar: tab shelf, icon tiles, drawer (`_renderSpellEntries`), bonus-corner economy marks; dispatches `forge:selectAction` | canonical |
| `forge/forge-protocol.js` | event vocabulary: 17 kinds, envelope validation. No `turn_started` — derived | canonical |
| `forge/forge-replay.js` | reducer: log → state. Facts only, never rules. Override pre-scan, restore branch, GOD-MODE edit. Since 2026-07-11: per-turn action economy derived from the log (`turnEconomy()`, facts carry `slot`; `undo_of` refunds a retracted move) | canonical |
| `forge/forge-bus.js` | transport: MemoryBus (headless, mirrors the RLS identity+kind gate) + SupabaseBus | canonical |
| `forge/forge-pipeline.js` | acting-client pipeline: declared→resolved, cross-device prompts, timeout→overseer. Since 2026-07-11: `undoMove()` (player retracts own last move, compensating fact) + `contestCover()` (pre-roll cover-contest pause, `FORGE_COVER_CONTEST.md`) | canonical |
| `forge/forge-generator-foundation.js` | generator version, independent stage seeds, archetype vocabulary, graph metadata, exact map snapshots, fingerprints, encounter envelopes | canonical foundation.2 |
| `forge/forge-unit-art.js` | PC/bestiary token-art resolver, safe URL/local overrides, per-combatant and per-kind precedence | canonical Phase 1.5c |
| `forge/forge-table-correctness.js` | Staff/Player presentation disclosure, feed channels, slot/resource/privacy and table-correctness seams | canonical Phase 1.5d–g |
| `forge/forge-effects.js` | pure replayable persistent-effect ledger; Sanctuary and conditions reconstruct from event facts | canonical Phase 1.5e |
| `forge/forge-discovery.js` | party-shared three-state world discovery, movement-history reconstruction; v1.1 uses static LoS with transient creatures ignored | canonical Phase 1.5h |
| `forge/forge-combat-rules.js` | named advantage/disadvantage reducer, flanking modes, Prone, Monk composition, Toll the Dead and action validation | canonical Phase 1.5g |
| `forge/protocol-harness-mock.html` | two-window Supabase harness, `__forgeState()` dump | mock |

`tactics-geometry.js` is **inlined in two mocks** and must stay code-identical to
canonical. Any change ships to three files at once. Phase 1.5h makes the production
topography inline byte-identical to canonical and includes a guarded patcher for the
current reference `battle-tactics-geo-mock.html`; do not deploy only two of the three.

The production topography mock consumes canonical `ForgeEngine.generate()` /
`forge-dungeon.js` / `map-bridge.js`; the old pre-rename inline generator problem was
closed before this handoff.

---

## §3 · THE PORT MANIFEST

Machine-derived from the four mocks (definition-level greps, not vibes). This is
the contract for "port the battle mock." **Everything marked ✗ is the job.**

### Rules
| feature | tactics | forge | topo | notes |
|---|---|---|---|---|
| dungeon generator | – | ✔ | ✔ | topo's copy is stale |
| heightfield / tiers | – | – | ✔ | topo only |
| line of sight (3D ray) | ✔ | – | ✔ | canonical |
| graded cover ½ / ¾ / total | ✔ | – | ✔ | canonical |
| occluder heights `occ[]` | – | – | ✔ | canonical |
| movement reach + budget | ✔ | – | ✔ | |
| climb / fly cliff gate | ✔ | – | ✔ | in `tactics-geometry.js` |
| initiative order | ✔ | ✔ | ✔ | |
| reaction pipeline | – | – | ✔ | Silvery Barbs → Shield → Rebuke |
| rewind / snapshot | – | – | ✔ | session-aware 2026-07-11: HUD cluster publishes protocol facts (overseer `restore`; player `undo_of` move retraction). Sandbox keeps local time-travel |
| **flanking** | ✔ | – | ✔ | shared rule modes: advantage default, +2, +5, Off; named adv/dis sources cancel normally; incapacitated/downed units do not flank |
| **opportunity attacks** | ✔ | – | **✗** | `battle-tactics` ~L1319–1340: fires mid-move, can drop the mover before they arrive |
| **ready / held action** | ✗ | ✗ | ✗ | **exists nowhere.** Required by the geometry: if you can't see the enemy below the cliff, you Ready |

### Feel — the layer that makes it a game
| feature | tactics | forge | topo | notes |
|---|---|---|---|---|
| move tile telegraph | – | – | ✔ | |
| tweened movement | ✔ | ✔ | ✔ | |
| sight lines drawn | ✔ | – | ✔ | topo now uses `depthTest:false` + render order; browser-visible |
| badges over units | ✔ | – | ✔ | verdict/advantage/cover badges ported to `#cbFx`; projected every frame |
| hit flash | ✔ | ✔ | ✔ | ported (`flashHit`) |
| camera shake | ✔ | ✔ | ✔ | ported; gated on reduced motion |
| idle bob | ✔ | ✔ | ✔ | ported; suppressed while moving/down |
| floating damage text | ✗ | ✗ | ✔ | new DOM floaters for damage/heal/crit/miss/down |

### Art / render
| feature | tactics | forge | biome | topo | notes |
|---|---|---|---|---|---|
| pixel sprites | ✔ | ✔ | – | ✔ | `SPRITES` + `pixelCanvas()`, 7 keys |
| base64 portraits | ✔ | ✔ | – | ✔ | 4 PCs |
| per-biome light rig | – | – | ✔ | ✔ | `SKINS` / `LOOK` |
| torch / magical PointLights | ✔ | ✔ | ✔ | ✔ | bounded local lights + additive source cards; `?fxlights=0` A/B |
| particles | – | ✔ | ✔ | ✔ | |
| shadow map | – | – | – | ✔ | topo only; PCF soft, fitted ortho frustum |
| ambient occlusion | – | ~ | – | ✔ | per-instance `setColorAt` |
| **post-processing** | ✗ | ✗ | ✗ | ✗ | exists nowhere |

---

## §4 · GEOMETRY — settled, do not relitigate

Reached over a long session, verified against the real generator, real field,
real placement. **These are decisions, not hypotheses.**

- **Distance** = Chebyshev hypotenuse: `max(horizontal_squares, vertical_tiers) × 5`.
  A tier is 5 ft. Diagonals are 5 ft. 30 ahead + 30 down = 30 ft.
  *Divergence:* canonical `TG.range3d` still uses Euclidean hypot. Unreconciled,
  deliberate, flagged. Do not silently change it.
- **Sight is height, and only height.** Nothing is "opaque by type." Every cell
  has `occ[]`, an occluder height in feet above its terrain. `losVerdict` traces
  the 5e corner lines through 3D and asks whether anything rises above the ray.
- **A hole can never block.** Its top is below the ray. This falls out of the
  arithmetic; no clause enforces it. Gap cells get `occ = 0`.
- **Dead ground is a FEATURE.** Standing on a plateau you cannot see the base of
  your own cliff. Walk to the ledge, or Ready an action. This is why the naive
  ray "over-blocked" in earlier attempts — it was correct.
- **Standing back and standing high are opposite levers.** Backing away from a
  wall raises the ray *at the wall* only when the target is above you. Elevation
  buys you a wall you stand near and loses you one you stand far from.
  A flat ray cannot rise, so a level shot is never helped by stepping back.
- **Ledge peek — amendment, M's ruling 2026-07-11.** Standing *at* a lip you lean
  over it: a corner of the attacker's own square is a **lip corner** when any of
  the three other cells sharing it has an occTop below the attacker's floor, and
  `losVerdict` tries those lip corners as alternate eyes (same eye height) only
  when the honest centre-eye verdict left cover to shave. It does **not** relitigate
  the dead-ground bullets above: one square back from the edge there are no lip
  corners, so the dead ground still stands (step-to-ledge → shoot → step-back stays
  the intended tactic), and flat ground offers no lip corners either — the sideways
  corner-peek-around-a-wall loophole stays closed. The verdict now rides back an
  `eye:{x,y,peek}`; `peek:true` reports when a lip corner won. `losRay(map,a,b,eye)`
  takes the winning eye so the drawn line starts where the ruling looked from.
- **Ledge firing / parapet lean — M's ruling 2026-07-12 (extends the 2026-07-11 lip
  amendment; the field case: shooter eye 25 ft, adjacent traced wall 15 terrain + 7
  occluder = 22 ft, reported 8/8 blocked).** A shooter may lean over an **immediately
  adjacent, target-facing wall** whose top is below the shooter's eye. The lean
  requires a **shared cardinal edge** — at an exact 45° shot both cardinal edges are
  candidates, and **the diagonal cell is never the ignored parapet**. The legal
  exception forgives **only the cell's added `occ` height; its terrain stays solid**
  (`traceTop`): a shallow line clears a low cap, a steep downward line still hits the
  earth berm beneath it, and `losVerdict` rejects an alternate eye whose centre ray
  dies in the ignored cell's terrain. A wall at/above eye height blocks; a wall one or
  more open cells away is traced normally; a target-facing wall **owns the ruling**
  (no corner-graze fallback around it), and lip corners are now filtered to the
  target-facing edge, so the sideways loophole stays closed. Target-side cover grades
  normally. The winning `eye` carries origin + ignored-occluder cell into `losRay`, so
  **the drawn line is the line that authorized the shot**.
  `smoke-ledge-fire.js` freezes eleven clauses (shallow clear · steep berm block ·
  tall/equal block · one-back block · side-wall closure · target-side cover ·
  diagonal never ignored · exact-45 and near-45 edge selection · two-candidate case).
- **Cover grading — Phase 1.5h supersedes the old eight-ray head/feet model.**
  Visibility and partial cover are related but separate questions. The target is sampled
  at **twelve body points**: four inset horizontal corners across lower-body, torso, and
  head/shoulder bands. Target-side blocked samples grade as `0–5 none · 6–8 half (+2) ·
  9–11 three-quarters (+5)`; all 12 blocked anywhere is total cover. A low lip hiding
  only the lower band no longer automatically grants half cover. This is Battle Forge's
  deterministic 3D interpretation of 5e body coverage, not a claim that RAW prescribes
  twelve rays.
- **Attribution by side remains settled (M's ruling, 2026-07-11 round 3).**
  “Cover is what the TARGET hides behind.” A blocker grades cover when it is at least
  as close to the target as the attacker; midfield ties benefit the defender. Strictly
  attacker-side blockers are vantage problems, not bonus AC. The whole segment is walked
  so shooter-side clutter cannot shadow real target-side cover. Total cover still means
  all twelve body samples are physically blocked anywhere. Ledge/parapet alternate-eye
  logic remains intact.
- **Sub-cell cover footprints — Phase 1.5h.** Optional `map.coverShape[]` entries describe
  `full`, `circle`, or `box` footprints inside a cell. Walls/terrain stay full-cell;
  trees, rocks, columns, reeds, mushrooms and similar props receive first-pass narrower
  shapes. Optional `map.creatures[]` supplies living intervening-creature silhouettes;
  dead creatures are ignored, and discovery passes `ignoreCreatures:true`.
- **Occluder heights come from the generator**, not from thin air:
  `map-bridge.BIOME_WALL_UNITS` mirrors `SKINS.wallH` × 5 ft.
  grass 7 · druidic 8 · tundra 7.5 · swamp 6.25 · temple 10.5 · cavern 9.5 ·
  volcanic 8.5 *(placeholder — no SKINS entry yet)*.
  Props: rock 4.5 · tree 5.5 · reed 3.5 · mushroom 2 · column 15.
  Moss, bones, cracks, banners and icicles occlude nothing. Height and footprint are now
  separate contracts; Phase 2 tactical props must keep art, `occFt`, and `coverShape`
  consistent.
- **`smoke-los-cover.js` now has 50 Phase 1.5h cases.** It freezes body thresholds,
  target-side attribution, sub-cell props, creature cover, dead ground, ledge/parapet
  firing, eye metadata, audits and range compatibility. `smoke-cover-calibration.js`
  adds 15 focused cases and `smoke-geometry-sync.js` freezes canonical/inline identity.

---

## §5 · KNOWN BUGS (open)

1. ~~Height-exaggeration slider breaks the map.~~ **Fixed.** It was not two lines:
   `renderField()` rebuilds `world`, but **four** groups hang off `scene` and hold
   a STEP-derived Y — `tokenGroup`, `placedGroup`, `moveGroup`, `sightGroup`.
   All are restaged by `restageForHeight()`: one door for the next thing that grows a Y.
2. ~~Everyone bunches in one spot.~~ **Fixed.** `clusterAround(cells,seed,n,taken,minSep)`
   enforces clear squares between placements, relaxes one square at a time rather than
   returning short, reports the sep it settled for, and commits `taken` only for the
   cells it actually returns — it used to poison the pool on a failed search.
   `PC_SPREAD=1`, `FOE_SPREAD=2`; `foeAnchor`'s preferred band is now 40–90 ft, with
   `anySeen` (15–120 ft, in LoS) still the fallback. Also killed: `pcCells[i]||pcCells[last]`,
   which silently stacked leftover PCs on one square.
   Measured over 60 real seeds: fights opening inside 15 ft **6 → 0**; nearest PC→foe
   minimum 5 ft → 15 ft; median gap inside the party 1 → 2 squares, inside the foes 1 → 3.
   `forge/tests/smoke-placement.js` (19) extracts the real functions from the mock and
   runs them on real generated fields.
3. ~~Sight lines may be invisible.~~ **Fixed 2026-07-13.** The material now uses
   `depthTest:false` with explicit render order, and the browser screenshots show the lines.
3b. ~~Flora is drawn ~2× its occluder height.~~ **Fixed 2026-07-13.** Visual height is
   now derived from the same feet contract: `VIS_HEIGHT(kind,scale) = PROP_FT × STEP/5 × scale`.
   Decorative spread may exceed the solid trunk, but the visually solid mass no longer promises
   more cover than `occ[]`.
3c. **A wall renders 1.4 tiers tall but a token quad is ~1.4 units wide in a
   1-unit cell.** Camera-facing sprites next to walls clip into them. Flora no
   longer lands there (fixed, below); 30% of walkable cells still touch a wall,
   so tokens can still clip. The walls are hard — this is a billboard artifact,
   not a rules failure. Proved: 0/19831 walkable cells are `T_ROCK`; 0 `T_ROCK`
   cells are passable.
4. ~~`smoke-forge-engine.js` throws on `themeKey:"frost"`~~ — **fixed** (→ `tundra`).
   The underlying wart stands: an unknown `themeKey` dies as a `TypeError` at
   `forge-dungeon.js:348` (`TH.lakes` of undefined) instead of narrating. Guard it.
5. ~~topo's inlined generator is stale~~ **Fixed** (`forge-board` branch, task 1):
   the mock's stale inline generator was replaced by canonical `ForgeEngine.generate()`
   → `forge-dungeon.js` → `map-bridge.js`, with wall/prop occluder heights read from
   `MapBridge.wallFeetFor()`/`propFeet()`; verified against `smoke-tiers-rebase.js`
   (32 green) on real seeds.
6. **TOON banding + ink outlines** were tuned against flat lighting; they may
   fight the new AO and cast shadow. Unverified.
7. ~~Trees are 100% wall-adjacent.~~ **Fixed.** `buildTiersField` *required* a wall
   neighbour (`if(edge && rand<0.5)`). Measured: 2082/2082 trees against a wall.
   Now: never adjacent to a wall, biased toward ledges (a neighbour one tier down),
   which keeps the treeline structure the old rule was reaching for.
8. ~~Green trees in winter.~~ **Fixed.** A biome chip changed sky, fog, four lights
   and three cap colours — never the generator, the props, or `sTree()`'s hardcoded
   greens. New `FLORA` table: `kinds` at build time (a kind carries an occluder
   height, so species change on re-forge, not on a chip click — the chip says so),
   `pal` at render time (paint changes immediately), `density` per biome. Kinds added:
   `snowpine`, `bare`, `reed`, `mushroom`. `PROP_FT.bare` was missing and would have
   occluded nothing, silently.
10. ~~Trees had an invisible opaque hitbox.~~ **Fixed.** `THREE.SpriteMaterial`
   defaults `depthWrite:true`. `billboard()` created upright sprites with
   `transparent:true` and **no `alphaTest`**, so the whole quad wrote depth — empty
   texels included — and anything behind a tree disappeared into a tile-wide
   rectangle. `makeToken()` had always passed `alphaTest:0.15`, which is exactly why
   tokens never showed it and props always did. Now one shared `ALPHA_CUT = 0.15`.
   The hand-placed library props (`renderPlaced`) had the same bug. **Not a map
   problem:** `combatMapFromF` writes `wall[]` from terrain only; a prop contributes
   `occ[]`, i.e. cover. `smoke-flora.js` now fails if any upright sprite omits it.
9. ~~`applyLook()` silently undid `LEGACY_PI`.~~ **Fixed.** It ran at boot and on
   every biome chip and assigned the raw `LOOK` intensity literals, so the mock
   rendered π× dark from the moment of the r185 migration. Self-inflicted: the
   π was applied at light construction and overwritten two hundred lines later.
   Every intensity now goes through `LEGACY_PI` inside `applyLook`.
11. ~~Signed-in panel outgrew the screen.~~ **Fixed 2026-07-11** (M's first field
   report on bite 1). `.panel` is fixed and bottom-anchored with, until now, no
   max-height and no overflow — Task 14's foe picker (sign-in-gated, unbounded,
   uncollapsible) grew it past the top of the viewport and shoved seed/rooms/
   loops/decor, the mode chips, and the biome chips off-screen. Read at the
   table as "we lost seed/rooms/paths/biomes." Locally it could never reproduce:
   sign-in doesn't cross origins, so the section simply never rendered — and the
   signed-out branch returned *silently* (a narration-rule violation, also fixed).
   Now: panel viewport-capped + scrollable; bestiary collapsed by default behind
   a toggle whose header always carries the picked count.
13. ~~A dropped realtime channel left the device deaf forever.~~ **Fixed
   2026-07-11** (M's second field report: a foe turn "desynced, tried to fix
   itself, looped until I forced the turn end"). `forge-bus.js` built its
   channel once; on CHANNEL_ERROR/TIMED_OUT/CLOSED (laptop sleep, throttled
   background tab, network blip) it logged one console.warn and never
   resubscribed. Every echo after that was "lost," so the mock's 12-second
   stall watchdog crawled the fight forward in resync steps — the loop M saw.
   Now: capped-backoff resubscribe on a fresh topic, seq-gap backfill of rows
   missed while deaf (safe: the pipeline dedups by seq), and an optional
   `onTransport` hook the mock routes to the combat log — drops narrate at
   the table, not in a console nobody has open. `smoke-bus-reconnect.js` (12)
   drives the real bus through drop/flap/backfill. Include stamp bumped
   `?v=fb2` in both mocks. *Not yet re-field-tested.* Also moved that day:
   the Overseer toolbar (top-left → right-middle; it sat on the forgebar and
   walled off the map panel), and §5.3c got its middle-path fix — tokens
   slide 0.6 world units toward the camera at draw time only (matrixWorld
   mutated in onBeforeRender, restored in onAfterRender), so standees stop
   sinking into adjacent walls while real occlusion still hides them.
   *Both pending M's eyeball.*
12. ~~The session lived only in the URL.~~ **Fixed 2026-07-11.** After **Open the
   table** nothing on screen named the session — no id, no share affordance (only
   "Save for later" copied a link). A second browser had no door into the same
   fight, and the sandbox's own "start combat" (which never creates a session, by
   design) read as broken multiplayer. Now: in-session `.forgebar` badge shows the
   short session id + **Copy join link** (the URL is the invitation), and a
   sandbox-started fight narrates that it is single-device and points at Open the
   table.
14. ~~Mode + biome chips bypassed the session lock.~~ **Fixed 2026-07-11.** The
   Finding-2 lock (rooms/loops/decor/foes + seed/dice/Forge tiers, narrated
   no-ops + disabled controls) never covered the `MODES.forEach` chips, the
   biome chips, or the image-import door (`activateImage` — file pick AND
   stage drag-drop) — a player tap regenerated a LOCAL map mid-fight and
   orphaned every token. All three doors now gate on `SESSION_ID` with the
   same narrated no-op, the chips render inert and look it, and on a
   NON-overseer device the forge/dungeon knob sections leave the panel
   entirely (M: "that should be on the admin side only") behind a one-line
   note; the overseer keeps them, locked. Camera knobs stay live for everyone.
15. ~~A silently lost `move_declared` degraded the move tween to a jump.~~
   **Fixed 2026-07-11.** `forge-bus.js deliver()` has no per-row gap handling,
   so a dropped declare left `forge-board.js` with no `pendingAction.path` and
   the resolve painted as a teleport. Per the protocol's own idiom
   (`attack_resolved` already carries its target), `move_resolved` facts now
   carry `path`; `verbsFor` prefers the declared path and falls back to
   `payload.path`. Old logs (no path anywhere) still jump — unchanged.
   `smoke-forge-board.js` 18 → 20.
16. ~~Every attack/ability echo set `usedAction=true` — a Hex/Bardic bonus ate
   the action, rewind restored position but not action/movement, refresh
   refunded unspent movement.~~ **Fixed 2026-07-11** (M's round-2 field report;
   three bugs, one root cause: economy was local bookkeeping clobbered by a
   slot-blind echo handler). Action economy is now a **derived fact of the
   log**: publishers stamp `slot` ("action"/"bonus"/"free"; Action Surge adds
   `restores:"action"`), `forge-replay.js` derives per-turn `movedFt/usedAction/
   usedBonus` for the active unit (`turnEconomy()`), and the mock's
   `applyLogEconomy()` reconciles `CB.st` from the replayed state after every
   applied event, resync, and turn boot — the echo-clobber block is deleted.
   Legacy slot-less rows default to "action", so old logs replay unchanged.
   Local sandbox `spend()` untouched. `smoke-replay.js` 26 → 35.
17. ~~Refresh refunded the whole turn (movement AND action, every device).~~
   **Fixed (round-3 wave, staged).** §5.16's overlay was correct and dead on
   arrival: the boot path ran `setActiveFromLog → applyLogEconomy()` BEFORE
   `window.__forgeSession` was assigned, and applyLogEconomy's own guard
   (`if(!window.__forgeSession) return`) silently no-op'd — the fix only ever
   fired for mid-session resyncs. Same root, second symptom: `renderHud`'s
   turn gating read `sess=null` during the boot paint, so `iControl` briefly
   computed true for everyone. One move: the session object is assigned the
   moment `catchUp()` settles, before anything paints or derives from it.
18. ~~A dead foe's turn stranded the fight (M forced the turn end at the
   table).~~ **Fixed (staged).** `foeTurn()` hard no-ops on `!u.alive` and
   `endTurn()`'s button gate never fires for foes — nothing ever published
   the dead foe's `turn_ended`. Now: `ForgeBoard.deadFoeSkip(state)` (pure,
   6 smoke cases) names the downed FOE holding the turn; the overseer's
   device publishes a narrated `turn_ended` ("☠ Goblin 3 is down — turn
   skipped") from every applied echo AND once at boot (a fight refreshed
   into a stuck state unsticks itself). Reducer untouched — old logs replay
   identically; the skip is an ordinary fact. Downed PCs are never skipped
   (death saves are theirs — note there is still no death-save flow, that's
   its own bite). Strip chip shows ☠ instead of an hp readout when dead.
19. ~~Attack log leaked the defender's AC.~~ **Fixed (staged), M's ruling:
   stripped across the board** — the log carries roll+mod, adv/disadv, the
   cover word (never the +N), and the verdict; the target number is theirs.
   Three sites (sandbox strike, session netAttack, foe strikePhase). Shield
   lines still print the PC's own AC (players know their own sheet).
20. ~~Swapping the Ves pixel sheet before moving left a ghost sprite at the
   old cell until refresh.~~ **Fixed (staged).** `removeToken`'s corpse
   branch (deliberate: a dead animated body stays where it fell) also caught
   `rebuildVesToken`'s sheet swap — the old sprite stayed orphaned in
   `tokenGroup` while `makeToken` overwrote `u.sprite`. `removeToken(u,force)`
   is the swap door: hard removal; the death path is untouched.
21. ~~Silvery Barbs fired on the party's own hits and rolled a fresh d20 at
   disadvantage.~~ **Fixed (staged 2026-07-12), M's rulings settled: 60 ft,
   full RAW, never offered on your own side's successes.** Four defects, both
   paths (sandbox `pipelineHit` + session `reactionCandidates`/
   `computeReactionExtra`): (i) range 6→12; (ii) reroll was two-fresh-take-min —
   now `sbReroll(orig)` = keep the original d20, roll ONE new, take the lower
   (the session ctx carries `origRoll` so the fact is self-contained and
   replay-deterministic); (iii) the offer gate keyed on the TARGET's side —
   now keyed on the ATTACKER's (`u.side!==attacker.side`), which is what
   actually stopped the own-hit prompts; (iv) the advantage rider existed
   nowhere — now the caster picks a friendly in range (gold-tile overlay;
   click-off or no-eligible self-grants, RAW-legal), bundled as a
   `grant_advantage` **effect on the same `prompt_answered` fact** — no new
   protocol kind, no schema, 20s→staff timeout unchanged. The grant is
   deliberately GENERAL plumbing: `u.advGrant` read by `advPreview`, set by
   `grantAdvantage(unit,reason)`, cleared by the reducer's `consumeAdvGrant`
   on the granted unit's `attack_resolved` — **Help and familiars later are
   one `grantAdvantage(ally,'help')` call, per M.** No 1-minute expiry timer
   (deliberate; combats are short — commented, not built).
   `forge-replay.js` reducer +14 lines, stamp `?v=fb6`.
   `smoke-silvery-barbs.js` (13): reroll arithmetic, gate both directions,
   grant/self-grant, consume, replay determinism. Known SB truth for future
   sessions: the spell is *famously strong by design* — reroll-lower AND the
   rider off a 1st-level slot. "Triggers a lot" is the spell, not a bug.
22. **Hidden/invisibility system does not exist — but its seam does.**
   `foeVisible(u)` (returns `true` today, one TODO-marked function) gates every
   foe glow: turn-red, target-red, select-red. When hidden lands, that function
   is the single plug point — a hidden foe stops glowing without touching the
   colour logic; making its *token* not render is the rest of that future bite.
   Deliberately not stubbed further (the system's shape isn't designed yet).
23. ~~Round 3: heals painted enemies, "wrong target" spam, zero spell tiles in
   production.~~ **Fixed (plan v2 §A/B/C, 2026-07-12d).** Two production facts the
   fixtures never modeled: `structural.spellcasting` is None on every live sheet
   (spells sit under level-keyed `structural.spells` with INCONSISTENT keys —
   `'1'/'2'/'cantrip'` vs `'level2'/'cantrips'`), and the sheet's `damage-only`
   type is the action editor's "roll dice, no attack roll" bucket, NOT "save
   spell" — live sheets file Healing Word / Cure Wounds / Hand of Healing there,
   and bite A's blanket re-kind made heals target enemies. Now: `spellGroupsFrom`
   normalizes both shapes; the SPELL_COMBAT **label** decides the kind (row type
   only picks which numeric fields to trust); no projection → greyed, never a
   wrong-kind live wire; greyed tiles never reach flatActions (the invariant,
   asserted on LIVE kits). Second consumer found by code read: `knownSpellList`'s
   legacy regex missed bare digit keys — also fixed.
24. ~~Every leveled spell tile was uncastable — `kit.res` was `{}`.~~ **Fixed
   (2026-07-12d second wave).** Live slots live in the legacy
   `structural.classFeatures` ledger (`spellSlots {"1":{max}}`, `pactSlots`,
   named resources + `…Die` badges), which `buildResPools` never read. Fallback
   added; pools spend on the same `pipState.spell_N` keys the sheet orbs use.
   Found while building M's upcasting ask — which also shipped: `upcastDmg` +
   `per` scaling in SPELL_COMBAT, slot-chooser strip in the mock, effective
   action carries cost/dmg/Disciple/"(2nd)" label through the untouched
   pending/spend/publish doors. Auto-promotes (with a feed note) when the base
   slot is dry. v2 debts: rays/darts/extra-targets/Aid, Ready-at-level.
25. ~~Crowded fights: clicking a goblin said "wrong target"; clicking the empty
   cell beside him hit him.~~ **Fixed (table round 3b, M's screenshot).** NOT the
   session layer — the mis-resolved attack published cleanly. Token sprites are
   quads 1.5–2 units wide on 1-unit cells and **THREE.Sprite raycasting ignores
   alphaTest**; `combatClick` took intersection `[0]`, so the nearest quad's
   transparent corner ate clicks. Now `pickUnit`: ray-vs-**standee-column**
   closest approach (quads ignored entirely), cell-footprint threshold,
   camera-pitch-proof, hidden units (no sprite) unclickable. The hover tile
   snaps to a hovered standee's cell — **the tile predicts the click exactly**
   (the WYSIWYG contract). `smoke-pick-unit.js` (12) drives M's screenshot
   geometry as known answers.
26. **Shortbow LoS refusals in the open — instrumented, ruling pending (plan v2
   §D).** `explainBlock` now narrates TO THE FEED — named blocker from `F.props`
   at the blocking cell, terrain+occluder feet, corner count — once per
   attacker/target/geometry (`__losExplained`, reset per fight). M table-reads
   one real refusal line, THEN rules on tree occlusion (¾ cap / lower pine occ /
   as-is). No blind geometry fix — §4 discipline. **12g addendum: the 2026-07-12
   table refusals ("out of reach" on every goblin) were NOT LoS — see §5.27 and
   the §7 triage rule. The feed instrumentation is only now genuinely reachable
   for ranged shots; the §D table-read still stands.**
27. ~~Every ranged weapon from the live-derivation path armed as melee — the
   ledge test's real blocker.~~ **Fixed, deployed (`weapon-actions.js` +6,
   2026-07-12g).** `assembleActions` was built for the sheet's dice roller and
   never emitted range, so `forge-kit-derive` defaulted every weapon tile to
   `rng 1` and `reachOK` melee-branched before `losVerdict` ran. `deck()` now
   copies range onto the action for `w.ranged` weapons (item data beats the base
   table — magic bows), **deliberately ranged-only**. Left open by that scoping:
   **thrown-weapon ranged mode** (a dagger keeps its melee identity; no throw
   action yet), **reach weapons** (reach 10 ft → `rng 2` unmodeled; the parser
   comment anticipates it), and the standing **`cbDist` Chebyshev vs
   `TG.range3d` Euclidean divergence** (§4, still flagged, still deliberate).

---


28. **Experimental parallax/landmark masking is broken.** The generated source atlases
    contain a baked light checkerboard/matte in RGB rather than dependable alpha. The v3
    extraction displays white rectangular blocks in the real browser. M's A/B is decisive:
    `?parallax=0&landmarks=0` looks strong. Make those systems opt-in (`=1`) or remove the
    broken derived PNGs from runtime until regenerated with genuine transparency.
29. **Camera opens on the map, not the actor.** `frameField()` resets `cam.tgt` to the
    field centre and fits almost the entire map. `focusUnit()` exists, but drag only orbits;
    there is no terrain pan, follow state, target-pair framing, recenter, or player bounds.
30. **Fog of war does not exist yet.** Camera limits alone are not authority. Build
    party-shared `visibleNow` + accumulated `explored`, keyed to map cells and canonical
    height/LoS; gate enemy sprites/hover/badges/targeting through `foeVisible()`.
31. **The horizon is camera-relative.** Camera orbit is correct (the scene root is not
    spinning), but a fixed painted composition behind an orbiting board can read like a
    model rotating on a studio table. Sky may stay camera-locked; later consider a
    cylindrical or world-aligned horizon panorama.
32. **The generator lacks macro variety and encounter semantics.** It deterministically
    emits a heightfield, but maps still begin from the same broad grammar. Phase 2 is the
    archetype + graph + semantics + constrained elevation + connector + validate/repair
    pipeline in §8 and the 2026-07-13a session record.

## §6 · ART, ASSETS, LICENSING

- **three.js: `topography-test-mock.html` is on r185**, ESM via import map.
  The other three mocks stay on r128 — reference sources, not surfaces.
  three shipped no browser UMD build after ~r160 and deleted `examples/js/` at
  r148, so a classic `<script src>` tag could never have reached `EffectComposer`,
  `GTAOPass` or `N8AO` at *any* version. The import map was the whole upgrade.
- **Lights: ×π.** r128 multiplied every non-physical light by π *in the shader*
  (`irradiance *= PI` under `#ifndef PHYSICALLY_CORRECT_LIGHTS`; Lambert's
  `directLightColor_Diffuse = PI * directLight.color`), and `physicallyCorrectLights`
  defaulted to false. r155 moved that π into JS as `WebGLLights` `scaleFactor` behind
  `useLegacyLights`; r165 deleted both. So r185 is π× darker. `topography-test-mock.html`
  restores it as `LEGACY_PI`, applied to `amb/hemi/sun/rim`. Same multiply → identical
  image. **π is NOT enough for PointLight/SpotLight** — r155 also changed `decay` and
  distance falloff. Torches need their own pass.
- Post-processing is still **not wired**. Pins when it is: `postprocessing@6.39.2`
  needs `three >=0.168 <0.186` (r185 is the ceiling); `n8ao@1.10.3` imports the
  bare specifier `postprocessing` even for `N8AOPass` alone — omit that import-map
  entry and it 404s silently. n8ao failed to load in a sandboxed preview frame;
  `forge/r185-probe-mock.html` diagnoses which kind of failure and offers
  `?cdn=unpkg` / `?cdn=esmsh`.
- **The repo is PUBLIC. Assets must be CC0 or CC-BY.** Nothing else.
  - Good: **Kenney**, **Poly Haven**, **ambientCG**, **Quaternius**, **Kay Lousberg** (all CC0).
  - The Kenney plumbing already half-exists: `assets/library.json`, `CHEST_DEMO`.
- **Do not use ripped game assets.** Wind Waker JS ships Nintendo models and
  textures; its credits *thank* Nintendo, which is not a licence.
- **Epic/Fab.** The 5%-over-$1M royalty is the **Unreal Engine** licence and is
  irrelevant to us — Epic's EULA states that assets from Fab "are not Licensed
  Technology." Fab's Standard License permits any engine, but restricts sharing
  to collaborators via a **private repository**. Our repo is public. Fab items
  offered under an explicit **Creative Commons** licence are the only usable ones.
- The battle mock does not look better because of its renderer. It has no
  shadows and no post-processing either. It looks better because things were
  *drawn* and things *move*. Feel is cheaper than art and buys more.

---

## §7 · WORKING RULES

- **A classic block's top-level `var` is a global. `type="module"` un-globals it,
  and modules are deferred.** Converting `topography-test-mock.html` broke the party
  select twice over: `CHAR` stopped being `window.CHAR`, so every character read
  "NO COMBAT SHEET"; and even once exported, the classic block had already painted
  before the module ran. Fix: explicit `window.CHAR`, a `topo:ready` event, and a
  narrating 6s timeout. **Enumerate every top-level binding against the other blocks
  — a shortlist you invented is not a check.**
- **Grep for every import specifier, not the ones you expect.** `n8ao/dist/N8AO.js`
  imports `three`, `postprocessing`, *and* `three/examples/jsm/postprocessing/Pass.js`.
  That third is a different bare prefix from `three/addons/` even though both resolve
  to the same directory. Missing it throws `Failed to resolve module specifier`, which
  reads like a network error and is not.
- Read actual repo source before editing. *A plausible hypothesis is not a diagnosis.*
- **Refusal triage (pinned 2026-07-12g): read the label before blaming geometry.**
  The three refusals are three different gates — **"out of reach"** = the reach
  gate melee-branched (`a.rng ≤ 1`: the ARMED ACTION's range, an action-shape
  question); **"out of range"** = distance vs the action's range (a `cbDist`
  question); **"no line of sight"** = `losVerdict` (a §4 geometry question, and
  the only one the feed's named-blocker line narrates). The bar's own hint
  leaks the same fact: "click a highlighted target" renders only for
  `pending.rng ≤ 1`. A whole session was nearly spent re-litigating settled
  geometry over a reach-gate refusal.
- **Patcher anchors are verified against a fresh clone of real `main`, not a
  fixture (pinned 2026-07-12g).** The 12f bundle's fixture "carried the reviewed
  code shapes" with single-line formatting the repo doesn't have; three
  count-guards correctly aborted on real main. The guard firing is the system
  working — repair the anchor, never force the replacement. Corollary: a
  whole-body function replacement must carry the original's dated ruling
  comments verbatim; rulings live in-code.
- **`data/characters/*.json` is the live-truth mirror, at most one night stale**
  (`characters-export-nightly` — service-role, complete row). Use it for gear/
  abilities diagnosis before asking M or touching Supabase; only distrust it for
  same-day sheet edits (the 12g fight ran on a Vesperian newer than the export).
- **Never write a synthetic test and call it proof.** Extract the real functions
  and run them on the real generated field. Headless tests that pass while the
  browser stays broken are the failure mode this project keeps hitting.
- mock → approve → build for UX work.
- `node --check` every script block + run the smokes before handover.
- Inlined `tactics-geometry.js` must stay **code-identical** to canonical in
  **both** mocks (comments stripped — the headers already diverge).
- Surgical edits. Never change a theme CSS variable for a per-page issue.
- Failures must narrate. Disabled controls must state why. A character with no
  combat sheet is greyed out, never silently dropped.
- **Deploy workflow changed 2026-07-10:** M now commits and **pushes himself**
  (`git push` = Netlify live deploy). Claude commits only when M explicitly asks,
  and **never pushes**. `.gitignore` hides `.claude/` — never `git add` around it.
- Deploy URL is `trials-of-kirtas.netlify.app`.
- **The fixture-shape rule (pinned 2026-07-12, second offense — and it cuts both
  ways):** any derive-layer smoke that models `structural` must load the REAL
  character JSONs from `data/characters/` alongside synthetic fixtures —
  fixtures are diffed against live data, never against the intended contract.
  The rule then caught the PLAN doc's own known answers (Líadan DC 13 → the
  JSON says 12; +3 heal mod → +2): numbers in a plan are hypotheses until
  diffed against the JSONs. Caveat: the repo JSONs can themselves lag the live
  Supabase rows (M's WIS 13-vs-14 question) — the smokes pin the repo copies.
- **Headless repro before theory.** The round-3 screenshot diagnosis was wrong
  twice; a 40-line node harness against live data was right once and decisively.
  When live behavior contradicts green smokes, reproduce with production data
  before proposing fixes.
- **When a shape bug is found, grep for its second consumer.** Fact 1's repro
  scoped it to `spellTiles`; only the code read found `knownSpellList` quietly
  eating the same inconsistent keys.
- **The repo-as-uploaded must run its own smokes.** Three suites landed with
  `./module.js` require paths that never resolved from `forge/tests/` (a zip-
  layout artifact) and had never been executed in place. Baseline before
  surgery, always.

---

## §8 · SUGGESTED NEXT SESSION

**Current handoff: `CONTEXT_Forge-update-2026-07-13h.md`. Read it first.**

### Release gate for Phase 1.5h

1. Upload the exact Phase 1.5h runtime replacements.
2. Use the guarded patcher to synchronize the current `battle-tactics-geo-mock.html`
   inline geometry.
3. Browser-check 3D and top-down Player View: no checker/triangle fog, no hidden room
   silhouettes, explored memory dark, visible props/lights correct.
4. Recheck low lips, waist barriers, narrow trunks, boulders, intervening creatures,
   ledge/parapet firing, and Cover Contest.
5. Run **Forge → Run cover audit** on multiple real seeds. Tune only from measured field
   evidence, not from one dramatic shot.
6. Run the full repository smoke battery and a two-device session.

### Then begin active Phase 2 generator terrain

1. **Snapshot-first session loading:** exact `mapSnapshot` authoritative; legacy recipe
   fallback for old sessions.
2. **Archetype selector + versioned parameters:** valley, canyon, central hill, ring,
   split plateau, bridge crossing, island chain, courtyard, cavern chambers, temple
   terraces, ridge, basin, plus compatibility `legacy-dungeon`.
3. **Stage ownership:** make `layout`, `height`, `semantics`, `decor`, and `foes` seeds
   actually own independent deterministic streams.
4. **Constrained height assignment:** bounded tiers, no unavoidable low-ground spawn trap,
   mandatory normal-creature route.
5. **First-class connectors:** ramps, stairs, bridges, doors, tunnels, ledges, and fords,
   with movement/access semantics.
6. **Semantic spawns/objectives:** critical path, entrance, boss, side rooms, encounter intent.
7. **Validation and local repair:** connectivity, spawn distance, immediate LoS, cover within
   one move, route count, elevation advantage, choke width, sightline lengths, melee access
   to ranged positions, and objective access. Retry only the failed stage when repair fails.
8. **Debug overlays:** graph, critical path, semantics, height bands, connectors, cover density,
   spawn influence, and reachable routes.
9. **Tactical prop contract:** deepen Phase 1.5h `coverShape` into authored footprint,
   rotation/view art, movement effect, and `occFt`; keep visual-only decoration separate.

### Carried later work

- Hand of Harm post-hit rider.
- Broader condition enforcement and old combat.html condition UI migration.
- AoE templates/affected cells.
- Mid-fight sheet import fact.
- Thrown/reach weapons, opportunity attacks, and generalized Ready/ruling flows.

### Deploy rule

M uploads, commits, and pushes. Do not push without explicit instruction.
