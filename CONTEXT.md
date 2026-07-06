# CONTEXT.md — Trials of Kirtas
Updated: July 6, 2026 — TWO arcs merged into one doc:
  • DAY  → the Battle Theater arc (three HD-2D combat mocks, a dungeon
           that introduces itself, and a boss who got whomped)
  • NIGHT → the Echo Lock arc (radio sync-trim: steppers, re-lock, and a
           self-test that measures the wrong thing — READ THE OPEN
           QUESTION FIRST; the whole approach wants a fresh look)
This file supersedes BOTH prior July 6 CONTEXT.md drafts. Replace with this.

────────────────────────────────────────────────────────────
## ⚠ READ FIRST — THE ECHO LOCK OPEN QUESTION
The radio sync-trim work in the night session went down a path M is rightly
skeptical of. Before touching it again, sit with this:

- **The DEPLOY URL is `trials-of-kirtas.netlify.app`** (NOT
  tok.manikkhan.com — that host was stale in C's head all session; the ToK
  skill still says the old host too, so trust this line). GitHub `main`
  **is** the Netlify publish source.
- **The number that matters** (M's closing field data): the B8.2 phone
  self-test reads a STABLE +161ms. But the ORIGINAL feasibility mock
  (mock-echo-lock.html, the two-peak acoustic one) read phone ~280ms,
  laptop ~120-140ms, and **those FLUCTUATED**. A device's own output
  latency is near-constant; fluctuation means that mock was measuring the
  ROUND TRIP THROUGH THE ROOM (flight time + reflections), not just the
  device. Earlier still, that same acoustic mock gave M 111ms and his ear
  confirmed 111ms in-sync.
- **The likely lesson**: the "old auto tuner that worked every time" was
  room-relative (single capture, phone-vs-actual-room-audio), which is
  STRUCTURALLY DIFFERENT from B8.2's device-only self-test. M said three
  times, in three phrasings, "the phone testing itself will always be
  wrong, the host is the timekeeper." **He was pointing at something real
  and C kept adding machinery instead of hearing it.**
- **Recommended fresh-session opening move**: do NOT extend B8.2. Instead
  re-derive from scratch what quantity actually needs measuring. Strong
  candidate: the phone measures its offset against the ROOM's audio (the
  laptop's sound arriving through the air) in ONE capture, correlated
  against the track PCM at the shared-clock position — i.e. the
  `BardicEcho.measure()` acoustic path that was BUILT but got abandoned
  when the chirp buried the room. The fix for THAT (chirp masking, E3)
  may never have actually run on M's phone due to a possible stale cache
  (the module was bare-src un-stamped until E4). **The abandoned path may
  have been right and killed by a caching artifact, not a real failure.**
- M's simpler model deserves a real hearing: tune in → measure against the
  room → set trim → done. If the console-broadcast subtraction (B8.2)
  isn't needed for M's actual setups, COLLAPSE to the simple version.

Do not re-litigate this in a tired state. Fresh eyes, re-measure, decide.

## DEPLOY STATE
- **Radio sync work (night arc): NOTHING from this session is confirmed
  live.** Last confirmed-live radio.html had NEITHER steppers NOR re-lock
  (C verified against `raw.githubusercontent.com/.../main/radio.html`
  mid-session: main had no `relockGate`, no `trimSteps`). So M's field
  tests of "relock" ran WITHOUT the relock patch actually deployed —
  inconclusive.
- **STAGED BUT NOT ENDORSED — the B8.2.1 zip** (tok-bardic-echo-lock-
  B8-2-1.zip): radio.html, bardic-echo.js (E5), bardic-app.jsx (B8),
  bardic-bus.js, bardic-console.html. M has NOT tested it and the whole
  approach is in question (see OPEN QUESTION). **Do not urge deploying
  this.** It may be superseded by a rethink.
- **Battle Theater work (day arc): NOT deployed.** Three exploratory
  mocks, outputs-only, none committed to the repo.
- **tok-bardic-trim-routing-B7**: still UNCONFIRMED from July 5 — M to
  verify it landed before the next bardic wave. ⚠ REFRESH THE CONSOLE TAB
  if it did.
- **Baseline still stands from July 5** (unchanged by either July 6 arc):
  wash lore+npcs live, Bardic wave A + radio B.6.2 live w/ heartbeat,
  rail-dock v3 + v7 badge live, supabase-keepalive in.

## WHAT WAS BUILT — July 6 NIGHT (radio sync-trim / Echo Lock arc)
Chronological, so the reasoning is legible:

1. **Steppers + finer slider** (radio.html): trim slider step 10→5, plus a
   −25/−5/+5/+25 button row (press-and-hold repeat) under it. Reason:
   the ±500 slider is too coarse for a thumb on a phone. Refactored the
   trim handler into ONE `setTrim()` funnel (clamp→paint→persist→one
   clean settle-seek) — every trim source routes through it. SOLID, keep
   regardless of what happens to echo lock. Smoke: steppers 9/9.

2. **Re-lock after track change** (radio.html driftLoop): M's real pain
   was "every track change throws the sync off, I keep re-seeking." Root
   cause: the load-time seek lands 100-400ms off — AUDIBLE on rhythm but
   INSIDE the 0.45s drift deadband, so it persisted the whole track. Fix:
   `relockGate(p,err,nowMs)` — 12s window after each track change, gate
   tightens to 80ms / 2.5s spacing / max 3 corrective seeks, lock-under-
   80ms ends early. Telemetry shows "±212ms · locking" → "locked". PURE
   function, smoke extracts it from source. Smoke: relock 15/15. SOLID,
   keep — but NOTE it was never confirmed deployed, so M hasn't really
   field-tested it. This alone might fix most of M's track-change pain.

3. **Echo Lock feasibility mock** (mock-echo-lock.html, outputs): play a
   known irregular chirp, record mic, envelope cross-correlate → round-
   trip latency + confidence + drawn curve. **M ran it: 73/74/73ms, peak
   0.99, ×2.3-2.5, spread 1ms. iOS honored echoCancellation:false.**
   THIS PROVED THE PHYSICS. (But note: this measured phone SELF round
   trip in a quiet moment — see feasibility vs. the fluctuating acoustic
   numbers above; the distinction is the crux of the open question.)

4. **Echo flow mock** (mock-echo-trim-flow.html, outputs): UX preview of
   the auto-trim button — listening state, dual-measurement card, apply,
   smooth-track failure path. Simulated numbers.

5. **bardic-echo.js — the module** (evolved E1→E5 across the session):
   - Pure DSP: makeChirp / envelope / xcorr (E3 gained a ref-side mask) /
     trimFrom. Smoke extracts these FROM the file (the `label` scar).
   - `measure()` (the ACOUSTIC path, E1-E3): one capture, two questions —
     ROOM (correlate capture vs track PCM at shared-clock pos) and SELF
     (correlate the chirp). trim = self − room. **THIS IS PROBABLY THE
     RIGHT IDEA.** It got abandoned because on M's phone it failed with
     "correlation ran but peaked low, peak 0.26 ×1.1" — diagnosed as the
     phone's own chirp (zero distance) burying the laptop across the room.
     E3 added chirp-span MASKING + 4s capture to fix exactly this. **BUT
     the module was bare-src un-cache-stamped until E4, so M's phone may
     have run STALE code and E3's mask may never have executed.** Also the
     duck used `volume=0` which iOS IGNORES on media elements (must use
     `.muted=true`) — so during acoustic runs the phone played its own
     copy into its own mic. Both are FIXED in the file now but never
     cleanly field-tested in isolation.
   - `selfTest()` (E4, the B8.2 pivot): device-only self round trip, no
     music/duck/PCM. Runs at tune-in. **This is the path M is skeptical
     of** — a pure self number can't know the host's output latency.
   - `summarize()` (E2): failure taxonomy pcm/weak/edge so a CORS block
     never masquerades as "not rhythmic enough." KEEP this idea.

6. **B8.2 — self-chirp both sides** (radio.html + bardic-app.jsx +
   bardic-bus.js + bardic-console.html): the pivot M green-lit then
   questioned. Console gets a 🎙 chip that self-tests the LAPTOP and
   broadcasts `roomLatencyMs` in anchors; phone self-tests at tune-in;
   trim = phoneSelf − consoleRoomLat. Contract in bardic-bus.js header.
   BARDIC_BUILD B6→B8. Auto-runs at tune-in (the tap = mic gesture).
   Cache-stamps + visible build tags added (echo E5 · radio B8.2.1).
   **M's field result: phone self stable +161, but this doesn't match the
   fluctuating room-relative numbers or his ear. Approach in question.**

7. **B8.2.1 — the ear-bias learner** (radio.html): C's attempt to patch
   the self-vs-ear gap (machine +158 vs ear +111) by learning the delta
   when M nudges steppers after a lock, persisted per device. **M pushed
   back HARD and correctly**: this is epicycles on a wrong model. Do not
   defend it fresh. It's staged but suspect.

## WHAT WAS BUILT — July 6 DAY (Battle Theater arc, exploratory, NOT deployed)
**The Battle Theater arc**: three standalone HTML mocks exploring
HD-2D combat visualization (Breath of Fire / FE / FFT direction).
All self-contained (Three.js r128 via cdnjs + Google Fonts only),
Phantom/v11 chrome, prefers-reduced-motion respected, none in repo.

1. **battle-theater-mock.html** — BoF-style side-view theater. Pixel
   sprites billboarded over a painted 3D diorama (parallax silhouettes,
   fog, torch pool, motes, grain+vignette). Fake combat loop with
   5e-shaped math (d20+mod vs AC, crits double dice), initiative strip,
   action dock, melee/ranged choreography, floating damage numbers.
   Baked data. M's verdict: "quite cute," legit use case.
2. **battle-tactics-mock.html** — FE/FFT grid diorama, 14×10 at 5ft
   squares, raised ledge (visual-only elevation), pillar/crate blockers,
   orbiting camera (45° steps, sprites re-billboard). **REAL SHEET
   DATA**: party pulled from repo character JSONs 2026-07-05 —
   Cosmere (Wlk2/Sorc1, EB +5 1d10+3 w/ Agonizing folded), Caim
   (Monk 3, SPD 40, Flurry, Hand of Healing), Líadan (Bard 4, SPD 20,
   Mockery DC12, Healing Word), Vesperian (EK 3, Second Wind, LIVE
   vitals 24/31). Portraits embedded base64 in turn strip. BFS move
   ranges from real speeds, Chebyshev action ranges, goblin AI.
   M played it, won, lost two members.
3. **battle-forge-mock.html** — THE DREAM ONE. Procedural dungeon
   generator (core extracted VERBATIM from
   github.com/majidmanzarpour/threejs-procedural-dungeon src/main.js,
   MIT © 2026 Majid Manzarpour — attribution in file header + UI chip;
   same repo as the July 5 dungeon-cartographer mock in the other chat)
   feeding the tactics diorama live. Seed + 5 theme chips + Forge →
   instanced floors/walls in theme palette, props (graves, sarcophagi,
   chests, banners, boss crystals), wall torches (4 real lights near
   staged room, rest billboard flames), generator's own dungeon names.
   Encounter dropdown lists rooms by depth/type → Stage seats the party
   at the doorway nearest the entrance (via generator's BFS field) and
   casts foes on the generator's OWN spawn marks, tier→goblin/archer,
   chief promoted in boss rooms. Camera frames room + follows active
   unit. **Move-undo added** (M's field note from mock 2). Boss got
   whomped.

Validation this arc: node --check on every extracted script;
theater dice-notation bounds 6/6; tactics grid smokes 11/11 (BFS,
path contiguity, obstacle avoidance, speed truth, range math);
generator determinism 15/15 (5 themes × 3 seeds, headless); staging
smokes 180/180 (every room of 4 seeds × 5 themes: 4 distinct walkable
party seats, foes unblocked/distinct, chief leads boss rooms).

## LESSONS PINNED (Echo Lock arc)
1. **A stable number and a fluctuating number measure DIFFERENT THINGS.**
   Phone self-test = stable (device latency). Old acoustic mock =
   fluctuating (room round trip). When M said the phone-only test "will
   always be wrong," the fluctuation data backs him. LISTEN to the ear as
   an instrument — it measured the true quantity all along.
2. **Un-cache-stamped modules on iOS = you may be testing ghosts.** The
   whole "E3 mask didn't fix it" conclusion is UNRELIABLE because the
   module was bare-src until E4. Cache-stamp BEFORE concluding a fix
   failed. (This is already a STANDING RULE — it was violated here.)
3. **iOS ignores programmatic `volume` on media elements; use `.muted`.**
   Hardware buttons own volume. Cost three confused field rounds.
4. **iOS honors `echoCancellation:false`** (peak 0.99 proved it) — raw
   mic while playing IS available. The acoustic path is viable.
5. **Don't add machinery ahead of data.** C did it 3× this session (room
   correlation assumptions, then the B8.2 pivot before B8.1 was fielded,
   then the bias learner before B8.2 was fielded). M's "come at it fresh"
   is the correct response to accumulated whiplash.
6. **A disabled button must say WHY** (Apply read as "broken" when it was
   waiting on console calibration → now reads "Needs console"). Minor,
   but a real UX scar.

## DESIGN DECISIONS PINNED (Battle Theater arc)
- **The adjudication line holds**: any live-site version is a RENDERER
  over the combatants channel — DM still resolves. The mocks self-
  resolve only because there's no DM in a file. Spectrum recap:
  (1) flair, (2) cinematic display, (3) full engine. Site target is
  (2); the mocks are (3) for feel-testing only.
- **HD-2D billboards over rigged 3D models** (Octopath trick): sprite
  sheets are the asset cost, not Three.js. Current pixel sprites are
  hand-typed placeholders; real sprite sheets (idle/attack/hit) are the
  first asset cost if this graduates. imagegen can draft.
- **One map document, three renderers**: the cartographer's generator
  output (tile grid + rooms + spawns + props + torches, seeded
  deterministic) drives top-down PNG, isometric PNG (other chat's mock),
  and the live 3D diorama identically. Scene row needs only
  {seed, theme, roomId(+overrides)} — clients regenerate.
- **New animation sync need** for any live version: Supabase Realtime
  BROADCAST message {actor, target, action, result} to choreograph
  attacks (HP deltas alone can't tell who hit whom). Ephemeral, no table.
- **Goblin autopilot** (M's idea): per-monster/side 3-position switch —
  manual / suggest ("goblin wants to flank Caim — roll / override") /
  auto. Suggest preserves DM authority while offloading the
  "choose who to hurt" burden. Compatible with the adjudication line
  because the DM holds the switch.
- **Elevation is visual-only for now**; no height mechanics.
- **Known gaps if this graduates**: bonus-action/reaction economy
  (real arc, dock lanes; sheet actions already carry types and the
  multiattack parser exists), LoS/cover, opportunity attacks, wall
  occlusion at low orbit angles (orbit buttons mitigate).
- Repo character JSONs are the LEGACY data path — may lag Supabase
  structural/vitals. Fine for mocks; recon live rows for anything real.

## KNOWN-AND-ACCEPTED / OPEN
- **Carried unchanged across both July 6 arcs**: radio sync floor
  ±150-500ms iOS (trim kills fixed part; wave C if rhythm still fails),
  track-change gap ~2s, stall semantics (climbing mid-track → Cloudinary
  AAC lever), two-engine race insurance, chip vs roll ticker eyeball,
  ◐ override banner (outputs-only, unreviewed), players' Battle strip =
  Display only, dead feed-reader code awaits feed-core,
  smoke-nav-cog-flyout.mjs awaiting git rm, schema deltas live-DB only,
  statblock drawer deliberate, Battle Theater mocks outputs-only /
  nothing committed.
- **NEW (Echo Lock)**: the entire Echo Lock trim-automation approach is
  UNSETTLED. Manual steppers work and are the reliable fallback. The CORS
  wall does NOT exist (Cloudinary PCM fetch+decode succeeded in the field
  — "peaked low" means decode worked). So the acoustic path's only real
  obstacle was the chirp-masking / stale-cache tangle, which may already
  be solved in the file and just never cleanly tested.

## THE MAP (revised July 6 night)
1. **FRESH ECHO LOCK RE-DERIVATION** (replaces the old "field-test B.7"
   framing for the sync sub-problem): with a clear head, re-decide what
   to measure. Read the OPEN QUESTION block. Likely: field the ACOUSTIC
   single-capture measure() path with the E3 mask + E4/E5 cache-stamps
   NOW GUARANTEED fresh, against M's ear as ground truth. If it lands
   where his ear does (the old 111 result), that's the answer and B8.2's
   console machinery collapses away. Keep steppers + relock regardless
   (both solid, both independently useful).
2. **Confirm B7 deployed** (still open from July 5). And confirm whether
   steppers/relock should just ship on their own merits — they're not
   entangled with the echo question.
3. **Wave C — Web Audio precision mode** (only if rhythm fails
   post-trim). Own arc, session-day testing.
4. **Wash sweep, next page: world** (then compendium; index designs
   token-native in its own arc; combat.html eventually).
5. **party.html ↔ v11 sheet parity**: field diff → layout mock → build.
6. **Feed-core extraction → chronicle swap** (M names the referent).
7. **Console layout re-haul** (needs M's gripes list).
8. **Mobile trio** (token drag / sheet-float overflow / sf-reopen tab).
9. **Battle Theater next steps** (exploratory track, does NOT displace
   1-8):
   a. M field-plays the forge mock more; verdict on diorama-as-direction.
   b. If graduating: decide the referent — diorama as combat.html's
      ALTERNATE RENDERER (same combatants rows/tokens, orbiting 2.5D
      stage, DM adjudicates) vs. standalone theater page for cinematic
      encounters. Renderer stance is the standing recommendation.
   c. Sprite-sheet asset pipeline mock (imagegen draft → idle/attack/hit
      frames for the party + a goblin) — first real asset cost.
   d. Broadcast choreography protocol sketch (rides bardic-bus lessons:
      snapshots/contract-in-header discipline applies).
10. **Small standalones carried**: medallion portraits rollout, rail alias
    wiring, badge growth, flyout polish, Scenes rail-size check.

## STANDING RULES (additions from both arcs in CAPS)
mock → approve → build for all UX. node --check + jsdom smokes before
every handover (JSX: @babel/parser IS the node --check); smoke green +
screenshot = done. C preps zips; M deploys (SQL first when present); C
never commits or pushes. **DEPLOY URL IS trials-of-kirtas.netlify.app;
main is the publish source — never say tok.manikkhan.com.** REFRESH THE
CONSOLE TAB AFTER EVERY BARDIC DEPLOY. Injected chrome: ID-prefixed
selectors, JS-mixed rgb()/rgba() literals, CACHE-STAMP EVERY MODULE
INCLUDE (bare-src cost a wrong conclusion this session — the ?v= stamp is
not optional on iOS; rail riders follow bare-src bootstrap, stamp per
SETTINGS_V). scrollIntoView banned in scoped containers; overflow:clip
not programmatically scrollable. GitHub web upload drops hidden dotfiles.
Stub the publisher's contract in smoke harnesses AND ASSERT FIELD
MAPPINGS AGAINST SOURCE (the `label` scar — bit again this session:
anchor objects carry pos/at/paused, NOT title; read titles from the
rendered label). Recon saved state before connecting dormant surfaces.
Verify deploy state; never infer it — not from repo constants, not from a
long-lived tab. Map items name FILES, not furniture. FAILURES MUST
NARRATE (and a DISABLED CONTROL MUST NARRATE WHY). NEVER RATE-NUDGE
MUSIC. On iOS: MUTED not volume=0 to silence an element;
echoCancellation:false IS honored. Bardic protocol lives in
bardic-bus.js's header; snapshots, never diffs. Every bardic wave bumps
BARDIC_BUILD. RULE ONE APPLIES TO MOCKS TOO: fetch live source (repo
JSONs, upstream generator) before baking data — the Battle Theater arc's
party stats, portraits, and generator core were all fetched, not
remembered. THIRD-PARTY CORES CARRY THEIR LICENSE: the dungeon gen core
is MIT © Majid Manzarpour, attribution stays in file header + UI wherever
it travels. **DON'T ADD MACHINERY AHEAD OF DATA — when M says the
solution is simpler than C's model, field-test the simple version before
defending the complex one.**
