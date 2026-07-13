# Trials of Kirtas — CONTEXT

Custom D&D 5e virtual tabletop. Live: **trials-of-kirtas.netlify.app**
Repo: `Manik-Khan/trials-of-kirtas` · vanilla JS/HTML/CSS + Supabase + Netlify + GitHub.
Walled React/Vite/TipTap corner at `journal/`.

Updated: **July 12, 2026 (late night — ledge firing + database character authority live and
table-verified; ranged weapons fixed).** Supersedes the July 11 evening doc (which superseded
July 8 + July 6). The non-Forge sections stand as written there; the Forge section below carries
July 10–12 (protocol → bite 1 field day → the HUD wave → the 12f/12g authority-and-ledge
session). Reconciled sources: the July 11 doc, `CONTEXT_Forge.md` (fifth-session header),
`CONTEXT_Forge-update-2026-07-12d.md` and `-12g.md`, `FORGE_PROTOCOL.md`, `FORGE_BOARD.md`,
`FORGE_COVER_CONTEST.md`.

**Companion doc: `CONTEXT_Forge.md` — read it before touching the Forge.** It carries the port
manifest (what the combat system consists of, and which parts exist where), the settled geometry
decisions, and the open bugs. This doc is the project; that one is the subsystem.

**Deploy rule (changed 2026-07-10): M commits and pushes himself** (`git push` = Netlify live
deploy). Claude commits **only when M explicitly asks**, staging files by name, and **never
pushes**. Otherwise Claude's job ends at validated files + a one-line deploy note.
Cache-stamp every module include (`?v=`) — non-negotiable on iOS.

---

## 🟢 JUST SHIPPED — the Chronicle book (July 8)

The new React Chronicle book replaced the old page as the site's **Chronicle**. It was already
built and feed-wired but unreachable — nothing linked `journal.html`. This session made it live,
folded in the old chronicle's look, and wired it into nav.

### The shape (settled with M via 5 approved mocks)

- **`chronicle.html` = the write surface. The book = the read surface.** Both ride the same
  `feed` table (`channel='chronicle'`). They are not competing systems.
- **Live.** `ChronicleView` subscribes to `feed` realtime (INSERT/UPDATE/DELETE on the chronicle
  channel, INSERT/UPDATE on combat). The story emerges at the table; edits and deletes reflect.
- **Combat is inline, where it happened.** Each fight weaves into the session's narrative at its
  own timestamp, collapsed. It opens to **Round 1 / Round 2 / …**, all rolls in full, each round
  independently collapsible.
- **The Index is the far-left spine.** Clicking it opens a **slim overlay** (~380px) — it does
  NOT push the open session away. Search + Sessions/Authors/Tags/NPCs facets → compact results
  that jump you into the book. Sticky-left; wheel scrolls the shelf; **⟵ Start** returns you.
- **Sections** — a chronicle row with `meta.section:"The Parlay"` renders as an in-stream heading
  and appears in that session's outline strip, alongside its combats.

### Nav (the A/B call, resolved toward A)

| label | path | what it is |
|---|---|---|
| **Chronicle** | `journal.html?view=chronicle` | the new book (deep-links the Chronicle tab) |
| **Feed** | `chronicle.html` | live posting / DM console — where you actually write |
| **Journal** | `journal.html` | the vault |

`nav.js` active-highlighting is now **`?view=`-aware**, since Chronicle and Journal share
`journal.html`. `chronicle.html` was kept (as "Feed") on purpose: the book is read-only until
TipTap replaces Quill as the chronicle composer.

### How rounds are derived (non-obvious — don't re-derive it)

Roll rows carry **no round of their own**. The round signal comes from the `turn` /
`combat_start` events `logEvent()` writes (`result:{type:'turn', round:N}`), which are
non-hidden. `buildFights()` walks each encounter's stream in time order, tracks the current
round from those markers, and buckets rolls under it. Hidden replay rows (moves, `combat_start`)
never reach a player's book. Combat rolls were **already** being archived by `feed-bridge.js`
(session + `encounter_id` stamped, from any page) — the book only had to read them.

### Deletion model

