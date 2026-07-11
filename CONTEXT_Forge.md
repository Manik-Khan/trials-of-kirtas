# CONTEXT — Battle Forge — updated 2026-07-11 (night; field-round-3 wave STAGED, not yet committed — base `b1d7d72`)

> This doc exists because the same failure kept happening: a session would read
> *part* of the material, conclude a feature "was never there," and rebuild
> something the repo already had. The sprites were the worst case — they had
> been sitting in `battle-forge-mock.html` in the repo the whole time.
>
> **The fix is not better prompting from M. It is the protocol in §0.**

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
| `forge/tactics-geometry.js` | **canonical rules module.** Chebyshev, movement reach, climb/fly cliff gate, 3D LoS + graded cover | canonical |
| `forge/map-bridge.js` | generator/heightfield → MAP document `{cols,rows,h,wall,occ,spawns,props}` | canonical |
| `forge/forge-dungeon.js` | generator. **THEMES keys are the biome names**: `grass druidic tundra swamp temple cavern volcanic` | canonical |
| `forge/forge-engine.js` | seeded generate → validated map | canonical |
| `forge/forge-board.js` | translator: wire↔board verbs (turn loop, prompt routing, initiative, overseer toolbar incl. GOD MODE/rewind/Add-foe). Move verbs self-contained: walk prefers the declared path, falls back to `payload.path` (2026-07-11). `deadFoeSkip(state)` — pure dead-foe-holds-the-turn decision; the mock's overseer device publishes the skip (`?v=fb5`) | canonical |
| `schema_delta_forge_board.sql` | append-only migration: `forge_claim_unit()` claim RPC + session visibility for players | **presumed applied to live Supabase** (M's bite-1 field rounds ran two-device, which needs it — confirm with M, do not assert) |
| `forge/tests/smoke-tiers-rebase.js` | rebase smoke: canonical `ForgeEngine.generate()` on real seeds, §4-geometry invariants hold | canonical |
| `forge/tests/smoke-forge-board.js` | known-answer: scripted logs → board-verb sequences (move/attack/turn/prompt/timeout/restore/edit/add_unit/claim-gate) + `deadFoeSkip` decision cases | canonical |
| `forge/tests/smoke-starter-kits.js` | starter action bar from live sheet stats, generic-kit fallback, CHAR alias | canonical |
| `forge/tests/smoke-cover-contest.js` | known-answer: the Cover Contest end-to-end over MemoryBus — ruling/timeout/total flows, replay determinism, culprit geometry, and the overseer-only gate twin (a player forging `prompt_answered{unit:"__overseer"}` is rejected) | canonical |
| `forge/tests/*` | smokes. 335 green (2026-07-11 night): engine 14 · bridge 16 · geometry 26 · los-cover 37 · placement 19 · flora 22 · protocol 56 · replay 35 · tiers-rebase 32 · forge-board 26 · starter-kits 16 · bus-reconnect 12 · cover-contest 24 | canonical |
| `topography-test-mock.html` | **THE surface.** Heightfield + all the geometry + combat loop | active |
| `battle-tactics-geo-mock.html` | flat box-tile combat mock. **The source of the combat system and the feel layer.** NOT superseded — it is the port source | reference |
| `battle-forge-mock.html` | *"the dream one."* generator → tactics diorama. **Source of the pixel sprites + portraits** | reference |
| `battle-forge-biome-mock.html` | **source of the biome art direction.** `SKINS` table: `wallH`, fog, light rigs, particles, flavour scatter | reference |
| `forge/forge-protocol.js` | event vocabulary: 17 kinds, envelope validation. No `turn_started` — derived | canonical |
| `forge/forge-replay.js` | reducer: log → state. Facts only, never rules. Override pre-scan, restore branch, GOD-MODE edit. Since 2026-07-11: per-turn action economy derived from the log (`turnEconomy()`, facts carry `slot`; `undo_of` refunds a retracted move) | canonical |
| `forge/forge-bus.js` | transport: MemoryBus (headless, mirrors the RLS identity+kind gate) + SupabaseBus | canonical |
| `forge/forge-pipeline.js` | acting-client pipeline: declared→resolved, cross-device prompts, timeout→overseer. Since 2026-07-11: `undoMove()` (player retracts own last move, compensating fact) + `contestCover()` (pre-roll cover-contest pause, `FORGE_COVER_CONTEST.md`) | canonical |
| `forge/protocol-harness-mock.html` | two-window Supabase harness, `__forgeState()` dump | mock |

`tactics-geometry.js` is **inlined in two mocks** and must stay **code-identical**
(comments stripped) to canonical in both. Any change ships to three files at once.
It was never byte-identical: both inlines carry an older header comment. The rule
was restated rather than left as an invariant nobody could satisfy.

The topography mock's *inlined generator is an old copy* with the pre-rename
theme keys (`ancient/molten/frost/grim/verdant`). The repo's is current. Rebasing
the mock onto `forge/forge-dungeon.js` is an open task.

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
| **flanking → advantage** | ✔ | – | **✗** | `battle-tactics` ~L1100–1120: `isFlanked()`, `FLANKING` toggle chip, house rule = advantage, not +2 |
| **opportunity attacks** | ✔ | – | **✗** | `battle-tactics` ~L1319–1340: fires mid-move, can drop the mover before they arrive |
| **ready / held action** | ✗ | ✗ | ✗ | **exists nowhere.** Required by the geometry: if you can't see the enemy below the cliff, you Ready |

### Feel — the layer that makes it a game
| feature | tactics | forge | topo | notes |
|---|---|---|---|---|
| move tile telegraph | – | – | ✔ | |
| tweened movement | ✔ | ✔ | ✔ | |
| sight lines drawn | ✔ | – | ✔ | topo's may be `depthTest`-hidden inside terrain — **unverified in browser** |
| **badges over units** | ✔ | – | **✗** | `battle-tactics` ~L1515–1550: DOM badges `✕ no line` · `↑ too high` · `½ cover +2` · `¾ cover +5` |
| **hit flash** | ✔ | ✔ | **✗** | `battle-tactics` L1036 `flashHit()` |
| **camera shake** | ✔ | ✔ | **✗** | `battle-tactics` L1002 `shake()`, gated on `REDUCED` |
| **idle bob** | ✔ | ✔ | **✗** | `bobPhase` L886, applied L1854 |
| **floating damage text** | ✗ | ✗ | ✗ | **exists nowhere.** Must be written |

### Art / render
| feature | tactics | forge | biome | topo | notes |
|---|---|---|---|---|---|
| pixel sprites | ✔ | ✔ | – | ✔ | `SPRITES` + `pixelCanvas()`, 7 keys |
| base64 portraits | ✔ | ✔ | – | ✔ | 4 PCs |
| per-biome light rig | – | – | ✔ | ✔ | `SKINS` / `LOOK` |
| **torch PointLights** | ✔ | ✔ | ✔ | **✗** | topo has the theme data, never builds the lights |
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
- **Cover is graded**, 8 corner-lines (4 corners × head/feet):
  `0 → none · 1–4 → half (+2) · 5–7 → three-quarters (+5) · 8 → total`.
  A 4.5 ft boulder yields ¾. A 10.5 ft temple wall yields total.
- **Grading amendment — attribution by side (M's ruling, 2026-07-11, round 3;
  supersedes the same-day round-2 "2-square radius" version).** M saw an enemy
  standing in the open take +5 from a shot fired down off a ledge: the lines to
  the target's feet were clipped by attacker-side lip / terrain edges. Round 2
  fixed it with a hard 10-ft-of-the-target radius; M rejected the radius as
  absolute ("a wall 3+ squares in front of someone can absolutely still be
  cover — it depends on the height and size of the wall; I'm thinking about
  vantage points"). The rule now: **"cover is what the TARGET hides behind; an
  obstruction on the shooter's side is the shooter's vantage problem (step up /
  lean), not the target's AC."** A blocking cell **grades** cover (half/¾, and
  the centre-line check) when it sits at least as close to the target as to the
  attacker — `chebyshev(blocker,target) ≤ chebyshev(blocker,attacker)`; a
  midfield tie grades (defender's benefit). Strictly attacker-side blockers
  grade nothing. Each corner line's attribution walks the **whole** segment,
  not just the first blocker — shooter-side clutter cannot shadow a boulder
  standing beside the target (also defender's benefit). Wall height/size enter
  through the line count itself; there is no other constant. **TOTAL is
  unchanged**: all 8 lines blocked by anything anywhere is dead ground, so the
  mesa / level-with-the-wall-base / step-back-to-break-LoS cases stand, and a
  mob hull-down behind his own rim correctly keeps ¾ (defilade). Ledge-peek
  alternate-eye logic untouched. Identical in all three `tactics-geometry`
  copies (`segAttrib` + `verdictFromEye`).
- **Occluder heights come from the generator**, not from thin air:
  `map-bridge.BIOME_WALL_UNITS` mirrors `SKINS.wallH` × 5 ft.
  grass 7 · druidic 8 · tundra 7.5 · swamp 6.25 · temple 10.5 · cavern 9.5 ·
  volcanic 8.5 *(placeholder — no SKINS entry yet)*.
  Props: rock 4.5 · tree 5.5 · reed 3.5 · mushroom 2 · column 15.
  Moss, bones, cracks, banners, icicles occlude nothing.
- **`smoke-los-cover.js` (37 cases) encodes all of the above** (was 27; +ledge-peek
  section, then the grading sections re-frozen under round 3 — attacker-side
  terrace, boulder-shadow pair, parapet-by-side pair, hull-down rim — all
  2026-07-11). If a change breaks it, the change is wrong until argued otherwise.

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
3. **Sight lines may be invisible.** Drawn with `LineBasicMaterial`, default
   `depthTest`, so segments passing through terrain disappear. Suspected, not
   confirmed in a browser. Set `depthTest:false` + `renderOrder`.
3b. **Flora is drawn ~2× its occluder height.** `placeProp` draws a tree 2.4 world
   units tall. At `STEP=1.15` that is 2.09 tiers ≈ 10.4 ft, but `PROP_FT.tree`
   is 5.5 ft. The picture says total cover; the rules say three-quarters. §4 says
   the picture may never disagree with the sight lines. The *ratios* between kinds
   are now correct (`VIS()`), the absolute scale is not. Halving it shrinks every
   tree in the project, so it is M's call, not a bug fix.
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

---

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

---

## §8 · SUGGESTED NEXT SESSION

**2026-07-11 (night): M's field round 3 produced a five-item wave — STAGED,
validated, NOT committed** (M deploys). §5.17–20 carry the four bug fixes;
the fifth item is a feature, BG3-style "who is that":

- **Strip nameplate → camera.** Clicking an initiative-strip chip pans the
  camera to that token (smoothstep tween on `cam.tgt`), pulses its cell
  gold, and floats its nameplate. Works for dead units too (pans to where
  they fell; no nameplate without a sprite).
- **Token → nameplate.** Clicking any visible token, on ANY turn from ANY
  device, floats its existing name ("Goblin 3") over it for ~2s — the same
  name the strip tooltip already leaked, no hidden info. Targeting a pending
  action still wins on your own turn; a unit with no sprite (future
  invisibility) can't be raycast or projected, so hiding excludes itself.
- **Canvas-click guard (rode along, latent bug):** the global `pointerup`
  that feeds `combatClick` used to run for HUD clicks too — the ray just
  usually hit nothing useful. The strip chips sit over the arena, so the
  leak would have fired a phantom inspect/move under every chip tap. Board
  clicks now require `e.target === renderer.domElement`.

Suite at **335 green** (§2; forge-board 20 → 26). All five items are
browser-facing — **pending M's eyeball**: refresh mid-turn on both devices
(economy must hold), kill a foe and watch its turn skip + ☠ chip, a log with
no AC anywhere, chip-click pan, token-click nameplate, and that HUD buttons
still behave with the canvas guard in. Files staged: `forge/topography-test-
mock.html`, `forge/forge-board.js` (include stamp bumped `?v=fb5`),
`forge/tests/smoke-forge-board.js`. Also flagged for a future bite: every
foe shares the goblin pixel sprite (`FOE_SPRITE`) — per-mob art is either
more hand-drawn `SPRITES` keys or CC0 stock per §6; and downed PCs have no
death-save flow yet.

**2026-07-10: the multiplayer protocol spine shipped and was field-verified** —
see `FORGE_PROTOCOL.md` (spec) and §2's four `forge-*.js` rows. Two real browsers:
same session, movement/attacks synced, a cross-device Shield prompt turned a hit
into a miss, the duplicate-answer guard observed working live. SQL applied to the
live Supabase. DM-facing rules future sessions must respect: an `override` cannot
reach behind the latest `restore` (use `edit`); sessions stay `status='active'`
while playing and the `session_ended` event is written *before* flipping status;
the harness pops prompts on every controlling window — the real player HUD must
route prompts per spec §4 (player modal; overseer inherits only on timeout).

**Bite 1 MERGED to `main` 2026-07-11, then FIELD-TESTED the same day** — the
marriage: shared dungeon from the session row (§5.5 fixed), full turn loop on the
real board, folder-filtered claim screen, live + staged fight creation, real sheet
stats with curated starter action bars, bestiary foes incl. mid-fight
reinforcements, sheet⇄fight live mirror. M ran real two-device rounds at the table
(which implies `schema_delta_forge_board.sql` reached the live Supabase —
**presumed applied; confirm with M before relying on it**). Multiplayer is dormant
without `?session=`; the single-device sandbox was regression-gated at every step.
Still open from the bite-1 accepted list: Confirm Order doesn't wait for
stragglers (late rolls sort to the bottom — empty seats never block).

**2026-07-11: M's field rounds produced two fix waves, both merged and pushed by
C on M's explicit order each time** (`f28e0bb`, then `b1d7d72` — the deploy-
protocol exception was M's direct instruction, twice; the §7 rule stands).
What shipped, and where the detail lives:

- **Ledge peek** (`f28e0bb`) — lip-corner alternate eyes in `losVerdict`, all
  three geometry copies. §4's dated amendment. Ruling settled.
- **Cover grading by attribution-by-side** (`b1d7d72`, round 3 — round 2's
  2-square radius was M-rejected same day). §4's dated amendment. Ruling settled,
  with **three defaults M may still redline**: (i) attribution walks the whole
  segment, defender's benefit — shooter-side clutter cannot shadow a boulder
  beside the target; (ii) a mob hull-down behind his own rim grades ¾ (defilade);
  (iii) the overseer's fine-undo is a `restore` branch, not an in-place edit.
  Plus one scope cut to bless: no dedicated pre-declare re-rule button (Correct
  last covers resolved shots).
- **Action economy derived from the log** (§5.16) — bonus actions stop eating
  the action; rewind/refresh restore movement and action.
- **HUD undo, session-aware** (§3 rewind row; `FORGE_PROTOCOL.md` §5 dated
  note) — overseer undo/turn-rewind in the old cluster; players undo their own
  last move via a compensating `move_resolved{undo_of}` fact. No schema change.
- **Cover Contest built** per `FORGE_COVER_CONTEST.md` (status flipped in that
  doc; reason field optional/de-emphasized per M). `pipe.contestCover()`, the
  overseer ruling menu, culprit-cell highlight, 24-case smoke incl. the gate twin.
- **Player panel lock** (§5.14) and the **move-tween guarantee** (§5.15).

Suite at **329 green** (§2). Next, in order: **M's field re-check of this wave**
(economy numbers on the HUD, undo affordances, a real contested shot);
**TOKEN_NUDGE + bus-reconnect re-check** — §5.13's fix and the wall-clip nudge
are still *pending M's eyeball / not yet re-field-tested*; then the **bite-2
brainstorm proper** — sheet→actions derivation layer plus the feel-layer ports
(badges, hit flash, shake, bob, floating damage, flanking/OA/Ready, ▶ watch
mode). `FORGE_BOARD.md` §0 still says bite 2 needs its own spec — write it
before building. The older list below stands for the single-device port debts.

In order. Do not skip to 4.

0. ~~Upgrade three.js~~ — **done, out of order, for cause.** Steps 2–3 were
   blocked: the port sources were not in the repo. The renderer was the only
   unblocked item, and doing it first means the toon/outline stack gets tuned
   against the final renderer once instead of twice. Light intensities are
   restored by ×π (see below); still wants a browser eyeball.
1. Fix §5.1 and §5.2 (slider, placement). Small, and the map stops lying.
2. Port the **feel layer** from `battle-tactics-geo-mock.html`: badges, hit
   flash, shake, idle bob. Write floating damage text. Fix §5.3.
3. Port **flanking** and **opportunity attacks**. Write **Ready an action** —
   the geometry now demands it.
4. Then: add N8AO + bloom on the proven base, and source CC0 props.
