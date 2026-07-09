# CONTEXT — Battle Forge — updated 2026-07-08

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
**C never pushes; M deploys by hand.** Stage files to `/mnt/user-data/outputs/`.

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
| `forge/tests/*` | smokes. 83 green: engine 14 · bridge 16 · geometry 26 · los-cover 27 | canonical |
| `topography-test-mock.html` | **THE surface.** Heightfield + all the geometry + combat loop | active |
| `battle-tactics-geo-mock.html` | flat box-tile combat mock. **The source of the combat system and the feel layer.** NOT superseded — it is the port source | reference |
| `battle-forge-mock.html` | *"the dream one."* generator → tactics diorama. **Source of the pixel sprites + portraits** | reference |
| `battle-forge-biome-mock.html` | **source of the biome art direction.** `SKINS` table: `wallH`, fog, light rigs, particles, flavour scatter | reference |

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
| rewind / snapshot | – | – | ✔ | |
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
- **Cover is graded**, 8 corner-lines (4 corners × head/feet):
  `0 → none · 1–4 → half (+2) · 5–7 → three-quarters (+5) · 8 → total`.
  A 4.5 ft boulder yields ¾. A 10.5 ft temple wall yields total.
- **Occluder heights come from the generator**, not from thin air:
  `map-bridge.BIOME_WALL_UNITS` mirrors `SKINS.wallH` × 5 ft.
  grass 7 · druidic 8 · tundra 7.5 · swamp 6.25 · temple 10.5 · cavern 9.5 ·
  volcanic 8.5 *(placeholder — no SKINS entry yet)*.
  Props: rock 4.5 · tree 5.5 · reed 3.5 · mushroom 2 · column 15.
  Moss, bones, cracks, banners, icicles occlude nothing.
- **`smoke-los-cover.js` (27 cases) encodes all of the above.** If a change
  breaks it, the change is wrong until argued otherwise.

---

## §5 · KNOWN BUGS (open)

1. **Height-exaggeration slider breaks the map.** `hs.oninput` calls
   `renderField()` and never `positionToken()`. Terrain rescales; tokens keep
   their old world `Y`, so they bury or float. Two-line fix.
2. **Everyone bunches in one spot.** `foeAnchor()` prefers the 15–60 ft band and
   `clusterAround()` packs each side around one seed cell. Party needs a loose
   formation; foes need 40–90 ft and their own footing.
3. **Sight lines may be invisible.** Drawn with `LineBasicMaterial`, default
   `depthTest`, so segments passing through terrain disappear. Suspected, not
   confirmed in a browser. Set `depthTest:false` + `renderOrder`.
4. ~~`smoke-forge-engine.js` throws on `themeKey:"frost"`~~ — **fixed** (→ `tundra`).
   The underlying wart stands: an unknown `themeKey` dies as a `TypeError` at
   `forge-dungeon.js:348` (`TH.lakes` of undefined) instead of narrating. Guard it.
5. **topo's inlined generator is stale** (old theme keys). Rebase on
   `forge/forge-dungeon.js` and take `WALL_FT` from `MapBridge.wallFeetFor()`.
6. **TOON banding + ink outlines** were tuned against flat lighting; they may
   fight the new AO and cast shadow. Unverified.

---

## §6 · ART, ASSETS, LICENSING

- **three.js: `topography-test-mock.html` is on r185**, ESM via import map.
  The other three mocks stay on r128 — reference sources, not surfaces.
  three shipped no browser UMD build after ~r160 and deleted `examples/js/` at
  r148, so a classic `<script src>` tag could never have reached `EffectComposer`,
  `GTAOPass` or `N8AO` at *any* version. The import map was the whole upgrade.
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
- Never commit or push. M deploys by hand via GitHub web upload.
- Deploy URL is `trials-of-kirtas.netlify.app`.

---

## §8 · SUGGESTED NEXT SESSION

In order. Do not skip to 4.

0. ~~Upgrade three.js~~ — **done, out of order, for cause.** Steps 2–3 were
   blocked: the port sources were not in the repo. The renderer was the only
   unblocked item, and doing it first means the toon/outline stack gets tuned
   against the final renderer once instead of twice. Confirm `?lightmul=` in a
   browser and bake the constant in.
1. Fix §5.1 and §5.2 (slider, placement). Small, and the map stops lying.
2. Port the **feel layer** from `battle-tactics-geo-mock.html`: badges, hit
   flash, shake, idle bob. Write floating damage text. Fix §5.3.
3. Port **flanking** and **opportunity attacks**. Write **Ready an action** —
   the geometry now demands it.
4. Then: add N8AO + bloom on the proven base, and source CC0 props.