`feed` RLS: authors delete their own chronicle entries; **staff (dm/overseer) delete anything**;
combat rolls are **staff-delete-only** (immutable for players, so replay stays faithful).
The book reflects deletes live; an emptied round collapses.

### Editor: image-by-URL + the `/` menu (Journal / TipTap only)

- `@tiptap/extension-image@3.27.1` — **pinned exact**, because TipTap sub-packages pin
  `@tiptap/core` to an exact version and `^` triggers ERESOLVE. Configured `allowBase64:false`
  (URLs only, no upload); images get `.j-img`.
- **`/` command menu** (`editor/SlashCommand.js` + `SlashList.jsx`). Reuses `@tiptap/suggestion`
  — the same plugin driving `@` and `[[` — so no new dep, no parallel machinery. `SlashList`
  mirrors `MentionList` (same keys, same `.jm-dropdown` classes). Only fires at line start or
  after whitespace, so "and/or" never triggers. Adding a command = one entry in `COMMANDS`.
  Commands: `/image` (aliases pic, photo, url) `/h1 /h2 /h3 /quote /callout /code /divider
  /bullet /numbered /todo /mention /page`.
- **The Feed (`chronicle.html`) runs Quill, not TipTap** — no `/` menu there. Its image-by-URL
  already existed on the toolbar image button (`quill.getModule('toolbar').addHandler('image')`
  → prompt → `insertEmbed`). A Quill slash menu would be hand-rolled; it comes free if TipTap
  ever replaces Quill.

### Files touched (all validated, in the shipped zip)

`nav.js` · `chronicle.html` (staff **+ New Section** button, `newSection()`) ·
`journal.html` (cache stamp) · `journal-assets/journal.{js,css}` (rebuilt) ·
`journal/package.json` + lock · `journal/src/App.jsx` (`?view=chronicle`) ·
`ChronicleView.jsx` (realtime, FightBlock/rounds, IndexOverlay, sections, ⟵ Start) ·
`JournalView.jsx` (Image + SlashCommand) · `editor/Toolbar.jsx` · `editor/SlashCommand.js` (NEW) ·
`editor/SlashList.jsx` (NEW) · `data/supabase-adapter.js` (`subscribeChronicle`,
`loadChronicleCombat`) · `data/bookModel.js` (`buildFights`, `fightsBySession`, `facetCounts`,
`filterBookEntries`, `entryMatches`, `indexActive`, section/tags/mentions on entries) ·
`styles.css`.

Validation: vite build (IS the JSX check) · existing smokes green (book 15/15, journal 81/81,
shelf 62/62) · new known-answer smokes: realtime wiring + reducer 9/9, round bucketing 9/9,
facet/filter 11/11, slash menu 12/12, TipTap image functional 4/4.

### Open / next

- **Not eyeballed in a real browser yet** — logic and structure validated headlessly; the Index
  overlay + outline are a faithful port of an approved mock, but give them a look.
- `prompt()` is the input for both **+ New Section** and `/image` — functional, unstyled.
- **Sections need creating to exist.** The book reads/outlines them; until someone clicks
  **+ New Section** in Feed, no `meta.section` rows exist and the feature sits dormant.
- The real arc: **TipTap becomes the chronicle composer**, retiring Quill in `chronicle.html`.
  The book inherits it for free.

---

## 🔴 UNRESOLVED — Bardic Radio multi-device sync

~30 attempts across several sessions. Goal: host laptop + players' phones playing the same
broadcast audio **in tight enough sync to sound as one in a room**. Ambient pads AND rhythmic
music, so loose sync isn't sufficient. **Aspirational — never used in a live game.**

### The architecture (the mental model that finally got straight)

Three things flow along **three different paths**:

1. **Audio bytes** — Cloudinary → **each device directly**. The host is not an audio pipe.
2. **The clock** — host AND each device **independently** hit `/.netlify/functions/time`
   (NTP-style min-RTT). Nobody gets time from anybody else.
3. **Position** — the ONLY thing the host broadcasts: **anchors** ("channel X is at pos P as of
   shared-time T") over Supabase Realtime. Phones follow via `positionAt(anchor, BardicClock.now())`.

So the host is DJ of **position only**. Room-sync nudge edits the broadcast `pos`, which only
phones consume — it shifts phones relative to the host and leaves the host put.

### THE KEY INSIGHT (M derived this himself)

A phone's disagreement with the host is **two independent clock errors stacked** (host↔server +
phone↔server), and they don't cancel. Sync everyone to **one authority** and it collapses to a
single error measured against the thing that matters. This is essentially **Snapcast**.

