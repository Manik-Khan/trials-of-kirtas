> **MERGED into CONTEXT_Forge.md (2026-07-12 fourth session). Safe to delete on the next push. The "next session" build order here RAN — see CONTEXT_Forge-update-2026-07-12d.md.**

# CONTEXT_Forge update · 2026-07-12c session (bites C1+A shipped → table round 3 → headless repro)

**Merge into CONTEXT_Forge.md. Supersedes the "next session starts with fix plan §F bite 1" framing in `CONTEXT_Forge-update-2026-07-12b.md` — bites C1 and A shipped this session (`forge-bites-c1-a.zip`, uploaded), a third table round produced six findings, and a headless repro against the live character JSONs found the two production facts that invalidate part of bite A. The read-first doc for the next session is `2026-07-12-forge-round3-fix-plan-v2.md`.**

---

## What shipped this session (in-repo via forge-bites-c1-a.zip)

| File | Change | Smokes |
|---|---|---|
| `forge/topography-test-mock.html` | soul-shards-data.js script tag (drawer lazy spell text unblocked); green heal / gold buffAlly tint split in `drawHi` | — |
| `forge/forge-kit-derive.js` | SPELL_COMBAT projection table (~70 spells → pipeline kinds, greyed fallback); spellTiles projection rewrite; attackTiles attack-cantrip `hitMod` fix + damage-only→save re-kind *(the re-kind is being partially reverted — see below)*; featTiles `_src` passthrough; SPELL_COMBAT exported | 254 green |
| `forge/forge-hud.js` | drawer entries-array branch for feats via `_renderSpellEntries` | — |
| `weapon-actions.js` | `saveAbility` on damage-only rows | — |
| `forge/tests/smoke-kit-derive.js` | +87: feat `_src`, per-PC projections, greyed invariant, attack-cantrip hit math, cantrip level scaling | 254 total |

All suites green at handover: kit-derive 254 · spell-icons 43 · feed-render 66 · starter-kits 16 · protocol 56 · replay 35.

## Table round 3 → the headless repro (the session's real work)

M's test surfaced: no green ally glow for heals, "wrong target" spam, shortbow LoS refusing clear shots, empty bars until session start, items tab empty, foes still autonomous. First-pass diagnosis from the screenshot (sprite-overlap, heal-the-downed) was **falsified by M's follow-ups** (isolated enemies also failed; nobody was down — Líadan was the healer).

A node harness then ran `assembleActions` + `derive` on the **in-repo live JSONs** (`data/characters/*.json`) and dumped flat actions. Two production facts:

1. **`structural.spellcasting` is `None` on every live character.** Live spells sit under `structural.spells`, level-keyed with inconsistent keys (`'1'`/`'level2'`/`'cantrip'`/`'cantrips'`). `spellTiles` reads `spellcasting.groups` → **zero spell tiles in production**. The 76 SPELL_COMBAT smokes pass because the fixtures were written in the groups shape. Lesson pinned, second offense: *fixtures diffed against live data, never against the intended contract.*
2. **Sheet type `damage-only` ≠ save spell.** It's the action editor's "roll dice, no attack roll" bucket and live sheets file **Healing Word, Cure Wounds, Hand of Healing, Hex (damage), Absorb Elements** there. Bite A's blanket re-kind made Healing Word `kind:"save"` → `drawHi` painted *enemies* for M's heals, allies never glowed, friendly clicks logged "wrong target." One wrong assumption explained three findings.

Also confirmed by code read: local sandbox never calls `loadLiveStats()` and `kitFor` returns raw tab-less STARTER_KITS (the empty-bar finding); `tileFlat` lacks `depthTest:false` (target tints hide under the ink shell; the gold marker has the flag, which is why gold shows).

## Rulings ratified this round (M's calls)

1. **Heal-the-downed:** healing a downed ally brings it up at the healed HP, unconscious condition cleared. (Forward work — `allies()`/`spriteUnit` filter `alive` today, so it's currently inexpressible.)
2. **Hover-tile indicator wanted:** FFT-style glowing tile under the cursor (green; red when hovering an invalid target with an action pending) so the click's landing cell is always visible.

## Next session — build order (plan v2 §H)

1. **A+B+C of plan v2 as one surgery on forge-kit-derive** (riskiest first): `spellGroupsFrom(structural)` normalizer reading both shapes; SPELL_COMBAT label lookup decides kind (row type only picks which numeric fields to trust); label-dedupe of assembled vs sheet rows (assembled wins). Smokes rebuilt with the **four live JSONs as first-class fixtures loaded from disk**; greyed-or-resolvable invariant asserted on live kits.
2. Quick wins: `startCombat()` → `loadLiveStats()`; `kitFor` starter branch → `wrapStarterKit`; `tileFlat` target tints `depthTest:false`; hover-tile indicator.
3. LoS: `explainBlock` → the feed (named blocker + corner count), M table-reads one real refusal, **then** rules on tree occlusion (no blind geometry fix — corner-tracing is M-ruled geometry).
4. Items diagnosis (itemTiles vs live inventory) → heal-the-downed (replay-smoked, protocol-adjacent) → LoS ruling smoke → arc E foes → concentration arc (mock-gated).

## Known gaps / carry-forward (unchanged)

Supabase feed insert (top since bite 2) · universal-action fact publishing (protocol bite) · appearance prefs §6.5 · manual resource adjust · gear-manager picker migration · Resources tab read-only v1 · spell-icons glyphs are placeholders pending M's curation pass · picker search + glyph growth (plan-b §B) queued behind the round-3 fixes.

## Working-rules confirmations

- **Headless repro before theory:** the screenshot-based diagnosis was wrong twice; a 40-line node harness against live data was right once and decisively. When live behavior contradicts green smokes, reproduce with production data before proposing fixes.
- **The fixture-shape rule (new, pinned):** any derive-layer smoke that models `structural` must load the real character JSONs from `data/characters/` alongside synthetic fixtures.
- M falsifying hypotheses at the table is part of the loop — plan v1 shipped, M's two corrections rerouted the whole diagnosis. Keep shipping plans early enough to be corrected.
