# 2026-07-12 · Forge round-3 fix plan (REVISED after headless repro)

**Status: BUILT — all §H items (A+B+C · E · D step 1 · G · F) shipped in the 2026-07-12d session. Read `CONTEXT_Forge-update-2026-07-12d.md` for what landed, the two known-answer corrections (Líadan DC 12, HW 1d4+2), and the dedupe ruling awaiting M. Original plan text below, unchanged.**

**Status at write time: DIAGNOSED — root causes reproduced headlessly against the live character JSONs (not inferred from the screenshot). Supersedes the first round-3 plan (`2026-07-12-forge-round3-fix-plan.md`); findings 1–3 there were misdiagnosed. Read §0 first — the mechanism is embarrassing and instructive.**

---

## 0 · What the headless repro found

A node harness ran `assembleActions` + `ForgeKitDerive.derive` on the **in-repo live character JSONs** (`data/characters/*.json`) and dumped the flat actions. Two production facts the smoke fixtures never modeled:

**Fact 1 — `structural.spellcasting` is `None` on every live character.** Spells live under `structural.spells`, a level-keyed object with *inconsistent keys per character*: Líadan `'1','2','cantrip'` · Caim `'level2','cantrips'` · Cosmere `'1','cantrip'`. The bite-A `spellTiles` reads `spellcasting.groups` → **produces zero tiles in production**. All 76 SPELL_COMBAT smokes pass because the fixtures were written in the `groups` shape. The morning's kind-mismatch lesson, recommitted harder: *fixtures must be diffed against live data, not against the intended contract.*

**Fact 2 — the sheet's `damage-only` action type is NOT "save spell."** It's the action editor's "roll dice, no attack roll" bucket, and live sheets file **Healing Word, Cure Wounds, Hand of Healing, Hex (damage), Absorb Elements** under it. Bite A re-kinds every `damage-only` row to `kind:"save"` — so at the table, **Healing Word was an offensive save spell**: `drawHi` painted *enemies* red for it, allies never glowed green, and clicking friendlies with it pending logged "wrong target."

**Resulting live flatActions (Líadan):** Cure Wounds `kind=save` · Healing Word `kind=save` · Vicious Mockery `kind=utility` · Sling ×2 · Dagger ×2 (assembled row + sheet row, both flowing in). No `spell_*` tiles at all.

### Symptom → cause map (all six findings)

| Table symptom | Actual cause |
|---|---|
| Allies never glow green for heals | Healing Word/Cure Wounds re-kinded to `save` (Fact 2) → the save branch highlights enemies |
| Enemies not highlighted for damage spells | The spells M tapped are sheet rows with `kind=utility`/mangled kinds, or greyless no-ops; real SPELL_COMBAT tiles never derived (Fact 1) |
| "Wrong target" clicking around | Pending actions carried inverted kinds, so the side gate (`mock:4122`) rejected the *correct* targets. A friendly click with a `save`-kinded heal pending = "wrong target" by construction |
| Shortbow "no LoS" in the open | Independent geometry issue — see §D. Not touched by bites C1/A |
| Empty bars until session start | `loadLiveStats()` fires only on session paths; local `kitFor` returns raw STARTER_KITS with no `tabs` (confirmed, unchanged from plan v1 §E) |
| Items empty / foes autonomous | Items: itemTiles-vs-live-inventory check pending. Foes: arc E, sequenced, not regressed |