- **Host-as-clock (lighter):** phones measure offset against **the host** directly, not Netlify.
  Audio still streams from Cloudinary. Kills the extra hop; targets phone-vs-host.
- **Host-as-relay (full Snapcast):** one point carries audio + clock. Total control, heavier.

**Honest ceiling:** host-as-clock + Web Audio + generous buffering is a legitimate path to "good
enough for a room." What it likely still won't beat: **iOS Safari doesn't always report true
output latency and lacks hardware-grade scheduling determinism.** Sonos/AirPlay only win by
owning hardware/DAC/protocol end to end. We're in the hardest version of this problem (browser,
open internet, someone else's phone). Not missing a trick.

### The fork still waiting for M

- **A) Pursue it properly** — rebuild the clock host-as-clock, lean on Web Audio, buffer generously.
- **B) Sidestep** — headphones, or one speaker + phones for private/remote, or rhythmic music
  host-only (console already supports per-channel host-only routing via `radioMask`). For a D&D
  table this may genuinely be the right call.

M picks the fork rested. **Don't start building until he does.**

### PROVEN (don't re-litigate)

- **Web Audio is the right foundation.** `webaudio-sync-proto.html` locked **completely synced
  across two devices** — synth loop AND a real decoded Cloudinary track. `AudioBufferSourceNode`
  scheduled against a clock, output-latency-compensated: sample-accurate, no seeks, gapless
  reposition, and it hands us `ctx.outputLatency`/`baseLatency`. The proto used raw `Date.now()`
  — both devices read the *same* clock. That is exactly the crux the real system loses.
- **The old mic mock measured truth — once.** `_edits/mock-echo-lock.html` self round-trip gave a
  number M's ear confirmed. But the offset keeps moving; a one-shot measurement goes stale.

### RULED OUT (cost ~30 attempts — do NOT rebuild)

- **Per-device acoustic latency measurement.** Room-vs-track fails on music ambiguity (picket-fence
  of correlation peaks → no clean lock / wrong-beat lock). Self round-trip is a device *constant*.
  `measure()`/`selfTest()`/`roundTrip()` remain in `bardic-echo.js` but are **dormant** — wire nothing.
- **HTMLAudioElement for sync.** `currentTime` decouples from true audible position after a fresh
  seek (readout said 180ms while the ear wanted 5ms). Every seek rebuffers. All the seek/drift/
  relock machinery in `radio.html` exists ONLY to prop this up.
- **Trim/host-offset as the primary fix.** Fine-tunes, not the mechanism; can't chase a target that
  moves per song.
- **playbackRate / time-stretch drift correction.** BANNED (the "56k mp3 texture" was WebKit's
  pitch-preserving stretcher). `driftNudge()` is dead code; do not revive.

### File states

- **`radio.html` — B17.** WA engine behind **`?engine=wa`** (flag OFF = old path, safe). WA mode
  shows a bottom-left telemetry badge: **clock offset · rtt · output latency**.
- **`bardic-player.js` — WA2.** The Web Audio engine. `applyAnchors(payload, masterVol, trimMs,
  forcePos)`; drift auto-resync at 30ms. Decode-to-memory is the cost to watch on long tracks.
- **`bardic-radio.js` — `clk2`.** `BardicClock.sync()` keeps the offset from the **fastest round
  trip ever seen**. Real improvement; does NOT fix two-independent-errors.
- **`bardic-console.html`** — include stamped `clk2`. **`bardic-app.jsx`** — Room-sync host-offset
  slider (persisted `tok-bardic-hostoffset`). **`bardic-echo.js` — E7**, legacy.
- **`webaudio-sync-proto.html`** — the feasibility proof. Keep it; it's the clean two-device rig.

### Field verdict

Even with WA2 + `clk2`: "just doesn't work" — off by a varying amount per song, nudge erratic,
pause/unpause sometimes fixes it. Consistent with two-independent-clock-errors + the iOS
output-latency wildcard. **The telemetry badge is the instrument:** if clock offset now HOLDS
steady song-to-song but audio still drifts, the culprit is downstream (output latency / the two
independent syncs), not the offset jumping.

