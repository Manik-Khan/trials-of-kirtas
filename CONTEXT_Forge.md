# CONTEXT — Battle Forge (heightfield) — updated 2026-07-08

> Handoff for a fresh session. The Forge is playable end-to-end EXCEPT the
> ranged geometry / line-of-sight, which is **still not working in-browser**
> after several attempts. Read **"THE GEOMETRY PROBLEM"** below FIRST — there is
> a specific trap to avoid.

---

## PROJECT SPINE (unchanged)
- **Trials of Kirtas (ToK)** — M's D&D 5e VTT. Repo `Manik-Khan/trials-of-kirtas` (public). Deploy `trials-of-kirtas.netlify.app`. Vanilla JS/HTML/CSS + Supabase + Netlify. **C never pushes; M deploys by hand.** Stage files to `/mnt/user-data/outputs/`.
- Party (6, live via `CharacterData`/Supabase — party.html & sheet-v2 read live, NOT the repo `data/characters/*.json` seeds): **Caim** (Monk), **Chonkalius** (Barbarian 3, placeholder — ignore for now), **Cosmere Runestar** (Warlock 2/Sorc 1), **Líadan Luchóg** (Bard 3/Cleric 1), **The Wiz** (Wizard 3, placeholder — ignore), **Vesperian Vale** (Fighter 4). M is admin, plays Vesperian.
- Working rules: mock→approve→build; **read repo source before editing**; `node --check` + smokes before handover; **inlined `tactics-geometry.js` must stay byte-identical to `forge/tactics-geometry.js`**; surgical edits; failures narrate; deploy URL is `trials-of-kirtas.netlify.app`.

---

## WHERE THE WORK LANDED THIS SESSION