**Also real, also table-ratified this round:** heal-a-downed-ally (M's ruling: heal on a downed unit brings it up, unconscious condition cleared) — allies()/spriteUnit currently filter `alive` so it's inexpressible. And M's new UX ask: **FFT-style hover-tile indicator** (glowing tile under the cursor so you always know which cell/unit a click will land on).

---

## A · spellTiles reads the live shape (Fact 1) — the big one

- New normalizer in forge-kit-derive: `spellGroupsFrom(structural)` — prefers `spellcasting.groups` when present (fixture/new shape), else builds groups from `structural.spells`: key normalization `'cantrip'|'cantrips'→0`, `'N'|'levelN'→N`; per-row `castingTime→time`, `concentration|conc→conc`, `range` carried into `_src`.
- DC/attack bonus: live `spellcasting` is empty, so the existing `guessCastAbil` fallback path is load-bearing — verify per-PC known answers against the real JSONs (Líadan DC 13, Cosmere DC 13/+5, Caim WIS DC).
- **Smokes rebuilt on live data:** the four real `data/characters/*.json` files become first-class fixtures (loaded from disk in the smoke harness). Known-answer projections re-asserted per PC against those. The synthetic fixtures stay for edge cases but no longer stand alone.

## B · damage-only un-poisoned (Fact 2)

- Revert the blanket `damage-only → save` re-kind. New rule: **the SPELL_COMBAT label lookup decides the kind**; the row type only decides which numeric fields to trust (`hitMod` direct on `attack-cantrip`, `dmgMod/dmgDice` on both).
- `damage-only` rows whose label projects to `heal` → heal tiles (Healing Word, Cure Wounds, Hand of Healing via alias entries). Projects to `save` → save (Toll the Dead). No projection → greyed with reason, never a wrong-kind live wire.
- Rider/duplicate rows (`Hex (damage)`, `Absorb Elements`) → greyed v1 ("rolls from its parent effect — drawer explains"), dedupe question to M later.

## C · Dedupe assembled vs sheet rows

Sling/Dagger/Second Wind each appear twice (inventory-assembled + sheet action row; classFeature + sheet row). Rule: normalized-label dedupe, **assembled/classFeature wins** (it has the derived math), sheet row folds into `_src` so nothing the sheet wrote is lost. Smoked on the live JSONs (exactly one Sling on Líadan, one Second Wind on Vesperian).

## D · Shortbow LoS — instrument, then rule

Unchanged from plan v1 §D but sharpened by M's test (clear line, still blocked): suspects narrow to corner-lines clipped by cells **adjacent to** shooter/target (trees/rim beside, not between — `segAttrib` walks corner rays that pass through diagonal neighbors) or the traced-map `occ[]` layer itself. Step 1 stays: `explainBlock` output goes **to the feed** ("no line of sight — pine at 14,9, 15 ft occluder, 7/8 corners"), plus the 8-line breakdown to console. M reads one real blocked shot at the table → then rules (trees cap at three-quarters / lower pine occ / as-is). Geometry smoke pins the ruling.

## E · Local-mode bars + paint layer + hover tile (quick wins, unchanged + one new)

1. `startCombat()` calls `loadLiveStats()`; `kitFor`'s starter branch returns `wrapStarterKit(...)` so tabs always exist.
2. `tileFlat` target tints get `depthTest:false` (match the gold marker) so green/red/gold paint over the ink shell.
3. **NEW — hover-tile indicator (M's ask):** pointermove raycast → one glowing `tileFlat` (soft green, `depthTest:false`) on the hovered cell; when the hovered cell holds a unit, tint by pending-validity (green = valid target, red = invalid) so the click's landing spot is always visible. Throttled to the existing pointermove handler; no protocol.

## F · Heal-the-downed (ruling ratified this round)

M's ruling: heal on a downed ally → back up at healed HP, unconscious condition cleared. Build: `alliesForHeal` includes downed; `spriteUnit` admits downed sprites while a heal is pending; the un-down travels as a published fact through the existing `netHeal` door. Replay-smoked before browser wiring. (Nobody was down this round — this is forward work, not the observed bug.)

## G · Items + foes

Items: ten-minute `itemTiles`-vs-live-inventory read at the top of the build session (the live JSONs are now in the harness anyway). Foes: arc E as sequenced; promotable on M's word.

---

## H · Build order

1. **A + B + C together** — they're one surgery on forge-kit-derive with one shared smoke rebuild on live fixtures. *Riskiest first, per house rule.*
2. **E** — three small mock edits + hover tile.
3. **D step 1** — LoS feed instrumentation. M table-reads a blocker line before any geometry ruling.
4. **G items** diagnosis + fix.
5. **F** heal-the-downed (protocol-adjacent, replay-smoked).
6. **D step 2** ruling + smoke → then **arc E foes** → then concentration arc (mock-gated), per the standing order.

## I · Validation

- Live-data fixtures in the smoke harness (the four real JSONs, loaded from disk).
- Per-PC known answers re-asserted: Healing Word heal/1d4+3/12 · VM save/wis/DC13 · EB attack/+5/1d10 · Hand of Healing heal · dedupe counts.
- Invariant upgraded: every flat action's kind ∈ resolvable set OR tile greyed — asserted on **live** kits, not just fixtures.
- All existing suites stay green (254/43/66/16/56/35 — the 76 SPELL_COMBAT smokes get re-pointed at live shapes, count may shift).
- Browser eyeball: Healing Word paints allies green over the ink; hover glow tracks the cursor; local sandbox bar populated; a blocked shortbow shot names its blocker in the feed.

---

*Carried by name: Supabase feed insert; universal-action fact publishing; appearance prefs; manual resource adjust; gear-manager picker migration; concentration arc.*