---

## 🟡 Battle Forge — multiplayer live on the real board; bite 1 field-tested (July 8 → 12)

**`forge/README.md` + `CONTEXT_Forge.md` are canonical for this subsystem.** Read both.
For the cover-contest mechanism, `FORGE_COVER_CONTEST.md`; for the event protocol,
`FORGE_PROTOCOL.md`; for the board marriage, `FORGE_BOARD.md`.

Procedural battle-map generation + the seam that turns a generated map into a rules-enforced
encounter. **Optional layer that extends theatre-of-the-mind — never replaces it.**

### July 12 (late) — ledge firing, database character authority, and the ranged-weapon fix

Fifth Forge session of the day (full record: `CONTEXT_Forge-update-2026-07-12g.md`). Three
things went live, each table-relevant:

- **Ledge firing (M's ruling 2026-07-12, now §4-settled in `CONTEXT_Forge.md`):** a shooter
  leans over an immediately adjacent, target-facing wall below their eye — shared cardinal
  edge required, diagonal never the ignored parapet, and the exception forgives **only the
  occluder, never the terrain berm beneath it**. The winning eye rides into `losRay`, so the
  drawn line is the line that authorized the shot. Eleven-case `smoke-ledge-fire.js` freezes it.
- **Database character authority:** new root `character-combat.js` — HP from `vitals`, AC and
  armor consequences recomputed through the sheet's own `ArmorAC` + `EquipSlots`. **Fail-closed**:
  a stale cached `structural.combat.ac` is never silently substituted; a projection failure
  becomes one loud per-character error kit and the rest of the party still derives. New-fight
  initialization only — active fights stay event-log authoritative until the mid-fight sync
  protocol fact is designed (deliberate boundary, unchanged).
- **The ranged-weapon fix:** the post-deploy ledge test failed with "out of reach" on every
  goblin — the **reach gate**, not geometry. `assembleActions` (built for the sheet's roller)
  never emitted weapon range, so every ranged weapon armed as melee and LoS was never consulted.
  One guarded line in `weapon-actions.js` (`deck()` carries range for ranged weapons) fixed it;
  M confirmed at the table. Refusal-triage rule pinned in `CONTEXT_Forge.md` §7: **"out of
  reach" / "out of range" / "no line" are three different gates — read the label first.**

Process notes that earned their pin: the 12f patch bundle's guards correctly **aborted** on
real main (fixture-verified regexes vs. actual repo formatting — anchors are now verified
against a fresh clone); and `data/characters/*.json` is the **nightly live-truth mirror** of
the Supabase rows, good for diagnosis, stale only against same-day sheet edits.

### July 10–11 — the protocol spine, bite 1, and the field-day fix waves

**July 10:** the multiplayer event protocol shipped and was verified in two real browsers
(`FORGE_PROTOCOL.md`; four `forge-*.js` modules — vocabulary, reducer, bus, pipeline).
**July 11:** bite 1 — the protocol married to the real board (shared dungeon from the session
row, turn loop, claim screen, sheet stats, bestiary foes, sheet⇄fight mirror) — merged to
`main` and **field-tested by M at the table the same day**. His field reports drove two fix
waves, both committed and pushed by C **on M's explicit order each time** (`f28e0bb`,
`b1d7d72` — an exception to the deploy rule by direct instruction, not a new default):

- **LoS rulings settled** — *ledge peek* (standing at a lip you lean over it: lip-corner
  alternate eyes in `losVerdict`) and *cover grading by attribution-by-side* ("cover is what
  the TARGET hides behind"; shooter-side obstructions are a vantage problem, not AC). Both
  dated in `CONTEXT_Forge.md` §4; identical in all three `tactics-geometry` copies.
- **Action economy is a derived fact of the log** — facts carry their `slot`, the reducer
  derives per-turn movement/action/bonus. Fixes three field bugs at once: bonus actions ate
  the action, rewind restored position but not economy, refresh refunded movement.
- **Undo back in the combat HUD, session-aware** — overseer undo/turn-rewind publish protocol
  facts; a player can retract their own last move (compensating fact, no schema change).
- **Cover Contest built** per the approved `FORGE_COVER_CONTEST.md` spec + mock: player
  pre-roll "Contest cover" pauses the attack, the ruling menu opens on the DM's device only,
  the ruling lands in the log as a fact, the culprit cell lights on the board. Reason field
  optional and de-emphasized (M's call).
- **Player panel lock** — mode/biome/import chips can no longer regenerate a local map
  mid-fight; non-overseer devices lose the forge/dungeon knob sections entirely.
- **Move-tween guarantee** — `move_resolved` facts carry their own `path`, so a lost declare
  row degrades nothing.

**July 12 (staged, NOT committed — M deploys):** M's five-item legibility/rules field report;
items 1, 2, 4 built, **3+5 parked as the next session's brainstorm** (handoff written into
`CONTEXT_Forge.md` §8 — start there, mock-first):

- **Sprite legibility** — baked ink half-pixel outlines on every pixel sprite (M approved from
  a standalone mock), plus a side-colored glow system: friendly gold, foe red, always; explicit
  target red wins; the active unit glows on its turn (PC gold, foe red — "so we know which one
  is attacking"), foe glow gated on a `foeVisible()` seam for the not-yet-designed hidden system.
- **Movement telegraph contrast** — reach tiles brightened (teal@0.26 → cyan@0.42).
- **Silvery Barbs → full RAW, both paths** — 60 ft, keep-original-reroll-take-lower, offer gate
  keyed on the ATTACKER's side (own-side hits never prompt), and the advantage rider built as
  GENERAL plumbing (`advGrant` / `grantAdvantage()` / reducer `grant_advantage` effect on the
  existing `prompt_answered` fact — no new protocol kind, no schema) so **Help and familiars
  later are a one-line call**, per M. Full story: `CONTEXT_Forge.md` §5.21–22 + the approved
  spec `2026-07-11-silvery-barbs-raw-design.md`.

Forge smokes: **335 green** on `main` + this wave's 22 staged (SB 13, glow-color 9); replay
regression 35/35. Detail, per-bug history, and the three
defaults M may still redline live in `CONTEXT_Forge.md` (§4, §5, §8).

```
params ─▶ forge-engine ─▶ (map-bridge contract) ─▶ tactics-geometry ─▶ combat
             └─ uses forge-dungeon (generator core)
```

- **`forge-dungeon.js`** — generator core, extracted verbatim from
  `majidmanzarpour/threejs-procedural-dungeon`. **MIT attribution required everywhere it appears.**
  Its `THEMES` keys **are the biome names**: `grass druidic tundra swamp temple cavern volcanic`.
- **`forge-engine.js`** — `ForgeEngine.generate(params)` returns a finished, **verified** map.
- **`map-bridge.js`** — the seam → `{cols, rows, h[], wall[], occ[]}` + `spawns`, `props`, `meta`.
- **`tactics-geometry.js`** — combat rules (movement, cliffs, LoS, cover, ranges). Canonical.

### ⚠ The word "bridge" has cost this project real time

`map-bridge.js` bridges the generator to the **map document**. It does *not* bridge the generator
to the **combat system**. When M says "port the battle mock," he means the combat system:
flanking, opportunity attacks, hit flash, badges, damage floaters, Ready-an-action. That list
lives in `CONTEXT_Forge.md` §3 as a **port manifest with source line numbers**. Work the manifest.

### `occ[]` — the July 8 geometry fix (settled; do not relitigate)

Sight is **height, and only height**. Nothing is opaque by type. Every cell carries `occ[]`, an
occluder height in feet above its terrain, and `losVerdict` traces the 5e corner lines through 3D.

- **Distance** = Chebyshev hypotenuse: `max(horizontal_squares, vertical_tiers) × 5`.
  *Divergence:* canonical `TG.range3d` still uses Euclidean hypot. Unreconciled, deliberate.
- **A hole can never block** — its top is below the ray. Falls out; no clause enforces it.
- **Dead ground is a FEATURE.** From a plateau you cannot see the base of your own cliff. Walk to
  the ledge or Ready an action. Earlier attempts "over-blocked"; they were correct.
- **Standing back and standing high are opposite levers.** Backing off a wall raises the ray *at
  the wall* only when the target is above you. A flat ray cannot rise.
- **Cover is graded** — 8 corner-lines (4 corners × head/feet): `0 none · 1–4 half (+2) ·
  5–7 three-quarters (+5) · 8 total`. A 4.5 ft boulder = ¾. A 10.5 ft temple wall = total.
  **Two dated July-11 amendments** (M's table rulings — `CONTEXT_Forge.md` §4 is canonical):
  *ledge peek* (lip-corner alternate eyes) and *attribution by side* (only blockers at least
  as close to the target as to the attacker grade half/¾; total is unchanged).
- **Occluder heights come from the generator**, not thin air: `map-bridge.BIOME_WALL_UNITS`
  mirrors `SKINS.wallH` × 5 ft. Props: rock 4.5 · tree 5.5 · reed 3.5 · column 15. Moss, bones,
  cracks, banners occlude nothing.
- `forge/tests/smoke-los-cover.js` (37 known-answer cases as of July 11) encodes all of the above.

⚠ **Inline-copy sync rule:** `tactics-geometry.js` is inlined in **two** mocks —
`battle-tactics-geo-mock.html` **and** `topography-test-mock.html`. Three copies total, all
**code-identical** (comments stripped; the inlines carry an older header). Change one, change all three.

Tests (all in `forge/tests/`, **329 green as of July 11** — full per-file counts in
`CONTEXT_Forge.md` §2): engine 14 (frost→tundra fixed), bridge 16, geometry 26, los-cover 37,
placement 19, flora 22 (placement/flora extract the real functions from the mock), protocol 56,
replay 35, tiers-rebase 32, forge-board 20, starter-kits 16, bus-reconnect 12, cover-contest 24.
- **Flora:** `FLORA[biome]` — `kinds` at build time (a kind carries an occluder height), `pal` at render
  time (a biome chip retints instantly; species need a re-forge). Walls are hard: 0/19831 walkable cells
  are `T_ROCK`. Trees no longer plant against walls — they used to, 100% of the time, by construction.
- **Grid:** per-cap 1×1 instanced quad, live opacity slider, no rebuild.
- **Watch:** `applyLook()` must multiply every light by `LEGACY_PI`, or the mock renders π× dark.
- **Watch:** every upright `SpriteMaterial` needs `alphaTest: ALPHA_CUT`. `depthWrite` defaults true, so
  without it a transparent sprite writes depth over its whole quad and hides whatever stands behind it.

### The four mocks — which is which (none are superseded)

| file | what it holds |
|---|---|
| `topography-test-mock.html` | **THE surface.** Heightfield, LoS/cover, reactions, rewind, sight lines |
| `battle-tactics-geo-mock.html` | flat box-tile combat. **The port source for the combat system + feel layer** |
| `battle-forge-mock.html` | *"the dream one."* generator → tactics diorama. **Source of the pixel sprites + portraits** |
| `battle-forge-biome-mock.html` | **source of the biome art direction** — `SKINS`: `wallH`, fog, light rigs, particles |

The Forge was rebased from `battle-forge-mock.html` onto `topography-test-mock.html`. The rebase
carried the geometry across and **left the renderer and the combat system behind.** That is the
whole story of the missing sprites, the missing flanking, and the missing feel.

### Open

- **Bugs:** ~~height slider~~ fixed (`restageForHeight()` — four groups held a STEP-derived Y, not one);
  ~~placement bunching~~ fixed (`minSep` spread + 40–90 ft foe band; 6→0 fights opening inside 15 ft
  over 60 seeds); sight lines may still be `depthTest`-hidden inside terrain (§5.3, unverified in browser).
- **Not ported:** flanking → advantage, opportunity attacks, DOM badges, hit flash, camera shake,
  idle bob, torch PointLights.
- **Exists nowhere:** Ready an action (the geometry now demands it), floating damage text,
  post-processing.
- ~~topo's inlined generator is stale~~ **fixed in bite 1** — the mock now runs canonical
  `ForgeEngine.generate()` (`CONTEXT_Forge.md` §5.5; `smoke-tiers-rebase.js` 32 green).
- ~~Agreed next build: wire Forge to load a generated map + character-select entrance~~ —
  **that was bite 1, shipped July 11** (see the July 10–11 section above). ~~Next: the bite-2
  spec~~ — **written and design-approved 2026-07-12: `2026-07-12-forge-bg3-hud-design.md`**, the
  full BG3 HUD pass (battle.js bar extended bottom-center off a sheet→actions derivation layer;
  the Chat Feed as the combat log, bottom-right; uniform full-math rolls, no AC ever). It absorbs
  the sheet→actions half of bite 2; the remaining feel-layer ports stay their own bite. Next
  session: M reviews the spec, then build in its §6 bite order. `CONTEXT_Forge.md` §8 carries
  the handoff; M's table eyeball of the July-12 glow/SB wave is still outstanding alongside it.

---

## Art, assets, licensing (Forge and site-wide)

- **three.js: `topography-test-mock.html` runs r185** (ESM + import map). The other three mocks
  stay on r128 — reference sources, not surfaces. three shipped no browser UMD build after ~r160,
  so a classic `<script src>` tag could never reach `EffectComposer`/`GTAOPass`/`N8AO` at any version.
- **Lights are ×π at r185.** r128 applied π in the shader (`irradiance *= PI`); r155 moved it to JS
  behind `useLegacyLights`; r165 deleted it. `topography-test-mock.html` restores it as `LEGACY_PI`
  on `amb/hemi/sun/rim` — same multiply, identical image. π does **not** cover PointLight/SpotLight.
- **Post-processing is still not wired.** Only `topography-test-mock.html` enables a shadow map.
- **Module gotcha:** topo's renderer block is now `type="module"` — deferred, and its top-level
  `var`s are not globals. It exports `window.CHAR` and fires `topo:ready`; the classic party-select
  block waits for that event. `n8ao` needs `three/examples/jsm/` mapped as well as `three/addons/`.
  Pins when post lands: `postprocessing@6.39.2` needs `three >=0.168 <0.186`; `n8ao@1.10.3` imports
  bare `postprocessing` even for `N8AOPass` alone.
- **The repo is PUBLIC. Assets must be CC0 or CC-BY. Nothing else.**
  - Good: **Kenney**, **Poly Haven**, **ambientCG**, **Quaternius**, **Kay Lousberg** (all CC0).
    Kenney plumbing already half-exists: `assets/library.json`, `CHEST_DEMO`.
  - **Never use ripped game assets.** Wind Waker JS ships Nintendo models/textures; its credits
    *thank* Nintendo, which is not a licence.
  - **Epic/Fab:** the 5%-over-$1M royalty is the **Unreal Engine** licence and is irrelevant —
    Epic's EULA states Fab assets "are not Licensed Technology." Fab's Standard License restricts
    sharing to collaborators via a **private repository**. Ours is public. Only Fab items under an
    explicit **Creative Commons** licence are usable.
- **The battle mock does not look better because of its renderer.** It has no shadows and no
  post-processing either. It looks better because things were *drawn* and things *move*. Feel is
  cheaper than art and buys more.

---

## Firm working rules (enforced; keep enforcing)

- **🔴 NEVER claim something doesn't exist without searching for it.** This is the single most
  expensive failure in this project's history. In the July 8 Forge session Claude told M the
  pixel sprites "were never there" — they were sitting in `battle-forge-mock.html`, in the repo,
  named in this doc on the "Battle Theater arc" line. Claude also failed to open `CONTEXT.md`
  for four turns *while it was attached to the conversation*, then explained the omission as
  though the file hadn't been provided. It had.
  - Read **every** attached file, including ones whose contents aren't expanded inline. They are
    on disk at `/mnt/user-data/uploads/`.
  - The repo is **public**. Pull it:
    `curl https://raw.githubusercontent.com/Manik-Khan/trials-of-kirtas/main/<path>`
    (the GitHub tree API rate-limits from the sandbox; fetch files directly.)
  - "X doesn't exist" is a claim about **the repo**, not about your context window. Grep first.
  - **M is entitled to ask "did you grep that?" and the answer must be yes before the claim.**
- **Read the live repo source before editing.** Fetch if not provided
  (`raw.githubusercontent.com/Manik-Khan/trials-of-kirtas/main/...`). **A plausible hypothesis is
  not a diagnosis.** Most of the ~30 radio attempts' wasted motion came from theorizing instead
  of reading. (July 8: reading first is what revealed the book was already feed-wired and merely
  unlinked — the task was 1/10th the size it looked.)
- **A headless test that passes while the browser stays broken is not proof.** Extract the *real*
  functions and run them on the *real* generated field. The Forge burned a full session on
  synthetic geometry tests that passed 17/17 while every shot in the browser read "no line of
  sight." Instrument reality.
- **Mock → approve → build** for anything UX/architectural. Standalone, no-deps, renders on its
  own. Five mock rounds settled the Chronicle before a line of real code; M's field use killed
  the full-panel Index in one pass.
- **Validate before handover:** `node --check` on JS; for `.jsx`, the **vite build IS the check**
  (`@babel/parser` also works); jsdom smokes for wiring; headless known-answer smokes for logic.
- **Surgical, flag-guarded edits.** New paths behind flags (`?engine=wa`) so the working path is
  untouched and risk is zero when off. Optional callbacks keep older call sites compatible.
- **Don't add machinery ahead of data.** When M says the solution is simpler than the model,
  field-test the simple version first. M's field reports are ground truth.
- **Cache-stamp every module include; bump on change.** Stale iOS cache masquerades as bugs.
- **Failures must narrate** (disabled/greyed UI reads as broken).
- **Never change a theme CSS var to fix a per-page issue** (clear the override chip instead).
- **`scrollIntoView` is banned in the Chronicle shelf** — it scrolls the page, not the container.
  Move `.sh-shelf.scrollLeft` / the panel's own `scrollTop` by computed offset.
- Claude never commits/pushes; M deploys manually.

---

## Stable ToK systems

Roles: overseer / dm / player. Party: Cosmere Runestar (`cosmere`/ianakira), Caim (jayvanmidde),
Líadan (nazanroseaktas), Vesperian Vale (thebraveruby, M's character). DM: hagakuredisc.
Supabase tables: `profiles`, `encounters`, `combatants`, `characters`, `journal_pages`,
`journal_refs`, `entities`, `entity_aliases`, `journal_comments`, `drawings`, `scenes`, `feed`,
`campaign` (one row, `current_session`), `session_titles`.

- **Character sheet v11** (`sheet-v2.html`/`sheet-mount.js`) — primary play surface; full rolling
  (`dice-engine.js`), gear manager, combat float, appearance system, rest/hit-dice.
- **Soul Shards charactermancer** (`shards.html`, `soul-shards-*.js`) — full builder off the
  5etools 2014 JSON mirror; multiclass spellcasting, provenance-colored spell picker.
- **Chronicle book + TipTap journal** (walled `journal/` Vite+React) — see the top section.
  `tokMention`/`pageLink` nodes, backlinks, `/` menu, image-by-URL. Gotcha: `nav.js` publishes
  `characterKey` (camel) vs DB `character_key` (snake) — grep `profile.character_key` when
  touching identity.
- **Feed** — the append-only spine. `channel` = `chronicle` | `combat`. `feed-bridge.js` posts
  every HUD roll (session + `encounter_id` stamped) from any page. `feed-render.js` draws rolls.
- **Combat/rail** — site-wide right rail (`rail.js`), `advance_turn()` RPC, monster integration,
  `combatants-backend.js` shared by `combat.html`/`party.html`. **The right edge belongs to the
  rail** — don't put drawers there (this killed the first Index placement).
- **Theming** — CSS custom props from `look-derive.js`, settings flyout, per-page/per-player scope.
- **v11 visual language:** dark teal-green `#182826`, Playfair Display / Oswald / EB Garamond,
  hard edges, grain+vignette. Origin colors: gold=class, teal=subclass, red=race, purple=feat.

## Personal / adjacent (context, not ToK)

Hindustani sarod (Maihar gharana, AAK lineage). Obsidian "Codex" vault. AACM director (San
Rafael); PayPal→QuickBooks IIF converter; Supabase+Stripe lesson-scheduling app; Vilambit audio
practice tool; music archive (FileMaker→Postgres) scoped. **Separate projects — don't pull them
into ToK work.**