**The Forge was rebased onto `topography-test-mock.html`** (M's parchment heightfield diorama) — this is now THE surface. `battle-tactics-geo-mock.html` (dark FE-style combat mock) is **superseded** and kept only as the source of the M-authored action sets. Do not build on it.

Flow now: **party.html-style cinematic select → "Enter the Forge" → generates a tiered heightfield (Generated Tiers mode) → drops the chosen party at the entrance (highest tier) + a goblin band deep (lowest tier) → playable tactical battle.**

### What is built (and passes headless checks)
- **Select** (`#partySelect`): opt-in, controller/badge model driven by *who you're logged in as* — a "Logged in as" switcher (mock-only), you pick which characters this login drives → **V, or V1/V2/V3/V4** when one login drives several (own char first). Hands `window.__fightRoster` + `window.__fightControllers` to the Forge.
- **Bridge** (`makeToken`): characters are billboard **standees**. FIX THIS SESSION: tokens render an **immediate placeholder** (seat-colour initial, synchronous canvas texture) and **swap to the portrait async on load** — so tokens are never blank (earlier they were empty because the portrait `TextureLoader` had no placeholder). Goblins = "G". Real token sprites still pending from M's other thread.
- **Turn loop**: initiative, height-gated movement (teal tiles, click-to-move, budget), End Turn. Foes are **DM-stepped** ("▶ Run [Goblin]'s turn" button) — deliberately no auto-timer, so rewind can't race it.
- **Action system** (ported verbatim from `battle-tactics-geo-mock.html` PARTY defs): per-character kits, action/bonus/free economy, resources (slots/ki/bardic/rage/secondWind/actionSurge), attacks / saves (VM) / heals (+Disciple) / buffs (Hex, Bardic) / Magic Missile auto / Action Surge / Second Wind. Menu → pick action → click target.
- **Reactions**: on a hit, DM-prompted pipeline **Silvery Barbs → Shield → damage → Hellish Rebuke**; one reaction/creature refreshed at your turn; each snapshots into rewind.
- **Rewind** (3-tier, cross-turn): **◀** one beat · **⏮** to a turn start (walks back through turns) · **▶** redo · **Reset** (two confirms). Snapshot/restore rebuilds positions, HP, resources, downed tokens, turn state.
- **HUD**: parchment initiative rail, active-unit panel (HP / move / action / bonus / kit buttons), reaction overlay, log, rewind transport, Re-forge, Reset. Combat stats/kits for the 4 real PCs; Chonkalius/Wiz are `approx` placeholders.

### Files (in outputs)
- **`topography-test-mock.html`** — the Battle Forge (THE file).
- **`liadan.json`** — seed sheet corrected to Bard 3 / Cleric 1, level 4, 24/31, AC 12 (repo seed is secondary; live is Supabase).
- **`smoke-forge-engine.js`** — `frost`→`tundra` test fix (repo upload, `forge/tests/`).

---

## ⚠️ THE GEOMETRY PROBLEM — READ BEFORE TOUCHING CODE

**Symptom (persistent):** ranged attacks report **"no line of sight"** for essentially all targets; the targeting geometry doesn't light up. Eldritch Blast (120 ft), Shortbow (80/320) should hit visible goblins and don't. M confirms **"the geometry is not fixed"** across multiple attempts and suspects an **error loop**. This is why the session was stopped.

**THE TRAP (most important thing in this doc):** every fix this session was "validated" by **headless synthetic tests that kept passing (17/17, 9/9, 10/10, 8/8) while the browser stayed broken.** The tests build a fake `F` field by hand and confirm the *algorithm I wrote* does what *I think* — they do NOT prove anything about the real running system. **Do not write more synthetic geometry tests and call them proof. That is the loop.**

**What next session MUST do first — instrument reality, don't theorize:**
1. In the actual running combat, when a "no line of sight" fires, `console.log` the REAL values: attacker `{c,r}` and target `{c,r}`; `F.W/F.H`; the raw `F.height`, `F.foot`, `F.type` along the traced line; and the actual `cbDist`/`cbLoS` return. Compare to what's on screen.
2. Verify the **coordinate mapping is not the bug** — that a clicked token resolves to the cell the unit actually occupies, that `wxc/wzc` (world→cell) inverse used in `combatClick` (`gx=round(point.x+F.W/2-0.5)`) matches how tokens were placed, and that `CB.map`/`F` indices line up with token `c,r`. A half-cell or transposed-axis error would make LoS trace the wrong cells and always "fail" — and would never show up in synthetic tests.
3. Confirm `cbLoS`/`reachOK` are even the functions being hit (no stale duplicate, no `CB.map` vs `F` divergence after a re-forge).

**Attempts already made (don't just redo these):**
- Range: switched `range3d` (Euclidean hypot) → `cbDist = max(horizontal, vertical)×5` (3D Chebyshev; 30 ahead + 30 down = 30). *This part matches M's rule and is probably fine.*
- LoS attempt #1: reused canonical `losVerdict` — wrong; it treats everything outside the dungeon footprint as opaque wall → blocks all cross-area shots.
- LoS attempt #2: `cbLoS` with a straight eye-to-eye interpolated sightline — over-blocked because the shooter's OWN plateau sags below the descending line when firing downhill.
- LoS attempt #3 (**current, UNTESTED in-browser** — M stopped before testing it): `cbLoS` blocks only if intervening terrain/rock rises above `max(eyeA, eyeB)` (you see over anything up to your own eye height). Whether this actually works in-browser is **unknown** — verify with step 1 above before assuming.

**M's canonical geometry rules (the target behavior):**
- A tier = **5 ft**. Diagonals = **5 ft** (Chebyshev, not 5/10). Movement already does this correctly.
- **3D distance = the Chebyshev hypotenuse:** `max(horizontal_squares, vertical_tiers) × 5`. "A creature 30 ft down and ahead is still 30 ft."
- **LoS uses the same air geometry.** "Down and ahead is visible." A hill/wall taller than you blocks; open air, valleys, gaps, and shooting downhill do not.

**Possible real culprits not yet ruled out:** (a) coordinate/cell mismatch between token placement and the LoS trace (step 2) — this is the prime suspect and was never checked; (b) `F.height` values differing from the assumed integer tiers at combat time; (c) foes genuinely behind `T_ROCK` in generated dungeons (would be *correct* blocking, but worth confirming vs perceived-open terrain); (d) `cbLoS` reading a stale `F` after re-forge.

**Decision still open:** whether this heightfield range/LoS should become the **canonical** rule in `forge/tactics-geometry.js` (and re-synced into the inline + the box-tile `battle-tactics` mock), or stay local to the topography combat. Don't fold into canonical until it actually works in-browser.

---

## OTHER OPEN / DEFERRED
- **Cover**: the wall-corner cover bonus was dropped when replacing `losVerdict`; heightfield partial cover (half cover from a low ridge) is unimplemented.
- **Booming Blade** move-trigger implemented (marked target moving takes +1d8, lapses at caster's turn) — verify in-browser once LoS works.
- **Foe AI**: goblins only, advance-and-strike; DM-stepped. Real monsters / proper AI later.
- **Chonkalius & The Wiz**: placeholder kits, `approx`. Ignore until real sheets provided.
- **Real token sprite sheet**: pending from M's separate thread; drops into the `makeToken` async-swap path.
- **Live data**: select is seeded to match live party.html; swap `PARTY` for `await window.CharacterData.loadParty()` when embedded in the app.
- The **asset library** (`/assets/library.json`) and the rest of the topography builder are intact and untouched by the combat layer.

---

## SUGGESTED FIRST MOVE NEXT SESSION
Open `topography-test-mock.html`, start a fight, fire a ranged attack that *should* connect, and **read the instrumentation (step 1–2 above) before writing any code.** Find out what the real cells/heights/LoS actually are. The bug is almost certainly in the gap between the synthetic tests and the real field — most likely the token↔cell coordinate mapping — not in the LoS math that keeps passing tests.
